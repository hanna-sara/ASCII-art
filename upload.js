/**
 * upload.js — Handles file uploads for subject image and background image
 *
 * Two upload slots:
 *   - Subject image  → stored in window.uploadSubjectImage (HTMLImageElement)
 *   - Background img → stored in window.uploadBgImage     (HTMLImageElement)
 *
 * Each slot supports:
 *   - Click-to-browse (via hidden <input type="file">)
 *   - Drag-and-drop onto the drop zone
 *
 * When either is loaded, renderAscii() is called to update output.
 *
 * OBJECT URL MANAGEMENT:
 *   We create object URLs via URL.createObjectURL() for fast, memory-local
 *   image loading. Old URLs are revoked when a new file replaces them.
 */

// Global image references (accessed by ascii.js and composite.js)
window.uploadSubjectImage = null;
window.uploadBgImage      = null;

let subjectObjectUrl = null;
let bgObjectUrl      = null;

// ---------------------------------------------------------------------------
// Wire up subject image input
// ---------------------------------------------------------------------------
document.getElementById("subjectFile").addEventListener("change", function () {
  if (this.files[0]) loadSubjectFile(this.files[0]);
});

// Wire up background image input
document.getElementById("bgFile").addEventListener("change", function () {
  if (this.files[0]) loadBgFile(this.files[0]);
});

// Camera bg input
document.getElementById("camBgFile").addEventListener("change", function () {
  if (this.files[0]) loadCamBgFile(this.files[0]);
});

// ---------------------------------------------------------------------------
// Drag-and-drop for subject drop zone
// ---------------------------------------------------------------------------
setupDropZone("subjectDrop", file => loadSubjectFile(file));
setupDropZone("bgDrop",      file => loadBgFile(file));
setupDropZone("camBgDrop",   file => loadCamBgFile(file));

// ---------------------------------------------------------------------------
// setupDropZone(zoneId, callback)
//   Adds dragover, dragleave, drop handlers to a drop zone element.
// ---------------------------------------------------------------------------
function setupDropZone(zoneId, callback) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  zone.addEventListener("dragover", e => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drag-over");
  });

  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      callback(file);
    }
  });
}

// ---------------------------------------------------------------------------
// loadSubjectFile(file) — loads a File into window.uploadSubjectImage
// ---------------------------------------------------------------------------
function loadSubjectFile(file) {
  // Revoke old object URL to free memory
  if (subjectObjectUrl) URL.revokeObjectURL(subjectObjectUrl);

  subjectObjectUrl = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    window.uploadSubjectImage = img;

    // Show thumbnail in the UI
    const thumb = document.getElementById("subjectPreview");
    thumb.src = subjectObjectUrl;
    thumb.classList.remove("hidden");

    // Switch to upload mode and re-render
    currentMode = "upload";
    renderAscii();
  };
  img.src = subjectObjectUrl;
}

// ---------------------------------------------------------------------------
// loadBgFile(file) — loads background image for upload mode
// ---------------------------------------------------------------------------
function loadBgFile(file) {
  if (bgObjectUrl) URL.revokeObjectURL(bgObjectUrl);

  bgObjectUrl = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    window.uploadBgImage = img;

    const thumb = document.getElementById("bgPreview");
    thumb.src = bgObjectUrl;
    thumb.classList.remove("hidden");

    document.getElementById("clearBgBtn").classList.remove("hidden");

    // Re-render to show composite view
    renderAscii();
  };
  img.src = bgObjectUrl;
}

// ---------------------------------------------------------------------------
// loadCamBgFile(file) — background image for camera mode
// ---------------------------------------------------------------------------
let camBgObjectUrl = null;

function loadCamBgFile(file) {
  if (camBgObjectUrl) URL.revokeObjectURL(camBgObjectUrl);

  camBgObjectUrl = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    window.cameraBgImage = img;

    const thumb = document.getElementById("camBgPreview");
    thumb.src = camBgObjectUrl;
    thumb.classList.remove("hidden");

    document.getElementById("clearCamBgBtn").classList.remove("hidden");
  };
  img.src = camBgObjectUrl;
}

// ---------------------------------------------------------------------------
// clearBg(mode) — removes the background image
// ---------------------------------------------------------------------------
function clearBg(mode) {
  if (mode === "upload") {
    window.uploadBgImage = null;
    if (bgObjectUrl) { URL.revokeObjectURL(bgObjectUrl); bgObjectUrl = null; }

    document.getElementById("bgPreview").classList.add("hidden");
    document.getElementById("bgPreview").src = "";
    document.getElementById("clearBgBtn").classList.add("hidden");
  } else {
    window.cameraBgImage = null;
    if (camBgObjectUrl) { URL.revokeObjectURL(camBgObjectUrl); camBgObjectUrl = null; }

    document.getElementById("camBgPreview").classList.add("hidden");
    document.getElementById("camBgPreview").src = "";
    document.getElementById("clearCamBgBtn").classList.add("hidden");
  }

  // Go back to plain text mode
  document.getElementById("compositCanvas").classList.add("hidden");
  document.getElementById("asciiOut").classList.remove("hidden");
  renderAscii();
}