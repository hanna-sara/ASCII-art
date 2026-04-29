/**
 * camera.js — Live webcam capture and real-time ASCII rendering (optimised)
 *
 * PERFORMANCE FIXES APPLIED:
 *
 * FIX 5 — Frame-skipping with isRendering flag
 *   Old code: setInterval fired every 125ms regardless of whether the previous
 *   render had finished. If rendering takes 200ms (e.g. at high width), the
 *   next frame starts before the first is done. They pile up in the JS event
 *   queue and the page freezes.
 *   Fix: a boolean flag `isRendering` is set true when a render starts and
 *   false when it ends. If the interval fires and isRendering is still true,
 *   the frame is simply skipped. The page stays responsive at all times.
 *
 * FIX 6 — requestAnimationFrame instead of setInterval
 *   setInterval has no awareness of the browser's repaint cycle. It can fire
 *   in the middle of a frame render, causing tearing or double work.
 *   requestAnimationFrame (rAF) is the browser's native animation loop — it
 *   fires exactly once per display refresh (60fps), always before a repaint,
 *   and automatically pauses when the tab is hidden (saves CPU/battery).
 *   We use rAF as the outer loop but throttle renders to CAMERA_FPS ourselves.
 *
 * FIX 7 — Low-resolution cap on camera request
 *   Requesting ideal: 640px was fine, but some cameras default to 1080p or
 *   higher, which makes the canvas draw step slow. We now explicitly cap at
 *   max: 640 so the browser never gives us more pixels than we need.
 *
 * FIX 8 — willReadFrequently on the output canvas context
 *   The color-mode output canvas is now also created with willReadFrequently
 *   where applicable (handled in ascii.js).
 */

let cameraStream    = null;
let animFrameHandle = null;   // requestAnimationFrame handle (replaces setInterval)
let isRendering     = false;  // FIX 5: frame-skip guard
let lastFrameTime   = 0;      // timestamp of last rendered frame

window.cameraBgImage = null;

// Target milliseconds between frames — 10fps is plenty for ASCII art
// and leaves plenty of CPU headroom for the render itself.
const FRAME_INTERVAL_MS = 100; // 10fps

// ---------------------------------------------------------------------------
// toggleCamera()
// ---------------------------------------------------------------------------
async function toggleCamera() {
  if (cameraStream) {
    stopCamera();
  } else {
    await startCamera();
  }
}

// ---------------------------------------------------------------------------
// startCamera()
// ---------------------------------------------------------------------------
async function startCamera() {
  const statusEl = document.getElementById("camStatus");
  const btnEl    = document.getElementById("camToggleBtn");
  const wrapEl   = document.getElementById("camWrap");
  const videoEl  = document.getElementById("videoEl");

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width:  { ideal: 640, max: 640 },  // FIX 7: hard cap at 640px
        height: { ideal: 480, max: 480 },
      },
      audio: false,
    });

    videoEl.srcObject = cameraStream;

    videoEl.onloadedmetadata = () => {
      videoEl.play();
      wrapEl.classList.remove("hidden");
      btnEl.textContent = "STOP CAMERA";
      statusEl.innerHTML = '<span class="live-dot"></span>CAMERA LIVE';

      // FIX 6: start the rAF loop instead of setInterval
      startRenderLoop(videoEl);
    };

  } catch (err) {
    let msg = "[ CAMERA ERROR ]";
    if (err.name === "NotAllowedError")  msg = "[ PERMISSION DENIED — ALLOW CAMERA ACCESS ]";
    if (err.name === "NotFoundError")    msg = "[ NO CAMERA FOUND ]";
    if (err.name === "NotReadableError") msg = "[ CAMERA IN USE BY ANOTHER APP ]";
    statusEl.textContent = msg;
    console.error("Camera error:", err);
  }
}

// ---------------------------------------------------------------------------
// startRenderLoop(videoEl)
//   Uses requestAnimationFrame for the outer loop, throttled to FRAME_INTERVAL_MS.
//   Frame-skipping ensures renders never pile up.
// ---------------------------------------------------------------------------
function startRenderLoop(videoEl) {
  function loop(timestamp) {
    // Always re-schedule next frame first, so the loop continues even if
    // this frame is skipped or throws
    animFrameHandle = requestAnimationFrame(loop);

    // Only in camera mode
    if (currentMode !== "camera") return;

    // Throttle to our target FPS
    if (timestamp - lastFrameTime < FRAME_INTERVAL_MS) return;

    // FIX 5: skip this frame if the previous render hasn't finished
    if (isRendering) return;

    lastFrameTime = timestamp;
    isRendering   = true;

    try {
      renderAscii(videoEl);
    } finally {
      // Always clear the flag, even if renderAscii throws
      isRendering = false;
    }
  }

  animFrameHandle = requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// stopCamera()
// ---------------------------------------------------------------------------
function stopCamera() {
  // Cancel the animation frame loop
  if (animFrameHandle) {
    cancelAnimationFrame(animFrameHandle);
    animFrameHandle = null;
  }

  // Release the camera hardware
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  isRendering   = false;
  lastFrameTime = 0;

  const wrapEl   = document.getElementById("camWrap");
  const btnEl    = document.getElementById("camToggleBtn");
  const statusEl = document.getElementById("camStatus");
  const videoEl  = document.getElementById("videoEl");

  wrapEl.classList.add("hidden");
  btnEl.textContent    = "START CAMERA";
  statusEl.textContent = "[ CAMERA OFFLINE ]";
  videoEl.srcObject    = null;
}