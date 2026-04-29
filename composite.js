/**
 * composite.js — Renders ASCII characters on top of a background image
 *
 * How it works:
 * 1. Draw the background image scaled to fill a canvas
 * 2. For each character in the ASCII grid, calculate its canvas position
 * 3. Draw the character as text at that position
 * 4. Character color is either:
 *    a) Theme color (dark/light based on current mode)
 *    b) Sampled from the original subject image pixel (color mode)
 *
 * The canvas dimensions are set to match the background image's natural size,
 * then we divide it into a grid of (cols × rows) cells and draw one character
 * per cell.
 *
 * FONT STRATEGY:
 *   We use a monospace font so each character takes the same cell width.
 *   Cell size = canvas.width / cols
 *   Font size is calculated from cell size so characters fill the cells.
 */

// ---------------------------------------------------------------------------
// drawComposite(asciiResult, bgImage, params)
//
//   asciiResult — { text, pixels, cols, rows } from imageToAsciiData()
//   bgImage     — HTMLImageElement of the uploaded background
//   params      — from getParams()
// ---------------------------------------------------------------------------
function drawComposite(asciiResult, bgImage, params) {
  const { text, pixels, cols, rows } = asciiResult;
  const isDark = document.body.classList.contains("dark");

  const canvas = document.getElementById("compositCanvas");
  const pre    = document.getElementById("asciiOut");

  // Show canvas, hide <pre>
  canvas.classList.remove("hidden");
  pre.classList.add("hidden");

  // Size the canvas to the background image's natural dimensions
  // (capped at a reasonable max for performance)
  const maxW = 1200;
  const scale = Math.min(1, maxW / bgImage.naturalWidth);
  canvas.width  = Math.floor(bgImage.naturalWidth  * scale);
  canvas.height = Math.floor(bgImage.naturalHeight * scale);

  const ctx = canvas.getContext("2d");

  // ── Step 1: Draw background ──────────────────────────────────
  ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

  // Optional: darken/lighten the background so ASCII is readable
  if (isDark) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ── Step 2: Calculate grid cell size ────────────────────────
  // Characters are roughly 0.6× as wide as they are tall in most mono fonts
  const cellW = canvas.width  / cols;
  const cellH = canvas.height / rows;

  // Font size: use cell width as the base, scale by ~1.6 for typical monospace
  // The exact multiplier depends on the font; 1.8 works well for Courier-style
  const fontSize = Math.max(4, Math.floor(cellW * 1.8));
  ctx.font      = `${fontSize}px 'Share Tech Mono', 'Courier New', monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // ── Step 3: Draw each character ──────────────────────────────
  let charIdx = 0;
  const lines = text.split("\n");

  for (let y = 0; y < rows; y++) {
    const line = lines[y] || "";
    for (let x = 0; x < cols; x++) {
      const char = line[x];
      if (!char || char === " ") { charIdx++; continue; }

      const px = pixels[charIdx++];

      // Determine character color
      if (params.color && px) {
        // Use color sampled from subject image
        ctx.fillStyle = `rgb(${px.r},${px.g},${px.b})`;
      } else if (isDark) {
        // Dark mode: bright green characters
        ctx.fillStyle = "rgba(0,255,65,0.92)";
      } else {
        // Light mode: dark characters
        ctx.fillStyle = "rgba(20,20,20,0.90)";
      }

      // Position: top-left of the cell
      const drawX = x * cellW;
      const drawY = y * cellH;
      ctx.fillText(char, drawX, drawY);
    }
  }
}

// ---------------------------------------------------------------------------
// savePng() — exports the current canvas output as a PNG download
// ---------------------------------------------------------------------------
function savePng() {
  const canvas = document.getElementById("compositCanvas");
  const pre    = document.getElementById("asciiOut");

  if (!canvas.classList.contains("hidden") && canvas.width > 0) {
    // Export the composite canvas
    canvas.toBlob(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ascii_art.png";
      a.click();
    });
  } else {
    // No background — render the <pre> text onto a canvas and export
    exportTextAsPng(pre.textContent || pre.innerText);
  }
}

// ---------------------------------------------------------------------------
// exportTextAsPng(text) — converts plain ASCII text to a PNG
// ---------------------------------------------------------------------------
function exportTextAsPng(text) {
  const isDark   = document.body.classList.contains("dark");
  const fontSize = parseInt(document.getElementById("fontSizeSlider").value) || 7;
  const lines    = text.split("\n").filter(l => l.length);
  if (!lines.length) return;

  const lineH  = Math.ceil(fontSize * 1.2);
  const charW  = fontSize * 0.6; // monospace approximation
  const width  = Math.ceil(lines[0].length * charW) + 16;
  const height = lines.length * lineH + 16;

  const offscreen = document.createElement("canvas");
  offscreen.width  = width;
  offscreen.height = height;
  const ctx = offscreen.getContext("2d");

  // Background
  ctx.fillStyle = isDark ? "#000000" : "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Text
  ctx.fillStyle = isDark ? "#00ff41" : "#1a1a1a";
  ctx.font = `${fontSize}px 'Courier New', monospace`;
  ctx.textBaseline = "top";

  lines.forEach((line, i) => {
    ctx.fillText(line, 8, 8 + i * lineH);
  });

  offscreen.toBlob(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ascii_art.png";
    a.click();
  });
}