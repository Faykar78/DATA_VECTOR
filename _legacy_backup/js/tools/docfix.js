
// Logic from docfix/script.js adapted for module usage
// We use 'df-' prefix for classes to avoid conflicts with main site styles.

const DocFix = {
    render: (container) => {
        // Inject CSS if not present
        if (!document.getElementById('docfix-style')) {
            const link = document.createElement('link');
            link.id = 'docfix-style';
            link.rel = 'stylesheet';
            link.href = 'css/docfix.css';
            document.head.appendChild(link);
        }

        container.innerHTML = `
    <div class="df-shell">
      <!-- (Optional) internal hero removed to fit into existing tool layout -->
      
      <section class="df-panel-grid">
        <section class="df-panel df-panel--main">
          <div class="df-panel-header">
            <div class="df-tabs" id="dfModeTabs">
              <button class="df-tab active" data-mode="photo">Photo</button>
              <button class="df-tab" data-mode="signature">Signature</button>
              <button class="df-tab" data-mode="custom">Custom</button>
            </div>
            <span class="df-preset-label" id="dfPresetLabel">Preset: Exam-style passport photo</span>
          </div>

          <div class="df-grid-2">
            <div class="df-field-group">
              <label class="df-field-label">Upload image</label>
              <label class="df-file-drop" id="dfFileDrop">
                <input type="file" id="dfFileInput" accept="image/*" hidden />
                <div class="df-file-drop-inner" id="dfFileDropZone">
                  <div class="df-file-icon">📁</div>
                  <div>
                    <div class="df-file-title">Drop an image here or click to browse</div>
                    <div class="df-file-hint">JPG, PNG or WebP</div>
                  </div>
                </div>
              </label>
              <div class="df-file-meta" id="dfFileMeta">No file selected.</div>
            </div>

            <div class="df-field-group">
              <label class="df-field-label">Output options</label>
              <div class="df-field-row">
                <div class="df-field">
                  <span class="df-field-caption">Width (px)</span>
                  <input type="number" id="dfWidthInput" min="10" value="200" />
                </div>
                <div class="df-field">
                  <span class="df-field-caption">Height (px)</span>
                  <input type="number" id="dfHeightInput" min="10" value="230" />
                </div>
              </div>

              <div class="df-field-row">
                <div class="df-field">
                  <span class="df-field-caption">Max size (KB)</span>
                  <input type="number" id="dfMaxKbInput" min="1" value="50" />
                </div>
                <div class="df-field">
                  <span class="df-field-caption">Min size (KB) <span class="df-muted">(optional)</span></span>
                  <input type="number" id="dfMinKbInput" min="0" placeholder="e.g. 20" />
                </div>
              </div>

              <div class="df-field-row">
                <div class="df-field">
                  <span class="df-field-caption">Format</span>
                  <select id="dfFormatSelect">
                    <option value="image/jpeg">JPEG (.jpg)</option>
                    <option value="image/png">PNG (.png)</option>
                    <option value="image/webp">WebP (.webp)</option>
                  </select>
                </div>
                <div class="df-field">
                  <span class="df-field-caption">Background</span>
                  <div class="df-chip-row" id="dfBgChips">
                    <button class="df-chip df-chip--active" data-color="#ffffff">White</button>
                    <button class="df-chip" data-color="#e0f2fe">Light blue</button>
                    <button class="df-chip" data-color="custom">Custom</button>
                    <input type="color" id="dfBgColorCustom" value="#ffffff" class="df-color-input" />
                  </div>
                </div>
              </div>

              <div class="df-field-row">
                <div class="df-field">
                  <span class="df-field-caption">Fit mode</span>
                  <select id="dfFitMode">
                    <option value="contain">Contain (no crop)</option>
                    <option value="cover">Cover (center crop)</option>
                  </select>
                </div>
                <div class="df-field">
                  <span class="df-field-caption">Edge smoothing</span>
                  <select id="dfQualityPreset">
                    <option value="high">High quality</option>
                    <option value="balanced" selected>Balanced</option>
                    <option value="small">Smaller size</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="df-actions-row">
            <button id="dfProcessBtn" class="df-btn-primary">
              <span>⚙️ Generate output</span>
            </button>
            <button id="dfDownloadBtn" class="df-btn-ghost" disabled>
              ⬇️ Download result
            </button>
          </div>

          <div id="dfErrorBox" class="df-alert df-alert--error" style="display:none;"></div>
          <div id="dfInfoBox" class="df-alert df-alert--info" style="display:none;"></div>
        </section>

        <section class="df-panel df-panel--side">
          <h2 class="df-panel-title">Preview &amp; stats</h2>
          <div class="df-preview-grid">
            <div class="df-preview-card">
              <h3>Input</h3>
              <div class="df-preview-frame">
                <img id="dfInputPreview" alt="Input preview" />
                <span class="df-preview-placeholder" id="dfInputPlaceholder">No image loaded</span>
              </div>
              <div class="df-preview-meta" id="dfInputMeta">—</div>
            </div>
            <div class="df-preview-card">
              <h3>Output</h3>
              <div class="df-preview-frame">
                <canvas id="dfOutputCanvas"></canvas>
                <span class="df-preview-placeholder" id="dfOutputPlaceholder">Generate to see result</span>
              </div>
              <div class="df-preview-meta" id="dfOutputMeta">—</div>
            </div>
          </div>
        </section>
      </section>
    </div>
        `;

        DocFix.initLogic(container);
    },

    initLogic: (container) => {
        // IDs are prefixed with df
        const get = (id) => container.querySelector('#' + id);
        const getAll = (sel) => container.querySelectorAll(sel);

        const modeTabs = getAll("#dfModeTabs .df-tab");
        const presetLabel = get("dfPresetLabel");
        const fileInput = get("dfFileInput");
        const fileMeta = get("dfFileMeta");
        const fileDropZone = get("dfFileDropZone"); // Correction: listener on the drop zone or label? 
        // Original logic: label wraps input. 
        const fileDropLabel = get("dfFileDrop");

        const widthInput = get("dfWidthInput");
        const heightInput = get("dfHeightInput");
        const maxKbInput = get("dfMaxKbInput");
        const minKbInput = get("dfMinKbInput");
        const formatSelect = get("dfFormatSelect");
        const fitModeSelect = get("dfFitMode");
        const qualityPresetSelect = get("dfQualityPreset");

        const bgChips = getAll("#dfBgChips .df-chip");
        const bgColorCustom = get("dfBgColorCustom");

        const processBtn = get("dfProcessBtn");
        const downloadBtn = get("dfDownloadBtn");
        const errorBox = get("dfErrorBox");
        const infoBox = get("dfInfoBox");

        const inputPreview = get("dfInputPreview");
        const inputPlaceholder = get("dfInputPlaceholder");
        const inputMeta = get("dfInputMeta");

        const outputCanvas = get("dfOutputCanvas");
        const outputMeta = get("dfOutputMeta");
        const outputPlaceholder = get("dfOutputPlaceholder");

        let loadedImage = null;
        let loadedFileName = null;
        let lastBlob = null;
        let currentBgColor = "#ffffff";

        // Logic Functions
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

        function setBgChip(colorValue) {
            bgChips.forEach(chip => {
                chip.classList.toggle("df-chip--active", chip.dataset.color === colorValue);
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
                bgChips.forEach(c => c.classList.remove("df-chip--active"));
                chip.classList.add("df-chip--active");
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
            bgChips.forEach(c => c.classList.remove("df-chip--active"));
            if (customChip) customChip.classList.add("df-chip--active");
            currentBgColor = bgColorCustom.value;
        });

        // File Handling
        fileInput.addEventListener("change", () => {
            const file = fileInput.files[0];
            if (file) handleFile(file);
        });

        const dropEl = fileDropLabel;
        ["dragenter", "dragover"].forEach(eventName => {
            dropEl.addEventListener(eventName, e => {
                e.preventDefault(); e.stopPropagation();
                fileDropZone.classList.add("drag-over");
            });
        });
        ["dragleave", "dragend", "drop"].forEach(eventName => {
            dropEl.addEventListener(eventName, e => {
                e.preventDefault(); e.stopPropagation();
                if (eventName !== "drop") fileDropZone.classList.remove("drag-over");
            });
        });

        dropEl.addEventListener("drop", e => {
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

        // Processing Logic (Identical to original script.js except element references)
        processBtn.addEventListener("click", async () => {
            clearMessages();
            if (!loadedImage) { showError("Please upload an image first."); return; }

            const targetW = parseInt(widthInput.value, 10);
            const targetH = parseInt(heightInput.value, 10);
            const maxKb = parseFloat(maxKbInput.value);
            const minKb = parseFloat(minKbInput.value) || 0;
            const format = formatSelect.value;
            const fitMode = fitModeSelect.value;
            const qualityPreset = qualityPresetSelect.value;

            if (!targetW || !targetH || targetW <= 0 || targetH <= 0) {
                showError("Width and height must be positive numbers."); return;
            }
            if (!maxKb || maxKb <= 0) {
                showError("Please set a valid max size in KB."); return;
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
                drawW = iw * s; drawH = ih * s;
            } else {
                const s = scaleContain;
                drawW = iw * s; drawH = ih * s;
            }

            dx = (targetW - drawW) / 2;
            dy = (targetH - drawH) / 2;
            ctx.drawImage(loadedImage, dx, dy, drawW, drawH);

            outputPlaceholder.style.display = "none";

            try {
                const { blob, sizeKb, finalQuality } = await compressToTarget(canvas, format, maxKb, qualityPreset);
                lastBlob = blob;
                downloadBtn.disabled = false;

                const minNote = minKb > 0 && sizeKb < minKb ? ` Note: result is below your min ${minKb.toFixed(0)} KB target.` : "";
                outputMeta.textContent = `${targetW} × ${targetH}px • ${sizeKb.toFixed(1)} KB • ${formatLabel(format)}${minNote}`;
                showInfo(`Done. Output is ~${sizeKb.toFixed(1)} KB using quality ${finalQuality != null ? finalQuality.toFixed(2) : "default"}.${minNote}`);
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

        // Helpers
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
                canvas.toBlob(blob => {
                    if (!blob) reject(new Error("toBlob() returned null"));
                    else resolve(blob);
                }, type, quality);
            });
        }
        async function compressToTarget(canvas, format, maxKb, qualityPreset) {
            if (format === "image/png") {
                const blob = await toBlobAsync(canvas, format);
                const sizeKb = blob.size / 1024;
                return { blob, sizeKb, finalQuality: null };
            }
            let startQuality = 0.9, minQuality = 0.4;
            if (qualityPreset === "high") { startQuality = 0.95; minQuality = 0.6; }
            else if (qualityPreset === "small") { startQuality = 0.8; minQuality = 0.3; }

            let q = startQuality, bestBlob = null, bestSize = Infinity, bestQ = null;
            for (let i = 0; i < 10; i++) {
                const blob = await toBlobAsync(canvas, format, q);
                const sizeKb = blob.size / 1024;
                if (sizeKb <= maxKb) { bestBlob = blob; bestSize = sizeKb; bestQ = q; break; }
                if (sizeKb < bestSize) { bestBlob = blob; bestSize = sizeKb; bestQ = q; }
                q -= 0.08;
                if (q < minQuality) break;
            }
            if (!bestBlob) throw new Error("Could not compress to target.");
            return { blob: bestBlob, sizeKb: bestSize, finalQuality: bestQ };
        }

        // Initialize default
        applyModePreset("photo");
    }
};

export default DocFix;
