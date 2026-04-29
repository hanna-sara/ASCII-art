/**
 * ascii.js — Core ASCII conversion engine (performance-optimised)
 *
 * PERFORMANCE FIXES APPLIED:
 *
 * FIX 1 — Array join instead of string concatenation
 *   Old code did:  text += char   (inside a loop of thousands of iterations)
 *   Problem: In JavaScript, strings are immutable. Every += creates a brand
 *   new string in memory and copies all the old characters into it. For a
 *   100×45 grid that's 4,500 copy operations, each one bigger than the last.
 *   Fix: push characters into an array, then join once at the end.
 *   Array.push is O(1). Array.join does one single allocation. Much faster.
 *
 * FIX 2 — Pre-computed lookup table for luminance → char index
 *   Old code computed:  Math.floor(lum * (charset.length - 1))  per pixel.
 *   Fix: pre-build a Uint8Array[256] that maps every possible byte value
 *   (0–255) directly to a charset index. The per-pixel work becomes one
 *   array lookup instead of a multiply + floor.
 *
 * FIX 3 — Color mode renders to canvas instead of thousands of DOM spans
 *   Old code built innerHTML with one <span> per character — up to 9,000
 *   DOM nodes at width=100. The browser had to parse, create, and layout
 *   all of them 8 times per second. Caused hard freezes.
 *   Fix: color mode now renders directly onto a canvas using fillText(),
 *   the same approach as composite mode. Zero DOM nodes, fully GPU-accelerated.
 *
 * FIX 4 — getContext with willReadFrequently hint
 *   Tells the browser this canvas will be read with getImageData() often,
 *   so it should keep the pixel data in CPU memory rather than GPU memory.
 *   Without this hint, each getImageData() causes a GPU→CPU transfer stall.
 */

// ---------------------------------------------------------------------------
// Character sets (light → dense)
// ---------------------------------------------------------------------------
const CHARSETS = [
  " .`'^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$", // STANDARD
  " .:+*oO0#@",                                                                 // DENSE
  " .-:=+*#@",                                                                  // MINIMAL
  " ░▒▓█",                                                                      // BLOCKS
  " 01"                                                                          // BINARY
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let lastAsciiString = "";
let lastPixelData   = null;
let currentMode     = "upload";

// Pre-computed lookup table: byte value 0-255 → charset index
// Rebuilt whenever the charset changes (cheap, only 256 entries)
let _charsetCache   = null;  // the charset string this table was built for
let _lookupTable    = null;  // Uint8Array[256]

function getLookupTable(charset) {
  if (_charsetCache === charset) return _lookupTable;
  _lookupTable  = new Uint8Array(256);
  const last    = charset.length - 1;
  for (let v = 0; v < 256; v++) {
    // v/255 * last, rounded down — same formula as before but pre-computed
    _lookupTable[v] = (v * last / 255) | 0;
  }
  _charsetCache = charset;
  return _lookupTable;
}

// ---------------------------------------------------------------------------
// getParams()
// ---------------------------------------------------------------------------
function getParams() {
  return {
    cols:     parseInt(document.getElementById("widthSlider").value),
    contrast: parseInt(document.getElementById("contrastSlider").value) / 100,
    charset:  CHARSETS[parseInt(document.getElementById("charsetSel").value)],
    invert:   document.getElementById("invertChk").checked,
    color:    document.getElementById("colorChk").checked,
  };
}

// ---------------------------------------------------------------------------
// imageToAsciiData(source, params) → { text, pixels, cols, rows }
// ---------------------------------------------------------------------------
function imageToAsciiData(source, params) {
  const { cols, contrast, charset, invert, color } = params;

  const srcW = source.videoWidth  || source.naturalWidth;
  const srcH = source.videoHeight || source.naturalHeight;
  if (!srcW || !srcH) return null;

  const rows = Math.floor(cols * (srcH / srcW) * 0.45);

  const cvs = document.getElementById("processingCanvas");

  // Only resize the canvas if dimensions actually changed — resizing clears
  // the canvas AND forces the browser to re-allocate its backing store.
  if (cvs.width !== cols || cvs.height !== rows) {
    cvs.width  = cols;
    cvs.height = rows;
  }

  // FIX 4: willReadFrequently tells the browser to keep pixels in CPU memory
  const ctx = cvs.getContext("2d", { willReadFrequently: true });

  ctx.filter = `contrast(${contrast}) grayscale(1)`;
  ctx.drawImage(source, 0, 0, cols, rows);
  ctx.filter = "none";

  const data   = ctx.getImageData(0, 0, cols, rows).data;
  const lookup = getLookupTable(charset);  // FIX 2: pre-computed table

  // FIX 1: use arrays + join instead of string concatenation
  const lines  = new Array(rows);
  // Only allocate pixels array if color mode is on — saves memory otherwise
  const pixels = color ? new Array(cols * rows) : null;

  for (let y = 0; y < rows; y++) {
    const row = new Array(cols);
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Perceived luminance — integer arithmetic only (faster than floats)
      // Formula: (r*299 + g*587 + b*114) / 1000  ≈ ITU-R BT.601
      let luma = (r * 299 + g * 587 + b * 114) / 1000;  // 0–255 range
      if (invert) luma = 255 - luma;

      const charIdx = lookup[luma | 0];  // |0 is faster than Math.floor
      row[x] = charset[charIdx];

      if (pixels) pixels[y * cols + x] = { r, g, b, char: charset[charIdx] };
    }
    lines[y] = row.join("");  // join each row once
  }

  return { text: lines.join("\n"), pixels, cols, rows };
}

// ---------------------------------------------------------------------------
// renderAscii() — main dispatcher
// ---------------------------------------------------------------------------
function renderAscii(sourceOverride) {
  const params = getParams();
  const hasBg  = (currentMode === "upload") ? !!window.uploadBgImage : !!window.cameraBgImage;

  let source = sourceOverride;
  if (!source) {
    if (currentMode === "upload") source = window.uploadSubjectImage;
    if (currentMode === "camera") source = document.getElementById("videoEl");
  }
  if (!source) return;

  const result = imageToAsciiData(source, params);
  if (!result) return;

  lastAsciiString = result.text;
  lastPixelData   = result.pixels;

  document.getElementById("outInfo").textContent =
    `// ${result.cols} × ${result.rows} chars //`;

  if (hasBg) {
    const bgImage = (currentMode === "upload") ? window.uploadBgImage : window.cameraBgImage;
    drawComposite(result, bgImage, params);
  } else {
    showPlainAscii(result, params);
  }
}

// ---------------------------------------------------------------------------
// showPlainAscii() — renders output
//   Mono mode  → fast textContent update on <pre>
//   Color mode → canvas-based rendering (FIX 3: no more DOM spans)
// ---------------------------------------------------------------------------
function showPlainAscii(result, params) {
  const pre    = document.getElementById("asciiOut");
  const canvas = document.getElementById("compositCanvas");

  if (!params.color) {
    // Fast mono path — one DOM write
    canvas.classList.add("hidden");
    pre.classList.remove("hidden");
    pre.textContent = result.text;
    return;
  }

  // Color path: render characters onto canvas with their sampled colors
  // This replaces the old innerHTML/<span> approach entirely
  pre.classList.add("hidden");
  canvas.classList.remove("hidden");

  const { pixels, cols, rows } = result;
  const fontSize = parseInt(document.getElementById("fontSizeSlider").value) || 7;

  // Size canvas to match the character grid at the current font size
  const cellW  = fontSize * 0.6;  // monospace character width
  const cellH  = fontSize * 1.2;  // line height

  canvas.width  = Math.ceil(cols * cellW);
  canvas.height = Math.ceil(rows * cellH);

  const ctx = canvas.getContext("2d");
  const isDark = document.body.classList.contains("dark");

  // Draw background
  ctx.fillStyle = isDark ? "#000" : "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font         = `${fontSize}px 'Share Tech Mono', 'Courier New', monospace`;
  ctx.textBaseline = "top";

  let idx = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = pixels[idx++];
      if (px.char === " ") continue;  // skip spaces — no draw needed
      ctx.fillStyle = `rgb(${px.r},${px.g},${px.b})`;
      ctx.fillText(px.char, x * cellW, y * cellH);
    }
  }
}

function escapeHtml(c) {
  if (c === "<") return "&lt;";
  if (c === ">") return "&gt;";
  if (c === "&") return "&amp;";
  return c;
}