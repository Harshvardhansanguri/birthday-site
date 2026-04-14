const express = require("express");
const cors = require("cors");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function compactText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function cleanArray(items) {
  return items
    .map((item) => compactText(item))
    .filter(Boolean);
}

function splitList(value) {
  return cleanArray(
    String(value || "")
      .split(/\n|,|•|;/)
      .map((item) => item.trim())
  );
}

function normalizeCollection(items, keys) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const normalized = {};

      keys.forEach((key) => {
        normalized[key] = compactText(item?.[key]);
      });

      return normalized;
    })
    .filter((item) => keys.some((key) => item[key]));
}

function normalizeResumeData(payload = {}) {
  return {
    fullName: compactText(payload.fullName),
    email: compactText(payload.email),
    phone: compactText(payload.phone),
    location: compactText(payload.location),
    linkedin: compactText(payload.linkedin),
    github: compactText(payload.github),
    portfolio: compactText(payload.portfolio),
    technicalSkills: compactText(payload.technicalSkills),
    tools: compactText(payload.tools),
    softSkills: compactText(payload.softSkills),
    certifications: compactText(payload.certifications),
    achievements: compactText(payload.achievements),
    extraActivities: compactText(payload.extraActivities),
    education: normalizeCollection(payload.education, [
      "degree",
      "college",
      "year",
      "cgpa"
    ]),
    projects: normalizeCollection(payload.projects, [
      "title",
      "description",
      "technologies"
    ]),
    experience: normalizeCollection(payload.experience, [
      "company",
      "role",
      "duration",
      "description"
    ])
  };
}

function sanitizeFilename(name) {
  const safeBase = String(name || "candidate")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safeBase || "candidate";
}

function bulletLines(text) {
  const lines = String(text || "")
    .split("\n")
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-Z])/))
    .map((line) => line.replace(/^[•\-*\s]+/, "").trim())
    .filter(Boolean);

  return cleanArray(lines);
}

function buildImprovementPrompt(resumeData) {
  return `
You are a resume editor. Rewrite the content into concise, ATS-friendly, professional resume language.

Rules:
- Return valid JSON only.
- Keep the same structure and array lengths.
- Do not invent companies, roles, dates, degrees, or metrics.
- Improve clarity, grammar, and impact.
- For descriptions, return 2-4 strong bullet points separated by "\\n".
- For skill fields, return comma-separated values.
- Preserve links, names, and personal facts exactly unless grammar cleanup is needed.

JSON shape:
{
  "technicalSkills": "string",
  "tools": "string",
  "softSkills": "string",
  "certifications": "string",
  "achievements": "string",
  "extraActivities": "string",
  "projects": [{"title": "string", "description": "string", "technologies": "string"}],
  "experience": [{"company": "string", "role": "string", "duration": "string", "description": "string"}]
}

Input data:
${JSON.stringify(resumeData, null, 2)}
`.trim();
}

function extractResponseText(response) {
  if (response.output_text) {
    return response.output_text;
  }

  if (!Array.isArray(response.output)) {
    return "";
  }

  const collected = [];

  response.output.forEach((item) => {
    if (!Array.isArray(item.content)) {
      return;
    }

    item.content.forEach((contentItem) => {
      if (contentItem.type === "output_text" && contentItem.text) {
        collected.push(contentItem.text);
      }
    });
  });

  return collected.join("\n").trim();
}

function parseJson(text) {
  const raw = String(text || "").trim();

  if (!raw) {
    throw new Error("The AI service returned an empty response.");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("The AI response could not be parsed as JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function truncateText(text, limit) {
  const value = compactText(text);
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 1).trim()}…`;
}

function formatLinkDisplay(value, label) {
  const text = compactText(value);
  if (!text) {
    return "";
  }

  try {
    const parsed = new URL(text);
    const host = parsed.hostname.replace(/^www\./, "");
    const pathValue = parsed.pathname.replace(/\/+$/, "");
    const shortPath =
      pathValue && pathValue !== "/" ? truncateText(pathValue.replace(/^\//, ""), 26) : "";

    return shortPath ? `${label}: ${host}/${shortPath}` : `${label}: ${host}`;
  } catch (_error) {
    return `${label}: ${truncateText(text, 34)}`;
  }
}

function wrapText(text, font, fontSize, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);

  if (!words.length) {
    return [];
  }

  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${currentLine} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }

  lines.push(currentLine);
  return lines;
}

function encodeResumePayload(resumeData) {
  return Buffer.from(JSON.stringify(resumeData), "utf8").toString("base64url");
}

function decodeResumePayload(value) {
  return JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
}

async function createResumePdf(resumeData) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 42;
  const headerHeight = 102;
  const leftWidth = 180;
  const gutter = 28;
  const rightWidth = pageWidth - margin * 2 - leftWidth - gutter;
  const lineColor = rgb(0.78, 0.78, 0.78);
  const mutedColor = rgb(0.35, 0.35, 0.35);
  const darkColor = rgb(0.08, 0.08, 0.08);
  const sectionColor = rgb(0.22, 0.22, 0.22);
  const pages = [];

  const name = resumeData.fullName || "Your Name";
  const contactLine = cleanArray([
    resumeData.email,
    resumeData.phone,
    resumeData.location
  ]).join("  |  ");
  const linkLine = cleanArray([
    formatLinkDisplay(resumeData.linkedin, "LinkedIn"),
    formatLinkDisplay(resumeData.github, "GitHub"),
    formatLinkDisplay(resumeData.portfolio, "Portfolio")
  ]).join("  |  ");

  function buildPage(pageIndex) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const isFirstPage = pageIndex === 0;
    const dividerX = margin + leftWidth + gutter / 2;

    if (isFirstPage) {
      page.drawText(name, {
        x: margin,
        y: pageHeight - 52,
        size: 22,
        font: bold,
        color: darkColor
      });

      if (contactLine) {
        wrapText(contactLine, regular, 9.6, pageWidth - margin * 2).forEach((line, index) => {
          page.drawText(line, {
            x: margin,
            y: pageHeight - 72 - index * 12,
            size: 9.6,
            font: regular,
            color: mutedColor
          });
        });
      }

      if (linkLine) {
        wrapText(linkLine, regular, 8.2, pageWidth - margin * 2).forEach((line, index) => {
          page.drawText(line, {
            x: margin,
            y: pageHeight - 88 - index * 11,
            size: 8.2,
            font: regular,
            color: mutedColor
          });
        });
      }

      page.drawLine({
        start: { x: margin, y: pageHeight - headerHeight },
        end: { x: pageWidth - margin, y: pageHeight - headerHeight },
        color: lineColor,
        thickness: 1
      });

      page.drawLine({
        start: { x: dividerX, y: pageHeight - headerHeight - 6 },
        end: { x: dividerX, y: 50 },
        color: rgb(0.88, 0.88, 0.88),
        thickness: 0.8
      });

      return { page, startY: pageHeight - headerHeight - 16 };
    }

    page.drawText(name, {
      x: margin,
      y: pageHeight - 34,
      size: 12,
      font: bold,
      color: darkColor
    });

    page.drawLine({
      start: { x: margin, y: pageHeight - 42 },
      end: { x: pageWidth - margin, y: pageHeight - 42 },
      color: lineColor,
      thickness: 1
    });

    page.drawLine({
      start: { x: dividerX, y: pageHeight - 50 },
      end: { x: dividerX, y: 50 },
      color: rgb(0.88, 0.88, 0.88),
      thickness: 0.8
    });

    return { page, startY: pageHeight - 58 };
  }

  function ensurePage(pageIndex) {
    if (!pages[pageIndex]) {
      pages[pageIndex] = buildPage(pageIndex);
    }

    return pages[pageIndex];
  }

  const leftState = { x: margin, width: leftWidth, pageIndex: 0, y: ensurePage(0).startY };
  const rightState = {
    x: margin + leftWidth + gutter,
    width: rightWidth,
    pageIndex: 0,
    y: ensurePage(0).startY
  };

  function moveToNextPage(state) {
    state.pageIndex += 1;
    state.y = ensurePage(state.pageIndex).startY;
  }

  function ensureVerticalSpace(state, height) {
    if (state.y - height < 48) {
      moveToNextPage(state);
    }
  }

  function drawLineText(state, text, options = {}) {
    const pageInfo = ensurePage(state.pageIndex);
    pageInfo.page.drawText(text, {
      x: state.x + (options.indent || 0),
      y: state.y,
      size: options.size || 9.2,
      font: options.font || regular,
      color: options.color || darkColor
    });

    state.y -= options.lineHeight || 12;
  }

  function drawWrappedParagraph(state, text, options = {}) {
    const font = options.font || regular;
    const size = options.size || 9.5;
    const indent = options.indent || 0;
    const width = options.width || state.width - indent;
    const lineHeight = options.lineHeight || 12;
    const lines = wrapText(text, font, size, width);

    lines.forEach((line) => {
      ensureVerticalSpace(state, lineHeight);
      drawLineText(state, line, {
        indent,
        size,
        font,
        color: options.color,
        lineHeight
      });
    });
  }

  function drawBulletList(state, lines, options = {}) {
    const size = options.size || 9.4;
    const lineHeight = options.lineHeight || 12;
    const bulletIndent = 10;
    const paragraphWidth = state.width - bulletIndent;

    lines.forEach((item) => {
      const wrapped = wrapText(item, regular, size, paragraphWidth);
      wrapped.forEach((line, index) => {
        ensureVerticalSpace(state, lineHeight);
        if (index === 0) {
          const pageInfo = ensurePage(state.pageIndex);
          pageInfo.page.drawText("•", {
            x: state.x,
            y: state.y,
            size,
            font: bold,
            color: darkColor
          });
          drawLineText(state, line, {
            indent: bulletIndent,
            size,
            font: regular,
            lineHeight
          });
        } else {
          drawLineText(state, line, {
            indent: bulletIndent,
            size,
            font: regular,
            lineHeight
          });
        }
      });
    });
  }

  function drawSectionTitle(state, title) {
    ensureVerticalSpace(state, 24);
    const pageInfo = ensurePage(state.pageIndex);

    pageInfo.page.drawText(title.toUpperCase(), {
      x: state.x,
      y: state.y,
      size: 8.4,
      font: bold,
      color: sectionColor
    });

    const titleWidth = bold.widthOfTextAtSize(title.toUpperCase(), 8.4);

    pageInfo.page.drawLine({
      start: { x: state.x + titleWidth + 10, y: state.y + 3 },
      end: { x: state.x + state.width, y: state.y + 3 },
      color: lineColor,
      thickness: 0.75
    });

    state.y -= 17;
  }

  function drawEducation(state, educationList) {
    if (!educationList.length) {
      return;
    }

    drawSectionTitle(state, "Education");

    educationList.forEach((entry) => {
      ensureVerticalSpace(state, 42);
      drawWrappedParagraph(state, entry.degree || "Degree", {
        font: bold,
        size: 10.4,
        lineHeight: 12.5
      });
      drawWrappedParagraph(state, entry.college, {
        size: 9,
        color: mutedColor,
        lineHeight: 10.8
      });

      const meta = cleanArray([
        entry.year ? `Year: ${entry.year}` : "",
        entry.cgpa ? `CGPA: ${entry.cgpa}` : ""
      ]).join("  |  ");

      if (meta) {
        drawWrappedParagraph(state, meta, {
          size: 8.8,
          color: mutedColor,
          lineHeight: 10.6
        });
      }

      state.y -= 8;
    });
  }

  function drawSkillSection(state, title, value) {
    const items = splitList(value);
    if (!items.length) {
      return;
    }

    drawSectionTitle(state, title);
    drawWrappedParagraph(state, items.join(" • "), {
      size: 9,
      lineHeight: 11.2,
      color: darkColor
    });
    state.y -= 6;
  }

  function drawSimpleBulletSection(state, title, value) {
    const items = bulletLines(value);
    if (!items.length) {
      return;
    }

    drawSectionTitle(state, title);
    drawBulletList(state, items, { size: 9.1, lineHeight: 11.2 });
    state.y -= 6;
  }

  function drawExperience(state, experienceList) {
    if (!experienceList.length) {
      return;
    }

    drawSectionTitle(state, "Experience");

    experienceList.forEach((entry) => {
      ensureVerticalSpace(state, 52);
      drawWrappedParagraph(state, entry.role || "Role", {
        font: bold,
        size: 10.8,
        lineHeight: 12.5
      });

      const companyLine = cleanArray([
        entry.company,
        entry.duration
      ]).join("  |  ");

      if (companyLine) {
        drawWrappedParagraph(state, companyLine, {
          size: 9,
          color: mutedColor,
          lineHeight: 10.8
        });
      }

      const bullets = bulletLines(entry.description);
      if (bullets.length) {
        drawBulletList(state, bullets, { size: 9.1, lineHeight: 11.2 });
      }

      state.y -= 9;
    });
  }

  function drawProjects(state, projectList) {
    if (!projectList.length) {
      return;
    }

    drawSectionTitle(state, "Projects");

    projectList.forEach((entry) => {
      ensureVerticalSpace(state, 52);
      drawWrappedParagraph(state, entry.title || "Project", {
        font: bold,
        size: 10.5,
        lineHeight: 12.5
      });

      if (entry.technologies) {
        drawWrappedParagraph(state, `Tech Stack: ${entry.technologies}`, {
          size: 8.9,
          color: mutedColor,
          lineHeight: 10.8
        });
      }

      const bullets = bulletLines(entry.description);
      if (bullets.length) {
        drawBulletList(state, bullets, { size: 9.1, lineHeight: 11.2 });
      }

      state.y -= 9;
    });
  }

  drawEducation(leftState, resumeData.education);
  drawSkillSection(leftState, "Technical Skills", resumeData.technicalSkills);
  drawSkillSection(leftState, "Tools", resumeData.tools);
  drawSkillSection(leftState, "Soft Skills", resumeData.softSkills);

  drawExperience(rightState, resumeData.experience);
  drawProjects(rightState, resumeData.projects);
  drawSimpleBulletSection(rightState, "Certifications", resumeData.certifications);
  drawSimpleBulletSection(rightState, "Achievements", resumeData.achievements);
  drawSimpleBulletSection(rightState, "Extra Activities", resumeData.extraActivities);

  return pdfDoc.save();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "resume-generator" });
});

app.post("/improve-text", async (req, res) => {
  if (!openaiClient) {
    return res.status(400).json({
      success: false,
      message: "OPENAI_API_KEY is missing. Add it to use AI improvement."
    });
  }

  try {
    const resumeData = normalizeResumeData(req.body.resumeData);
    const prompt = buildImprovementPrompt(resumeData);

    const response = await openaiClient.responses.create({
      model: "gpt-4.1-mini",
      input: prompt
    });

    const parsed = parseJson(extractResponseText(response));

    res.json({
      success: true,
      data: {
        technicalSkills: compactText(parsed.technicalSkills),
        tools: compactText(parsed.tools),
        softSkills: compactText(parsed.softSkills),
        certifications: compactText(parsed.certifications),
        achievements: compactText(parsed.achievements),
        extraActivities: compactText(parsed.extraActivities),
        projects: normalizeCollection(parsed.projects, [
          "title",
          "description",
          "technologies"
        ]),
        experience: normalizeCollection(parsed.experience, [
          "company",
          "role",
          "duration",
          "description"
        ])
      }
    });
  } catch (error) {
    console.error("AI improvement failed:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Unable to improve the resume content."
    });
  }
});

app.post("/generate-resume", async (req, res) => {
  try {
    const resumeData = normalizeResumeData(req.body.resumeData);
    const payload = encodeResumePayload(resumeData);

    res.json({
      success: true,
      message: "Resume PDF created successfully.",
      downloadUrl: `/download-pdf?data=${encodeURIComponent(payload)}`
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Unable to generate the resume PDF."
    });
  }
});

app.get("/download-pdf", (req, res) => {
  const { data } = req.query;

  if (!data) {
    return res.status(400).json({
      success: false,
      message: "Resume data is missing. Generate the PDF again."
    });
  }

  Promise.resolve()
    .then(async () => {
      const resumeData = normalizeResumeData(decodeResumePayload(data));
      const pdfBytes = await createResumePdf(resumeData);
      const filename = `resume_${sanitizeFilename(resumeData.fullName)}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));
    })
    .catch((error) => {
      console.error("PDF download failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to generate the PDF download."
      });
    });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Resume Generator running on http://localhost:${port}`);
  });
}

module.exports = app;
