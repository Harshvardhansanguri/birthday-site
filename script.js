const introScreen = document.getElementById("introScreen");
const openSurpriseBtn = document.getElementById("openSurpriseBtn");
const birthdaySong = document.getElementById("birthdaySong");
const musicToggle = document.getElementById("musicToggle");
const typewriterText = document.getElementById("typewriterText");
const floatingHearts = document.getElementById("floatingHearts");
const balloonField = document.getElementById("balloonField");
const candleButton = document.getElementById("candleButton");
const cakeScene = document.getElementById("cakeScene");
const wishStatus = document.getElementById("wishStatus");
const galleryItems = Array.from(document.querySelectorAll(".gallery-item"));
const memoryPhotos = Array.from(document.querySelectorAll(".memory-photo"));
const memoryModal = document.getElementById("memoryModal");
const modalImage = document.getElementById("modalImage");
const modalCaption = document.getElementById("modalCaption");
const closeModal = document.getElementById("closeModal");
const prevPhoto = document.getElementById("prevPhoto");
const nextPhoto = document.getElementById("nextPhoto");
const revealItems = document.querySelectorAll(".reveal");

const romanticMessage =
  "My love, every day with you feels softer, brighter, and more beautiful. I hope your birthday is filled with laughter, sweet surprises, warm hugs, and all the happiness your heart can hold.";

let typewriterStarted = false;
let currentPhotoIndex = 0;
let candleBlown = false;
let userPausedMusic = false;

function createPhotoPlaceholder(label) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff8f6" />
          <stop offset="100%" stop-color="#ffd8dd" />
        </linearGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#bg)" />
      <circle cx="230" cy="210" r="110" fill="rgba(255,255,255,0.55)" />
      <circle cx="610" cy="760" r="140" fill="rgba(255,201,111,0.30)" />
      <text x="400" y="450" text-anchor="middle" fill="#7d214f" font-size="42" font-family="Arial, sans-serif">
        Add Your Photo
      </text>
      <text x="400" y="520" text-anchor="middle" fill="#b0537b" font-size="32" font-family="Arial, sans-serif">
        ${label}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createFloatingHearts(count) {
  for (let index = 0; index < count; index += 1) {
    const heart = document.createElement("span");
    heart.className = "heart";
    heart.style.left = `${Math.random() * 100}%`;
    heart.style.animationDuration = `${10 + Math.random() * 10}s`;
    heart.style.animationDelay = `${Math.random() * 8}s`;
    heart.style.setProperty("--drift", `${-40 + Math.random() * 80}px`);
    heart.style.setProperty("--scale", `${0.7 + Math.random() * 1.3}`);
    floatingHearts.appendChild(heart);
  }
}

function createBalloons(count) {
  const colors = ["#ff8fab", "#ffcad4", "#ffd166", "#ffb3c6", "#ffc2d1", "#ff6f91"];

  for (let index = 0; index < count; index += 1) {
    const balloon = document.createElement("span");
    balloon.className = "balloon";
    balloon.style.left = `${Math.random() * 100}%`;
    balloon.style.animationDuration = `${13 + Math.random() * 9}s`;
    balloon.style.animationDelay = `${Math.random() * 10}s`;
    balloon.style.setProperty("--sway", `${-40 + Math.random() * 80}px`);
    balloon.style.setProperty("--balloon-color", colors[index % colors.length]);
    balloonField.appendChild(balloon);
  }
}

function updateMusicButton() {
  const isPlaying = !birthdaySong.paused;
  musicToggle.textContent = isPlaying ? "Pause Music" : "Play Music";
  musicToggle.setAttribute("aria-label", isPlaying ? "Pause background music" : "Play background music");
  musicToggle.setAttribute("aria-pressed", String(isPlaying));
}

async function tryPlayMusic() {
  try {
    await birthdaySong.play();
    updateMusicButton();
  } catch (error) {
    updateMusicButton();
  }
}

function typeMessage(text, index = 0) {
  if (index > text.length) {
    return;
  }

  typewriterText.textContent = text.slice(0, index);
  setTimeout(() => typeMessage(text, index + 1), 45);
}

function startTypewriter() {
  if (typewriterStarted) {
    return;
  }

  typewriterStarted = true;
  typeMessage(romanticMessage);
}

function openSurprise() {
  document.body.classList.add("experience-started");
  introScreen.classList.add("is-hidden");
  startTypewriter();

  if (!userPausedMusic) {
    tryPlayMusic();
  }
}

function createConfettiBurst() {
  const colors = ["#ff6f91", "#ffd166", "#ffb3c6", "#ffffff", "#ffc2d1", "#f06595"];

  for (let index = 0; index < 90; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDuration = `${3 + Math.random() * 2.2}s`;
    piece.style.animationDelay = `${Math.random() * 0.2}s`;
    piece.style.setProperty("--drift", `${-180 + Math.random() * 360}px`);
    document.body.appendChild(piece);

    piece.addEventListener("animationend", () => {
      piece.remove();
    });
  }
}

function blowOutCandle() {
  if (candleBlown) {
    return;
  }

  candleBlown = true;
  cakeScene.classList.add("is-blown");
  wishStatus.textContent = "Wish made. Candle blown. Heart officially overflowing.";
  createConfettiBurst();
}

function getPhotoData(index) {
  const image = galleryItems[index].querySelector("img");
  const label = galleryItems[index].querySelector("span").textContent;

  return {
    src: image.currentSrc || image.src,
    alt: image.alt,
    label
  };
}

function updateModal(index) {
  const photo = getPhotoData(index);
  modalImage.src = photo.src;
  modalImage.alt = photo.alt;
  modalCaption.textContent = photo.label;
}

function openModal(index) {
  currentPhotoIndex = index;
  updateModal(currentPhotoIndex);
  memoryModal.classList.add("is-open");
  memoryModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeGalleryModal() {
  memoryModal.classList.remove("is-open");
  memoryModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function showPhoto(step) {
  currentPhotoIndex = (currentPhotoIndex + step + galleryItems.length) % galleryItems.length;
  updateModal(currentPhotoIndex);
}

function setupGalleryFallbacks() {
  memoryPhotos.forEach((photo, index) => {
    photo.addEventListener("error", () => {
      photo.src = createPhotoPlaceholder(`Memory ${index + 1}`);
    });

    if (photo.complete && photo.naturalWidth === 0) {
      photo.src = createPhotoPlaceholder(`Memory ${index + 1}`);
    }
  });
}

function setupRevealAnimations() {
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.18
    }
  );

  revealItems.forEach((item) => observer.observe(item));
}

openSurpriseBtn.addEventListener("click", openSurprise);

musicToggle.addEventListener("click", async () => {
  if (birthdaySong.paused) {
    userPausedMusic = false;
    await tryPlayMusic();
    return;
  }

  userPausedMusic = true;
  birthdaySong.pause();
  updateMusicButton();
});

candleButton.addEventListener("click", blowOutCandle);

galleryItems.forEach((item, index) => {
  item.addEventListener("click", () => openModal(index));
});

closeModal.addEventListener("click", closeGalleryModal);
prevPhoto.addEventListener("click", () => showPhoto(-1));
nextPhoto.addEventListener("click", () => showPhoto(1));

memoryModal.addEventListener("click", (event) => {
  if (event.target === memoryModal) {
    closeGalleryModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && memoryModal.classList.contains("is-open")) {
    closeGalleryModal();
  }

  if (event.key === "ArrowRight" && memoryModal.classList.contains("is-open")) {
    showPhoto(1);
  }

  if (event.key === "ArrowLeft" && memoryModal.classList.contains("is-open")) {
    showPhoto(-1);
  }
});

birthdaySong.addEventListener("pause", updateMusicButton);
birthdaySong.addEventListener("play", updateMusicButton);

createFloatingHearts(16);
createBalloons(10);
setupGalleryFallbacks();
setupRevealAnimations();
updateMusicButton();
