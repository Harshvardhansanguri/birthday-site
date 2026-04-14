# Romantic Birthday Website

A romantic, mobile-friendly birthday surprise website built with vanilla HTML, CSS, and JavaScript.

## Files

- `public/index.html`
- `public/style.css`
- `public/script.js`

## Add Your Music

Place your song inside `/public` and name it:

```text
music.mp3
```

## Add Your Photos

Place your photos inside `/public` and name them:

```text
img1.jpg
img2.jpg
img3.jpg
img4.jpg
img5.jpg
img6.jpg
```

If the images are missing, the page will show soft placeholders until you replace them.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start the local server:

```bash
npm start
```

3. Open:

```text
http://localhost:3000
```

## Deploy On GitHub Pages

GitHub Pages only serves static files, so copy the contents of `/public` into your repository root or a `/docs` folder before enabling Pages.

1. Copy `index.html`, `style.css`, `script.js`, `music.mp3`, and your images from `/public`.
2. Paste them into the repo root or `/docs`.
3. Push the repo to GitHub.
4. Open `Settings > Pages`.
5. Choose `Deploy from a branch`.
6. Select your branch and the folder you used: `/root` or `/docs`.
7. Save and wait for the live link.
