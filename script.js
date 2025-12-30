// DocFix – client-side image resize & compress with drag & drop

const modeTabs = document.querySelectorAll("#modeTabs .tab");
const presetLabel = document.getElementById("presetLabel");
const fileInput = document.getElementById("fileInput");
const fileMeta = document.getElementById("fileMeta");
const fileDropZone = document.getElementById("fileDropZone");
const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const maxKbInput = document.getElementById("maxKbInput");
const minKbInput = document.getElementById("minKbInput");
const formatSelect = document.getElementById("formatSelect");
const fitModeSelect = document.getElementById("fitMode");
const qualityPresetSelect = document.getElementById("qualityPreset");
const bgChips = document.querySelectorAll("#bgChips .chip");
const bgColorCustom = document.getElementById("bgColorCustom");
const processBtn = document.getElementById("processBtn");
const downloadBtn = document.getElementById("downloadBtn");
const errorBox = document.getElementById("errorBox");
const infoBox = document.getElementById("infoBox");
const inputPreview = document.getElementById("inputPreview");
const inputPlaceholder = document.getElementById("inputPlaceholder");
const inputMeta = document.getElementById("inputMeta");
const outputCanvas = document.getElementById("outputCanvas");
const outputMeta = document.getElementById("outputMeta");
const outputPlaceholder = document.getElementById("outputPlaceholder");

let loadedImage = null;
let loadedFileName = null;
let lastBlob = null;
let currentBgColor = "#ffffff";

// ----- Mode presets -----

function applyModePreset(mode) {
  if (mode === "photo") {
    widthInput.value = 200;
    heightInput.value = 230;
    maxKbInput.value = 50;
    minKbInput.value = 20;
    formatSelect.value = "image/jpeg";
    presetLabel.textContent = "Preset: Exam-style passport photo (200×230, 20–50 KB, JPG)";
    setBgChip("#ffffff");
  } else if (mode === "signature") {
    widthInput.value = 140;
    heightInput.value = 60;
    maxKbInput.value = 20;
    minKbInput.value = 5;
    formatSelect.value = "image/jpeg";
    presetLabel.textContent = "Preset: Signature scan (140×60, 5–20 KB, JPG)";
    setBgChip("#ffffff");
  } else {
    presetLabel.textContent = "Preset: Custom – choose your own dimensions & limits";
  }
}

modeTabs.forEach(btn => {
  btn.addEventListener("click", () => {
    modeTabs.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const mode = btn.dataset.mode;
    applyModePreset(mode);
  });
});

// ----- Background chips -----

function setBgChip(colorValue) {
  bgChips.forEach(chip => {
    chip.classList.toggle("chip--active", chip.dataset.color === colorValue);
  });
  if (colorValue !== "custom") {
    currentBgColor = colorValue;
    bgColorCustom.value = colorValue;
  } else {
    currentBgColor = bgColorCustom.value;
  }
}

bgChips.forEach(chip => {
  chip.addEventListener("click", () => {
    const color = chip.dataset.color;
    bgChips.forEach(c => c.classList.remove("chip--active"));
    chip.classList.add("chip--active");
    if (color === "custom") {
      currentBgColor = bgColorCustom.value;
    } else {
      currentBgColor = color;
      bgColorCustom.value = color;
    }
  });
});

bgColorCustom.addEventListener("input", () => {
  const customChip = Array.from(bgChips).find(c => c.dataset.color === "custom");
  bgChips.forEach(c => c.classList.remove("chip--active"));
  if (customChip) customChip.classList.add("chip--active");
  currentBgColor = bgColorCustom.value;
});

// ----- File handling -----

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    handleFile(file);
  }
});

// Drag & drop support
;["dragenter", "dragover"].forEach(eventName => {
  fileDropZone.addEventListener(eventName, e => {
    e.preventDefault();
    e.stopPropagation();
    fileDropZone.classList.add("drag-over");
  });
});

;["dragleave", "dragend", "drop"].forEach(eventName => {
  fileDropZone.addEventListener(eventName, e => {
    e.preventDefault();
    e.stopPropagation();
    if (eventName !== "drop") {
      fileDropZone.classList.remove("drag-over");
    }
  });
});

fileDropZone.addEventListener("drop", e => {
  const dt = e.dataTransfer;
  const file = dt && dt.files && dt.files[0];
  fileDropZone.classList.remove("drag-over");
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showError("Please drop a valid image file.");
    return;
  }
  handleFile(file);
});

function handleFile(file) {
  clearMessages();
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      loadedImage = img;
      loadedFileName = file.name || "image";
      inputPreview.src = e.target.result;
      inputPreview.style.display = "block";
      inputPlaceholder.style.display = "none";
      const kb = (file.size / 1024).toFixed(1);
      inputMeta.textContent = `${img.width} × ${img.height}px • ${kb} KB • ${file.type || "image"}`;
      fileMeta.textContent = `Loaded: ${file.name} (${kb} KB)`;
      // reset output
      outputCanvas.getContext("2d").clearRect(0, 0, outputCanvas.width, outputCanvas.height);
      outputPlaceholder.style.display = "flex";
      outputMeta.textContent = "—";
      lastBlob = null;
      downloadBtn.disabled = true;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ----- UI helpers -----

function showError(msg) {
  errorBox.style.display = "block";
  errorBox.textContent = msg;
  infoBox.style.display = "none";
}

function showInfo(msg) {
  infoBox.style.display = "block";
  infoBox.textContent = msg;
  errorBox.style.display = "none";
}

function clearMessages() {
  errorBox.style.display = "none";
  infoBox.style.display = "none";
}

// ----- Processing -----

processBtn.addEventListener("click", async () => {
  clearMessages();

  if (!loadedImage) {
    showError("Please upload an image first.");
    return;
  }

  const targetW = parseInt(widthInput.value, 10);
  const targetH = parseInt(heightInput.value, 10);
  const maxKb = parseFloat(maxKbInput.value);
  const minKb = parseFloat(minKbInput.value) || 0;
  const format = formatSelect.value;
  const fitMode = fitModeSelect.value;
  const qualityPreset = qualityPresetSelect.value;

  if (!targetW || !targetH || targetW <= 0 || targetH <= 0) {
    showError("Width and height must be positive numbers.");
    return;
  }

  if (!maxKb || maxKb <= 0) {
    showError("Please set a valid max size in KB.");
    return;
  }

  const canvas = outputCanvas;
  const ctx = canvas.getContext("2d");
  canvas.width = targetW;
  canvas.height = targetH;

  ctx.fillStyle = currentBgColor || "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);

  const iw = loadedImage.width;
  const ih = loadedImage.height;

  let drawW, drawH, dx, dy;

  const scaleContain = Math.min(targetW / iw, targetH / ih);
  const scaleCover = Math.max(targetW / iw, targetH / ih);

  if (fitMode === "cover") {
    const s = scaleCover;
    drawW = iw * s;
    drawH = ih * s;
  } else {
    const s = scaleContain;
    drawW = iw * s;
    drawH = ih * s;
  }

  dx = (targetW - drawW) / 2;
  dy = (targetH - drawH) / 2;

  ctx.drawImage(loadedImage, dx, dy, drawW, drawH);

  outputPlaceholder.style.display = "none";

  try {
    const { blob, sizeKb, finalQuality } = await compressToTarget(canvas, format, maxKb, qualityPreset);

    lastBlob = blob;
    downloadBtn.disabled = false;

    const minNote =
      minKb > 0 && sizeKb < minKb
        ? ` Note: result is below your min ${minKb.toFixed(0)} KB target.`
        : "";

    outputMeta.textContent = `${targetW} × ${targetH}px • ${sizeKb.toFixed(1)} KB • ${formatLabel(format)}${minNote}`;
    showInfo(
      `Done. Output is ~${sizeKb.toFixed(1)} KB using quality ${
        finalQuality != null ? finalQuality.toFixed(2) : "default"
      }.${minNote}`
    );
  } catch (err) {
    console.error(err);
    showError("Failed to generate output. Try a higher max KB or smaller dimensions.");
  }
});

downloadBtn.addEventListener("click", () => {
  if (!lastBlob) return;
  const ext = extensionForFormat(formatSelect.value);
  const base = (loadedFileName || "docfix-image").replace(/\.[^.]+$/, "");
  const fileName = `${base}-docfix.${ext}`;
  const url = URL.createObjectURL(lastBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// compression helper
function extensionForFormat(fmt) {
  if (fmt === "image/png") return "png";
  if (fmt === "image/webp") return "webp";
  return "jpg";
}

function formatLabel(fmt) {
  if (fmt === "image/png") return "PNG";
  if (fmt === "image/webp") return "WebP";
  return "JPEG";
}

function toBlobAsync(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) reject(new Error("toBlob() returned null"));
        else resolve(blob);
      },
      type,
      quality
    );
  });
}

async function compressToTarget(canvas, format, maxKb, qualityPreset) {
  if (format === "image/png") {
    const blob = await toBlobAsync(canvas, format);
    const sizeKb = blob.size / 1024;
    return { blob, sizeKb, finalQuality: null };
  }

  let startQuality = 0.9;
  let minQuality = 0.4;

  if (qualityPreset === "high") {
    startQuality = 0.95;
    minQuality = 0.6;
  } else if (qualityPreset === "small") {
    startQuality = 0.8;
    minQuality = 0.3;
  }

  let q = startQuality;
  let bestBlob = null;
  let bestSize = Infinity;
  let bestQ = null;

  for (let i = 0; i < 10; i++) {
    const blob = await toBlobAsync(canvas, format, q);
    const sizeKb = blob.size / 1024;
    if (sizeKb <= maxKb) {
      bestBlob = blob;
      bestSize = sizeKb;
      bestQ = q;
      break;
    }
    if (sizeKb < bestSize) {
      bestBlob = blob;
      bestSize = sizeKb;
      bestQ = q;
    }
    q -= 0.08;
    if (q < minQuality) break;
  }

  if (!bestBlob) {
    throw new Error("Could not compress to target.");
  }

  return { blob: bestBlob, sizeKb: bestSize, finalQuality: bestQ };
}

// Initialize default mode
applyModePreset("photo");
