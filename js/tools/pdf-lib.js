/**
 * PDF Processing Library
 * Uses Global: PDFLib, jspdf, download, mammoth, xlsx, html2pdf, JSZip
 */

const PDFActions = {

    // --- Utilities ---
    readFileAsArrayBuffer: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    readFileAsDataURL: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    readFileAsText: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    // --- Backend Helper ---
    convertWithBackend: async (file, actionName) => {
        if (!window.GOOGLE_SCRIPT_URL) throw new Error("Backend URL not configured in app.js");

        const dataUrl = await PDFActions.readFileAsDataURL(file);
        const base64 = dataUrl.split(',')[1];

        const response = await fetch(window.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: actionName,
                fileData: base64,
                fileName: file.name
            })
        });

        const result = await response.json();
        if (result.error) throw new Error("Server Error: " + result.error);

        const byteCharacters = atob(result.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
    },

    // --- Actions ---

    merge: async (files) => {
        const { PDFDocument } = window.PDFLib;
        const mergedPdf = await PDFDocument.create();

        for (const file of files) {
            const arrayBuffer = await PDFActions.readFileAsArrayBuffer(file);
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    split: async (file) => {
        const { PDFDocument } = window.PDFLib;
        const JSZip = window.JSZip;

        const arrayBuffer = await PDFActions.readFileAsArrayBuffer(file);
        const pdf = await PDFDocument.load(arrayBuffer);
        const pageCount = pdf.getPageCount();

        const zip = new JSZip();
        const folder = zip.folder("split_files");

        for (let i = 0; i < pageCount; i++) {
            const newPdf = await PDFDocument.create();
            const [copiedPage] = await newPdf.copyPages(pdf, [i]);
            newPdf.addPage(copiedPage);

            const pdfBytes = await newPdf.save();
            folder.file(`page_${i + 1}.pdf`, pdfBytes);
        }

        return zip.generate({ type: "blob" });
    },

    extractPages: async (file, pageIndices) => {
        const { PDFDocument } = window.PDFLib;
        const arrayBuffer = await PDFActions.readFileAsArrayBuffer(file);
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const newPdf = await PDFDocument.create();

        const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    removePages: async (file, pageIndicesToRemove) => {
        const { PDFDocument } = window.PDFLib;
        const arrayBuffer = await PDFActions.readFileAsArrayBuffer(file);
        const pdf = await PDFDocument.load(arrayBuffer);

        // Remove in reverse order
        const sortedIndices = [...pageIndicesToRemove].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
            pdf.removePage(idx);
        }

        const pdfBytes = await pdf.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    /**
     * Compress PDF (Rasterize pages to images at lower quality -> Rebuild PDF)
     * @param {File} file 
     * @param {number} quality 0.1 to 1.0
     */
    compress: async (file, quality = 0.6) => {
        const { PDFDocument } = window.PDFLib;
        const { jsPDF } = window.jspdf;
        const arrayBuffer = await PDFActions.readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        const doc = new jsPDF();

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 }); // Standard scale (downsample effectively)

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            // Compress Image
            const imgData = canvas.toDataURL('image/jpeg', quality);

            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            if (i > 1) doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }

        return doc.output('blob');
    },

    jpg2pdf: async (files) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const dataUrl = await PDFActions.readFileAsDataURL(file);

            const imgProps = doc.getImageProperties(dataUrl);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            if (i > 0) doc.addPage();
            doc.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }

        return doc.output('blob');
    },

    pdf2jpg: async (files) => {
        const file = files[0];
        const JSZip = window.JSZip;
        const zip = new JSZip();
        const folder = zip.folder("images");

        const arrayBuffer = await PDFActions.readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            folder.file(`page_${i}.jpg`, imgData.split(',')[1], { base64: true });
        }

        return zip.generate({ type: "blob" });
    },

    convertToPdf: async (file) => {
        const ext = file.name.split('.').pop().toLowerCase();

        // Create a HIDDEN container for conversion
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '0px'; // Visible for debug
        container.style.top = '100px';
        container.style.width = '800px';
        container.style.height = '600px';
        container.style.padding = '20px';
        container.style.background = '#f0f0f0';
        container.style.border = '5px solid red'; // Visual indicator
        container.style.color = 'black';
        container.style.zIndex = '10000'; // On top of everything
        container.style.overflow = 'auto';
        // container.style.visibility = 'hidden'; // Don't use this, html2canvas won't render it

        try {
            if (ext === 'docx' || ext === 'doc') {
                container.innerHTML = "<h2>Converting Word on Server...</h2><p>This may take a few seconds.</p>";
                container.style.zIndex = '10000'; container.style.left = '0'; container.style.top = '100px';
                return await PDFActions.convertWithBackend(file, 'convert_word');

            } else if (ext === 'xlsx' || ext === 'xls') {
                const arrayBuffer = await PDFActions.readFileAsArrayBuffer(file);
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const html = XLSX.utils.sheet_to_html(worksheet);
                container.innerHTML = html;

            } else if (ext === 'html' || ext === 'htm') {
                const text = await PDFActions.readFileAsText(file);
                // Sanitize: Only take body content if it's a full HTML doc
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                container.innerHTML = doc.body ? doc.body.innerHTML : text;

            } else if (ext === 'pptx') {
                container.innerHTML = "<h2>Converting PPTX on Server...</h2><p>This may take a few seconds.</p>";
                container.style.zIndex = '10000'; container.style.left = '0'; container.style.top = '100px';
                return await PDFActions.convertWithBackend(file, 'convert_pptx');

            } else {
                throw new Error("Unsupported format");
            }

            const opt = {
                margin: 10,
                filename: file.name + '.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            document.body.appendChild(container);
            const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
            document.body.removeChild(container);
            return pdfBlob;

        } catch (err) {
            // ALWAYS clean up the container on error too
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
            console.error(err);
            const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            page.drawText(`Error: ${err.message}`, { x: 50, y: 700, font, size: 12, color: rgb(1, 0, 0) });
            const bytes = await pdfDoc.save();
            return new Blob([bytes], { type: 'application/pdf' });
        }
    },

    rotate: async (file) => {
        const { PDFDocument, degrees } = window.PDFLib;
        const arrayBuffer = await PDFActions.readFileAsArrayBuffer(file);
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = pdf.getPages();
        pages.forEach(page => page.setRotation(degrees(90)));
        const pdfBytes = await pdf.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    protect: async (file) => {
        const { PDFDocument } = window.PDFLib;
        const arrayBuffer = await PDFActions.readFileAsArrayBuffer(file);
        const pdf = await PDFDocument.load(arrayBuffer);
        const pdfBytes = await pdf.save({
            userPassword: '1234',
            ownerPassword: '1234'
        });
        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    passThrough: async (file) => {
        return new Promise(resolve => setTimeout(() => resolve(file), 1500));
    }
};

export default PDFActions;
