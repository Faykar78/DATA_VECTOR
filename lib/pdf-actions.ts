import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
// import * as pdfjsLib from 'pdfjs-dist';
// pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export class PDFActions {
    // --- Utilities ---
    static async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    static async readFileAsDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // --- Actions ---

    static async merge(files: File[]): Promise<Blob> {
        const mergedPdf = await PDFDocument.create();
        for (const file of files) {
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
        const pdfBytes = await mergedPdf.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }

    static async split(file: File): Promise<Blob> {
        const arrayBuffer = await this.readFileAsArrayBuffer(file);
        const pdf = await PDFDocument.load(arrayBuffer);
        const pageCount = pdf.getPageCount();
        const zip = new JSZip();
        const folder = zip.folder("split_files");

        for (let i = 0; i < pageCount; i++) {
            const newPdf = await PDFDocument.create();
            const [copiedPage] = await newPdf.copyPages(pdf, [i]);
            newPdf.addPage(copiedPage);
            const pdfBytes = await newPdf.save();
            folder?.file(`page_${i + 1}.pdf`, pdfBytes);
        }
        return await zip.generateAsync({ type: "blob" });
    }

    static async rotate(file: File): Promise<Blob> {
        const arrayBuffer = await this.readFileAsArrayBuffer(file);
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = pdf.getPages();
        pages.forEach((page) => {
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees(currentRotation + 90));
        });
        const pdfBytes = await pdf.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }

    static async protect(file: File, password: string = '1234'): Promise<Blob> {
        const arrayBuffer = await this.readFileAsArrayBuffer(file);
        const pdf = await PDFDocument.load(arrayBuffer);
        // Use save options for encryption (casting to any to bypass strict checks if needed)
        const pdfBytes = await pdf.save({
            userPassword: password,
            ownerPassword: password,
            permissions: {
                printing: 'highResolution',
                modifying: false,
                copying: false,
                annotating: false,
                fillingForms: false,
                contentAccessibility: false,
                documentAssembly: false,
            }
        } as any);
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }

    static async extractPages(file: File, pageIndices: number[]): Promise<Blob> {
        const arrayBuffer = await this.readFileAsArrayBuffer(file);
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));
        const pdfBytes = await newPdf.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }

    static async removePages(file: File, pageIndicesToRemove: number[]): Promise<Blob> {
        const arrayBuffer = await this.readFileAsArrayBuffer(file);
        const pdf = await PDFDocument.load(arrayBuffer);
        // Remove in reverse order to avoid shifting indices
        const sortedIndices = [...pageIndicesToRemove].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
            pdf.removePage(idx);
        }
        const pdfBytes = await pdf.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }

    static async jpg2pdf(files: File[]): Promise<Blob> {
        const doc = new jsPDF();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const dataUrl = await this.readFileAsDataURL(file);

            const imgProps = doc.getImageProperties(dataUrl);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            if (i > 0) doc.addPage();
            doc.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }
        return doc.output('blob');
    }

    static async pdf2jpg(file: File): Promise<Blob> {
        const zip = new JSZip();
        const folder = zip.folder("images");
        const arrayBuffer = await this.readFileAsArrayBuffer(file);

        // Dynamic import
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                // @ts-ignore: pdfjs-dist type mismatch for render
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                folder?.file(`page_${i}.jpg`, imgData.split(',')[1], { base64: true });
            }
        }
        return await zip.generateAsync({ type: "blob" });
    }

    static async compress(file: File, quality: number = 0.6): Promise<Blob> {
        const arrayBuffer = await this.readFileAsArrayBuffer(file);

        // Dynamic import
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const doc = new jsPDF();

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 }); // Downsample if needed
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                // @ts-ignore: pdfjs-dist type mismatch for render
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                const imgData = canvas.toDataURL('image/jpeg', quality);

                const imgProps = doc.getImageProperties(imgData);
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                if (i > 1) doc.addPage();
                doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }
        }
        return doc.output('blob');
    }

    // --- Legacy Backend URL ---
    static GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyyhY0HheFeo7V0g4M4uunhsJmoZ9uLNtJXDKa6Ifb1BL4xYM2GOSO5efs1JKROmktv/exec';

    static async convertWithBackend(file: File, actionName: string): Promise<Blob> {
        const dataUrl = await this.readFileAsDataURL(file);
        const base64 = dataUrl.split(',')[1];

        const response = await fetch(this.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: actionName,
                fileData: base64,
                fileName: file.name
            })
        });

        const result = await response.json();
        if (result.error) throw new Error("Server Error: " + result.error);

        // Decode base64 PDF
        const byteCharacters = atob(result.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
    }

    static async convertToPdf(file: File): Promise<Blob> {
        const ext = file.name.split('.').pop()?.toLowerCase();

        // 1. Backend Conversions (Word, PPT)
        if (['doc', 'docx'].includes(ext || '')) {
            return await this.convertWithBackend(file, 'convert_word');
        }
        if (['ppt', 'pptx'].includes(ext || '')) {
            return await this.convertWithBackend(file, 'convert_pptx');
        }

        // 2. Client-side Conversions (Excel, HTML)
        if (['xls', 'xlsx', 'html', 'htm'].includes(ext || '')) {
            // Dynamic imports for browser-only libs
            const html2pdf = (await import('html2pdf.js')).default;

            // Create container
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '0px';
            container.style.width = '800px';
            container.style.background = 'white';
            document.body.appendChild(container);

            try {
                if (['xls', 'xlsx'].includes(ext || '')) {
                    const XLSX = await import('xlsx');
                    const arrayBuffer = await this.readFileAsArrayBuffer(file);
                    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const html = XLSX.utils.sheet_to_html(worksheet);
                    container.innerHTML = html;
                } else {
                    const text = await file.text();
                    container.innerHTML = text;
                }

                // Generate PDF
                const opt = {
                    margin: 10,
                    filename: file.name + '.pdf',
                    image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as 'portrait' }
                };

                const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
                return pdfBlob;

            } finally {
                document.body.removeChild(container);
            }
        }

        throw new Error(`Unsupported format: .${ext}`);
    }

    static async passThrough(file: File): Promise<Blob> {
        // Simulate processing for 'PDF to X' tools that just return the file in legacy
        return new Promise(resolve => setTimeout(() => resolve(file), 1500));
    }
}
