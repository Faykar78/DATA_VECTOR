import PDFActions from './tools/pdf-lib.js?v=2';
import SearchEngine from './tools/search.js';

// --- Configuration ---
// TO USER: Replace this URL with your deployed Google Apps Script URL.
window.GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyyhY0HheFeo7V0g4M4uunhsJmoZ9uLNtJXDKa6Ifb1BL4xYM2GOSO5efs1JKROmktv/exec';

// --- Shared State ---
const state = {
    currentTool: null,
    files: [],
};

// --- Utils ---
const getUrlParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
};

// --- Initializer ---
document.addEventListener('DOMContentLoaded', async () => {

    // 0. Preloader Logic
    const preloader = document.getElementById('preloader');
    if (preloader) {
        // Wait at least 1s for the feel, or until window loads
        window.addEventListener('load', () => {
            setTimeout(() => {
                preloader.classList.add('preloader-hidden');
            }, 800);
        });
        // Fallback safety
        setTimeout(() => { preloader.classList.add('preloader-hidden'); }, 3000);
    }

    // 0.5 Scroll Animations (Nixtio Style)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scroll-visible');
                // Optional: Unobserve after revealing? Nixtio usually keeps them visible once shown.
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    document.querySelectorAll('.scroll-hidden').forEach(el => observer.observe(el));


    // 1. Identify Page
    const isToolPage = !!document.getElementById('toolTitle');
    const isResultPage = !!document.getElementById('resultTitle');

    if (isToolPage) {
        await initToolPage();
    } else if (isResultPage) {
        initResultPage();
    }
});

// --- Tool Page Logic ---

// ... (existing imports)

// --- Tool Page Logic ---
async function initToolPage() {
    let id = getUrlParam('id');
    // Load Config
    // Added timestamp to force fresh load (cache-busting)
    const tools = await fetch('data/tools.json?v=' + Date.now()).then(res => res.json());

    // Fallback to LocalStorage if URL param is missing
    if (!id) {
        id = localStorage.getItem('activeToolId');
    }

    // Restore safety check: Redirect if no ID
    if (!id) {
        window.location.href = 'index.html';
        return;
    }

    const tool = tools.find(t => t.id === id);
    if (!tool) {
        alert('Tool not found in database: ' + id);
        window.location.href = 'index.html';
        return;
    }

    state.currentTool = tool;
    document.title = `${tool.title} - DataVector`;

    // Render Hero
    document.getElementById('toolTitle').textContent = tool.title;
    document.getElementById('toolDesc').textContent = tool.desc;

    // Render Interface
    const actionArea = document.getElementById('actionArea');
    actionArea.innerHTML = ''; // Clear

    if (tool.type === 'file') {
        renderFileInterface(actionArea, tool);
    } else if (tool.type === 'search') {
        renderSearchInterface(actionArea, tool);
    }
}

function renderFileInterface(container, tool) {
    // Dynamic Label
    let label = 'Files';
    if (tool.accept === '.pdf') label = 'PDFs';
    else if (tool.accept.includes('image')) label = 'Images';
    else if (tool.accept.includes('.doc')) label = 'Word Docs';
    else if (tool.accept.includes('.xls')) label = 'Excel Sheets';
    else if (tool.accept.includes('.ppt')) label = 'PowerPoint';

    const dropzone = document.createElement('div');
    dropzone.className = 'dropzone';

    // Check if Scan Tool
    const isScan = tool.id === 'scan-pdf';

    let html = `
        <img src="${tool.icon}" class="tool-icon-large">
        <h3>Select ${label}</h3>
        <div class="dropzone-actions">
            <button class="btn-primary-xl">Select ${label}</button>
            ${isScan ? `<button id="btnCamera" class="btn-primary-xl btn-danger">📷 Camera</button>` : ''}
        </div>
        <p class="dropzone-hint">or drop files here</p>
        <input type="file" multiple style="display:none;" accept="${tool.accept}">
        ${isScan ? `<input type="file" id="cameraInput" capture="environment" accept="image/*" style="display:none;">` : ''}
    `;

    dropzone.innerHTML = html;

    const input = dropzone.querySelector('input[multiple]');
    const btn = dropzone.querySelector('button'); // First button

    // Events
    btn.onclick = (e) => { e.stopPropagation(); input.click(); };
    dropzone.onclick = (e) => { if (e.target !== btn && e.target.id !== 'btnCamera') input.click(); };
    input.onchange = (e) => handleFiles(e.target.files);

    // Camera Events
    if (isScan) {
        const btnCamera = dropzone.querySelector('#btnCamera');
        const cameraInput = dropzone.querySelector('#cameraInput');

        btnCamera.onclick = (e) => {
            e.stopPropagation();
            cameraInput.click(); // Triggers native camera on mobile
        };

        cameraInput.onchange = (e) => handleFiles(e.target.files);
    }

    // Drag & Drop
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.background = '#eff6ff'; });
    dropzone.addEventListener('dragleave', (e) => { e.preventDefault(); dropzone.style.background = ''; });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    });

    container.appendChild(dropzone);
}

function renderSearchInterface(container, tool) {
    container.innerHTML = `
        <div class="search-box-large">
            <input type="text" class="search-input" placeholder="${tool.placeholder}">
            <button class="search-btn">Search</button>
        </div>
    `;

    const btn = container.querySelector('.search-btn');
    const input = container.querySelector('input');

    const doSearch = () => {
        const query = input.value;
        if (!query) return;

        // Pass query to results
        localStorage.setItem('lastResultType', 'search');
        localStorage.setItem('lastSearchQuery', query);
        localStorage.setItem('lastToolId', tool.id);
        window.location.href = 'results.html';
    };

    btn.onclick = doSearch;
    input.onkeydown = (e) => { if (e.key === 'Enter') doSearch(); };
}

async function handleFiles(fileList) {
    if (fileList.length === 0) return;

    // If Merge Tool, go to Staging Area
    if (state.currentTool.id === 'merge-pdf') {
        const newFiles = Array.from(fileList);
        state.files = [...(state.files || []), ...newFiles];
        renderMergeStaging();
        return;
    }

    // Visual Page Selection for Split/Remove/Extract
    const action = state.currentTool.action;
    if (['split', 'remove', 'extract'].includes(action)) {
        state.files = Array.from(fileList);
        renderPageSelector(state.files[0], action);
        return;
    }

    // New: Compression UI
    if (action === 'compress') {
        state.files = Array.from(fileList);
        renderCompressUI(state.files[0]);
        return;
    }

    state.files = Array.from(fileList);

    // Show processing UI with animated progress bar
    const actionArea = document.getElementById('actionArea');
    actionArea.innerHTML = `
        <div class="processing-container">
            <h2>Processing ${state.files.length} file(s)...</h2>
            <div class="progress-bar-container">
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <p class="progress-text">Converting to PDF...</p>
            </div>
        </div>
    `;

    // Animate progress bar
    setTimeout(() => {
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = '90%'; // Simulate progress
        }
    }, 100);

    // Process
    try {
        let resultBlob = null;
        let filenameKey = 'processed';

        if (action === 'merge') {
            resultBlob = await PDFActions.merge(state.files);
        } else if (action === 'compress') {
            resultBlob = await PDFActions.compress(state.files[0]);
        } else if (action === 'jpg2pdf') {
            resultBlob = await PDFActions.jpg2pdf(state.files);
        } else if (action === 'pdf2jpg') {
            resultBlob = await PDFActions.pdf2jpg(state.files);
            filenameKey = 'images.zip';
        } else if (action === 'convert-to-pdf') {
            resultBlob = await PDFActions.convertToPdf(state.files[0]);
        } else if (action === 'rotate') {
            resultBlob = await PDFActions.rotate(state.files[0]);
        } else if (action === 'protect') {
            resultBlob = await PDFActions.protect(state.files[0]);
        } else if (action === 'linear-process') {
            resultBlob = await PDFActions.passThrough(state.files[0]);
        }

        if (resultBlob) {
            handleResult(resultBlob, filenameKey);
        }
    } catch (err) {
        console.error(err);
        alert('Error processing files: ' + err.message);
        location.reload();
    }
}

// --- Visual Page Selector ---
async function renderPageSelector(file, action) {
    const actionArea = document.getElementById('actionArea');
    document.getElementById('toolHeader').style.display = 'none';

    actionArea.innerHTML = `
        <div class="page-selector-container">
            <h2>Select Pages</h2>
            <p class="selector-hint">
                ${action === 'remove' ? 'Select pages to DELETE' : 'Select pages to KEEP/EXTRACT'}
            </p>
            
            <div id="pageGrid" class="page-grid">
                <p>Loading pages...</p>
            </div>
            
            <div class="selector-actions">
                <button class="btn-secondary" onclick="location.reload()">Cancel</button>
                <button class="btn-primary-xl" onclick="executePageAction('${action}')">
                    ${action.toUpperCase()} Selected Pages
                </button>
            </div>
        </div>
    `;

    // Render Thumbnails
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const grid = document.getElementById('pageGrid');
        grid.innerHTML = '';

        window.selectedPages = new Set(); // Global state for simplicity

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.2 }); // Thumbnail size

            const div = document.createElement('div');
            div.className = 'page-thumb';
            div.style.position = 'relative';
            div.style.cursor = 'pointer';
            div.style.border = '3px solid transparent';
            div.style.borderRadius = '8px';
            div.style.overflow = 'hidden';

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Render
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            div.appendChild(canvas);

            // Page Number
            const num = document.createElement('div');
            num.textContent = i;
            num.style.cssText = 'position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.7); color:white; padding:2px 6px; border-radius:4px; font-size:12px;';
            div.appendChild(num);

            // Checkbox Overlay
            const check = document.createElement('div');
            check.className = 'check-overlay';
            check.textContent = '✓';
            check.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:white; font-size:2rem; font-weight:bold; opacity:0; pointer-events:none; text-shadow:0 1px 3px rgba(0,0,0,0.5);';
            div.appendChild(check);

            div.onclick = () => {
                if (window.selectedPages.has(i - 1)) {
                    window.selectedPages.delete(i - 1); // 0-based for pdf-lib
                    div.style.borderColor = 'transparent';
                    check.style.opacity = '0';
                } else {
                    window.selectedPages.add(i - 1);
                    div.style.borderColor = '#38bdf8';
                    check.style.opacity = '1';
                }
            };

            grid.appendChild(div);
        }

    } catch (e) {
        console.error(e);
        alert("Failed to load PDF pages: " + e.message);
    }
}

window.executePageAction = async (action) => {
    const indices = Array.from(window.selectedPages).sort((a, b) => a - b);
    if (indices.length === 0) {
        alert("Please select at least one page.");
        return;
    }

    const file = state.files[0];
    const actionArea = document.getElementById('actionArea');
    actionArea.innerHTML = `<h2>Processing...</h2>`;
    document.getElementById('toolHeader').style.display = 'block';

    try {
        let resultBlob;
        let filename;

        if (action === 'extract') {
            resultBlob = await PDFActions.extractPages(file, indices);
            filename = 'extracted_pages.pdf';
        } else if (action === 'remove') {
            resultBlob = await PDFActions.removePages(file, indices);
            filename = 'remaining_pages.pdf';
        } else if (action === 'split') {
            // For split, we might want to split selected pages individually using extract?
            // User request: "choose what pages to selected to be splitted" -> implies extracting those pages?
            // Or maybe standard split logic on just those pages.
            // Let's assume Extract behavior (creates one PDF) or Split-to-Zip?
            // If they select pages for splitting, usually means "Break these out".
            // Let's use standard split but only for the selected subset (zip of single pages).

            // To support "Split Selected", we can extract them first then split? 
            // Or just split the original and filter?

            // Simplified: Just extract them as a zip of single pages.
            // But we don't have a "splitSubset" method. 
            // Let's implement client-side loop here if needed, or update pdf-lib.
            // Actually, PDFActions.split splits *everything*.
            // Let's use extractPages to get a PDF of just those, then PDFActions.split that?
            // Yes, composition is clean.

            const tempPdfBlob = await PDFActions.extractPages(file, indices);
            const tempFile = new File([tempPdfBlob], "temp.pdf");
            resultBlob = await PDFActions.split(tempFile);
            filename = 'split_selection.zip';
        }

        handleResult(resultBlob, filename);

    } catch (err) {
        alert("Error: " + err.message);
        location.reload();
    }
};

// --- Merge Staging Area ---

// --- Merge Staging Area ---
function renderMergeStaging() {
    const actionArea = document.getElementById('actionArea');
    // Hide default header while staging
    document.getElementById('toolHeader').style.display = 'none';

    actionArea.innerHTML = `
        <div style="width:100%; max-width:800px;">
            <h2 style="margin-bottom:1rem; text-align:center;">Arrange Your Files</h2>
            <p style="text-align:center; color:#666; margin-bottom:1.5rem;">Drag and drop to reorder. PDF will be merged in this sequence.</p>
            
            <div id="stagingList" class="staging-list"></div>
            
            <div style="display:flex; justify-content:center; gap:15px; margin-top:2rem;">
                 <label class="btn-primary-xl" style="background:#64748b; font-size:1rem; padding:0.8rem 1.5rem;">
                    + Add More
                    <input type="file" multiple accept=".pdf" style="display:none;" onchange="handleAddMore(this)">
                </label>
                <button class="btn-primary-xl" onclick="executeMerge()" style="font-size:1.2rem;">Merge PDFs Now</button>
            </div>
        </div>
    `;

    const list = document.getElementById('stagingList');
    state.files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'staging-item';
        item.innerHTML = `
            <span class="handle">☰</span>
            <span class="name">${file.name}</span>
            <span class="size">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            <button class="remove-btn" onclick="removeFile(${index})">✕</button>
        `;
        list.appendChild(item);
    });

    // Initialize Sortable
    new Sortable(list, {
        animation: 150,
        handle: '.handle',
        onEnd: (evt) => {
            // Reorder state.files array
            const item = state.files.splice(evt.oldIndex, 1)[0];
            state.files.splice(evt.newIndex, 0, item);
        }
    });

    // Add styles dynamically if not present
    if (!document.getElementById('stagingStyles')) {
        const style = document.createElement('style');
        style.id = 'stagingStyles';
        style.textContent = `
            .staging-list { background: #f8fafc; border-radius: 12px; padding: 10px; max-height: 400px; overflow-y: auto; }
            .staging-item { background: white; padding: 10px 15px; margin-bottom: 8px; border-radius: 8px; display: flex; align-items: center; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .handle { cursor: grab; color: #94a3b8; font-size: 1.2rem; }
            .name { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .size { color: #94a3b8; font-size: 0.85rem; }
            .remove-btn { background: none; border: none; color: #ef4444; cursor: pointer; font-weight: bold; padding: 5px; }
            .remove-btn:hover { background: #fee2e2; border-radius: 4px; }
        `;
        document.head.appendChild(style);
    }
}

window.handleAddMore = (input) => {
    if (input.files.length > 0) {
        state.files = [...state.files, ...Array.from(input.files)];
        renderMergeStaging();
    }
};

window.removeFile = (index) => {
    state.files.splice(index, 1);
    renderMergeStaging();
    if (state.files.length === 0) location.reload();
};

window.executeMerge = async () => {
    const actionArea = document.getElementById('actionArea');
    actionArea.innerHTML = `<h2>Merging ${state.files.length} PDFs...</h2><p>Please wait...</p>`;
    document.getElementById('toolHeader').style.display = 'block';

    try {
        const resultBlob = await PDFActions.merge(state.files);
        handleResult(resultBlob, 'merged.pdf');
    } catch (err) {
        alert(err.message);
        location.reload();
    }
};

function handleResult(resultBlob, filenameDefault) {
    // Store blob reference for download
    window._downloadBlob = resultBlob;
    window._downloadFilename = filenameDefault || `processed_${Date.now()}.pdf`;

    const fileSize = (resultBlob.size / 1024 / 1024).toFixed(2);

    // Hide Input
    document.getElementById('actionArea').style.display = 'none';
    document.getElementById('toolHeader').style.display = 'none';

    // Show Result
    const resultsSection = document.getElementById('resultsSection');
    const spaOutput = document.getElementById('spaOutput');
    const toolHeader = document.getElementById('toolHeader');

    // Update Title
    toolHeader.style.display = 'block';
    document.getElementById('toolTitle').textContent = "Success!";
    document.getElementById('toolDesc').textContent = "Your file has been processed successfully.";

    spaOutput.innerHTML = `
         <div class="result-card">
            <p>
                Your file is ready to download.<br>
                <strong class="result-size">Size: ${fileSize} MB</strong>
            </p>
            <button id="downloadBtn" class="btn-primary-xl">
                ⬇️ Download File
            </button>
         </div>
     `;

    resultsSection.style.display = 'flex';

    // Programmatic Download Handler
    document.getElementById('downloadBtn').onclick = () => {
        const blob = window._downloadBlob;
        const filename = window._downloadFilename;

        // Create temporary link and trigger download
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Cleanup after a delay
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    };

    // Handle Reset
    document.getElementById('btnReset').onclick = () => {
        location.reload();
    };
}

// --- Result Page Logic ---
async function initResultPage() {
    const type = localStorage.getItem('lastResultType');
    const outputContainer = document.getElementById('outputContainer');

    if (type === 'file') {
        const url = localStorage.getItem('lastResultUrl');
        const name = localStorage.getItem('lastFileName');

        outputContainer.innerHTML = `
            <div style="text-align:center;">
                <p style="margin-bottom:2rem; font-size:1.2rem;">Your file has been processed successfully.</p>
                <a href="${url}" download="${name}" class="btn-primary-xl" style="text-decoration:none;">Download Processed PDF</a>
            </div>
        `;

    } else if (type === 'search') {
        const query = localStorage.getItem('lastSearchQuery');
        const toolId = localStorage.getItem('lastToolId');

        document.getElementById('resultTitle').textContent = `Search results for "${query}"`;
        document.getElementById('resultDesc').textContent = 'Found the following accessible resources:';

        let results = [];
        if (toolId === 'od-search') {
            results = await SearchEngine.searchDirectories(query);
        } else {
            results = await SearchEngine.searchWeb(query);
        }

        if (results.length === 0) {
            outputContainer.innerHTML = `<p style="text-align:center; color:#888;">No results found.</p>`;
        } else {
            outputContainer.innerHTML = results.map(item => `
                <div class="result-item">
                    <div class="result-file-info">
                        <span class="result-title">${item.name}</span>
                        <span class="result-meta">${item.type} • ${item.size || 'Web Resource'} • ${item.date || 'N/A'}</span>
                        ${item.desc ? `<small>${item.desc}</small>` : ''}
                    </div>
                    <a href="${item.url}" target="_blank" class="btn-download">Open</a>
                </div>
            `).join('');
        }
    }
}

// --- Feedback Form Logic ---
window.submitFeedback = async function (e) {
    e.preventDefault();

    // Safety check for setup
    if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        alert('Please connect your Google Sheet first! See the guide.');
        return;
    }

    const type = document.getElementById('feedbackType').value;
    const msg = document.getElementById('feedbackMsg').value;
    const statusDiv = document.getElementById('feedbackStatus');
    const btn = e.target.querySelector('button');

    // UI Loading State
    btn.disabled = true;
    btn.textContent = 'Connecting to Spreadsheet...';
    statusDiv.style.display = 'block';
    statusDiv.style.color = '#fbbf24'; // Warning yellow
    statusDiv.textContent = 'Sending data...';

    // Data Payload
    const formData = new URLSearchParams();
    formData.append('type', type);
    formData.append('message', msg);
    formData.append('timestamp', new Date().toISOString());

    try {
        // Send data
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Important for Google Script Web Apps
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        // Use 'no-cors' means we can't read the response, so we assume success if no network error.
        statusDiv.style.color = '#4ade80'; // Success green
        statusDiv.textContent = 'Thank you for your FeedBack we will improve as fast as we can!';
        e.target.reset();

    } catch (error) {
        console.error('Feedback Error:', error);
        statusDiv.style.color = '#f87171'; // Error red
        statusDiv.textContent = 'Error sending feedback. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Feedback';

        // Clear success message after 5 seconds
        setTimeout(() => {
            statusDiv.textContent = '';
        }, 5000);
    }
};

// --- Compress UI ---
function renderCompressUI(file) {
    const actionArea = document.getElementById('actionArea');
    document.getElementById('toolHeader').style.display = 'none';

    const originalSize = state.files[0].size;
    const originalSizeMB = (originalSize / 1024 / 1024).toFixed(2);

    actionArea.innerHTML = `
        <div style="width:100%; max-width:650px; text-align:center; margin: 0 auto;">
            <h2 style="margin-bottom:1rem;">Compress PDF</h2>
            <p style="color:#666; margin-bottom:2rem;">Choose compression level. Higher compression = smaller file but lower quality.</p>
            
            <div style="background:white; padding:2rem; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05); margin-bottom:2rem; color:#333;">
                <!-- File Info -->
                <div style="display:flex; justify-content:space-around; margin-bottom:1.5rem; padding:1rem; background:#f8fafc; border-radius:8px;">
                    <div>
                        <div style="font-size:0.8rem; color:#64748b;">Original Size</div>
                        <div style="font-size:1.5rem; font-weight:bold; color:#0f172a;">${originalSizeMB} MB</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem; color:#64748b;">Estimated Output</div>
                        <div id="estSize" style="font-size:1.5rem; font-weight:bold; color:#22c55e;">${(originalSizeMB * 0.6).toFixed(2)} MB</div>
                    </div>
                </div>

                <!-- Slider -->
                <label style="display:block; margin-bottom:0.5rem; font-weight:bold; font-size:1rem;">
                    Compression Level: <span id="compVal" style="color:#3b82f6;">Medium (0.6)</span>
                </label>
                <input type="range" id="compRange" min="0.1" max="1.0" step="0.05" value="0.6" style="width:100%; margin-bottom:0.5rem; cursor:pointer; accent-color:#3b82f6;">
                <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:0.8rem; margin-bottom:1.5rem;">
                    <span>🗜️ Maximum Compression</span>
                    <span>📄 Best Quality</span>
                </div>

                <!-- Manual Input -->
                <div style="display:flex; align-items:center; justify-content:center; gap:10px; padding-top:1rem; border-top:1px solid #e2e8f0;">
                    <label style="font-size:0.9rem; color:#64748b;">Manual Value (0.1 - 1.0):</label>
                    <input type="number" id="compManual" min="0.1" max="1.0" step="0.05" value="0.6" style="width:80px; padding:8px; border:1px solid #cbd5e1; border-radius:6px; text-align:center; font-size:1rem;">
                </div>
            </div>
            
            <div style="display:flex; justify-content:center; gap:15px; margin-top:2rem;">
                <button class="btn-primary-xl" style="background:#64748b;" onclick="location.reload()">Cancel</button>
                <button class="btn-primary-xl" onclick="executeCompress()">Compress Now</button>
            </div>
        </div>
    `;

    // Event Handlers
    setTimeout(() => {
        const range = document.getElementById('compRange');
        const manual = document.getElementById('compManual');
        const val = document.getElementById('compVal');
        const estSize = document.getElementById('estSize');
        const originalMB = parseFloat(originalSizeMB);

        const updateUI = (v) => {
            // Update label
            let label = 'Medium';
            if (v < 0.3) label = 'Extreme';
            else if (v < 0.5) label = 'High';
            else if (v < 0.75) label = 'Medium';
            else label = 'Low';
            val.textContent = label + ' (' + v.toFixed(2) + ')';
            val.style.color = v < 0.4 ? '#ef4444' : (v < 0.7 ? '#3b82f6' : '#22c55e');

            // Estimate: Lower quality = smaller file (roughly proportional)
            const estimated = (originalMB * v).toFixed(2);
            estSize.textContent = estimated + ' MB';
            estSize.style.color = v < 0.4 ? '#22c55e' : (v < 0.7 ? '#3b82f6' : '#f59e0b');
        };

        if (range) {
            range.oninput = (e) => {
                const v = parseFloat(e.target.value);
                manual.value = v.toFixed(2);
                updateUI(v);
            };
        }

        if (manual) {
            manual.oninput = (e) => {
                let v = parseFloat(e.target.value);
                if (isNaN(v) || v < 0.1) v = 0.1;
                if (v > 1.0) v = 1.0;
                range.value = v;
                updateUI(v);
            };
        }
    }, 100);
}

window.executeCompress = async () => {
    // Prefer manual input if user changed it, otherwise use slider
    let quality = parseFloat(document.getElementById('compManual').value);
    if (isNaN(quality) || quality < 0.1) quality = 0.1;
    if (quality > 1.0) quality = 1.0;

    const actionArea = document.getElementById('actionArea');
    actionArea.innerHTML = `<h2>Compressing...</h2><p>Quality: ${quality.toFixed(2)} - This may take a moment...</p>`;
    document.getElementById('toolHeader').style.display = 'block';

    try {
        const resultBlob = await PDFActions.compress(state.files[0], quality);
        handleResult(resultBlob, 'compressed.pdf');
    } catch (err) {
        alert("Error: " + err.message);
        location.reload();
    }
};
