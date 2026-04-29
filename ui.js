/**
 * ui.js — UI controls: theme switching, tab switching, export utilities
 *
 * This file wires up all user interactions that aren't part of the core
 * ASCII engine. It's kept separate so each concern has its own file.
 */

// ---------------------------------------------------------------------------
// Theme toggle — switches between body.dark and body.light
//
// How it works:
//   body.dark  = default (black bg, green text — terminal aesthetic)
//   body.light = "day mode" (off-white bg, near-black text — print aesthetic)
//
//   On switch:
//   - Toggle the CSS class on <body>
//   - Persist preference to localStorage so it survives page refresh
//   - Re-render ASCII so composite canvas uses correct text colors
// ---------------------------------------------------------------------------
function toggleTheme() {
  const body     = document.body;
  const icon     = document.getElementById("themeIcon");
  const label    = document.getElementById("themeLabel");

  const isNowDark = body.classList.toggle("dark");
  body.classList.toggle("light", !isNowDark);

  if (isNowDark) {
    icon.textContent  = "☀";
    label.textContent = "DAY MODE";
  } else {
    icon.textContent  = "◑";
    label.textContent = "NIGHT MODE";
  }

  localStorage.setItem("ascii-studio-theme", isNowDark ? "dark" : "light");

  // Re-render to update composite canvas colors
  renderAscii();
}

// Restore saved theme on load
(function restoreTheme() {
  const saved = localStorage.getItem("ascii-studio-theme");
  if (saved === "light") {
    document.body.classList.remove("dark");
    document.body.classList.add("light");
    document.getElementById("themeIcon").textContent  = "◑";
    document.getElementById("themeLabel").textContent = "NIGHT MODE";
  }
})();

// ---------------------------------------------------------------------------
// Tab switching — upload ↔ camera
//
// Switching to camera stops the upload render cycle.
// Switching to upload stops the camera if it's running.
// ---------------------------------------------------------------------------
function switchTab(mode) {
  currentMode = mode;

  // Update tab buttons
  document.getElementById("tabUpload").classList.toggle("active", mode === "upload");
  document.getElementById("tabCamera").classList.toggle("active", mode === "camera");

  // Show/hide panels
  document.getElementById("uploadPanel").classList.toggle("hidden", mode !== "upload");
  document.getElementById("cameraPanel").classList.toggle("hidden", mode !== "camera");

  // Stop camera if switching away from it
  if (mode !== "camera" && cameraStream) stopCamera();

  // If switching back to upload, re-render the subject image
  if (mode === "upload" && window.uploadSubjectImage) renderAscii();
}

// ---------------------------------------------------------------------------
// syncVal(sliderId, outputId, suffix) — keeps range slider labels in sync
// ---------------------------------------------------------------------------
function syncVal(sliderId, outputId, suffix = "") {
  const val = document.getElementById(sliderId).value;
  document.getElementById(outputId).textContent = val + suffix;
}

// ---------------------------------------------------------------------------
// applyFontSize() — updates the <pre> font size from the slider
// ---------------------------------------------------------------------------
function applyFontSize() {
  const size = document.getElementById("fontSizeSlider").value;
  document.getElementById("asciiOut").style.fontSize = size + "px";
}

// ---------------------------------------------------------------------------
// copyAscii() — copies the ASCII text to clipboard
// ---------------------------------------------------------------------------
function copyAscii() {
  if (!lastAsciiString) return;

  navigator.clipboard.writeText(lastAsciiString).then(() => {
    const btn = document.querySelector(".out-btn");
    const original = btn.textContent;
    btn.textContent = "[ COPIED! ]";
    setTimeout(() => (btn.textContent = original), 1500);
  }).catch(err => {
    console.error("Clipboard write failed:", err);
  });
}

// ---------------------------------------------------------------------------
// saveTxt() — downloads the ASCII text as a .txt file
// ---------------------------------------------------------------------------
function saveTxt() {
  if (!lastAsciiString || lastAsciiString.startsWith("//")) return;

  const blob = new Blob([lastAsciiString], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  triggerDownload(url, "ascii_art.txt");
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// triggerDownload(url, filename) — helper to trigger a file download
// ---------------------------------------------------------------------------
function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}