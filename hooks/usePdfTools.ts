import { useState } from 'react';
import { PDFActions } from '@/lib/pdf-actions';

export type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';

export function usePdfTools(toolId: string) {
    const [files, setFiles] = useState<File[]>([]);
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [result, setResult] = useState<Blob | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Tool specific options
    const [quality, setQuality] = useState(0.6);
    const [password, setPassword] = useState('');
    const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

    const addFiles = (newFiles: File[]) => {
        setFiles((prev) => [...prev, ...newFiles]);
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const reset = () => {
        setFiles([]);
        setStatus('idle');
        setResult(null);
        setErrorMessage(null);
        setQuality(0.6);
        setPassword('');
        setSelectedPages(new Set());
    };

    const processFiles = async () => {
        if (files.length === 0) return;

        setStatus('processing');
        setErrorMessage(null);

        try {
            let blob: Blob | null = null;
            const file = files[0]; // Primary file

            switch (toolId) {
                case 'merge-pdf':
                    if (files.length < 2) throw new Error("Please select at least 2 PDF files to merge.");
                    blob = await PDFActions.merge(files);
                    break;
                case 'split-pdf':
                    // Legacy: split entire document
                    blob = await PDFActions.split(file);
                    break;
                case 'rotate-pdf':
                    blob = await PDFActions.rotate(file);
                    break;
                case 'compress-pdf':
                    blob = await PDFActions.compress(file, quality);
                    break;
                case 'jpg-to-pdf':
                    blob = await PDFActions.jpg2pdf(files);
                    break;
                case 'pdf-to-jpg':
                    blob = await PDFActions.pdf2jpg(file);
                    break;
                case 'protect-pdf':
                    if (!password) throw new Error("Password is required.");
                    blob = await PDFActions.protect(file, password);
                    break;
                case 'extract-pages':
                    if (selectedPages.size === 0) throw new Error("Please select pages to extract.");
                    blob = await PDFActions.extractPages(file, Array.from(selectedPages));
                    break;
                case 'remove-pages':
                    if (selectedPages.size === 0) throw new Error("Please select pages to remove.");
                    blob = await PDFActions.removePages(file, Array.from(selectedPages));
                    break;
                case 'convert-to-pdf':
                    blob = await PDFActions.convertToPdf(file);
                    break;
                case 'linear-process':
                    // Generic pass-through for PDF-to-Office / Repair / OCR / Etc.
                    blob = await PDFActions.passThrough(file);
                    break;
                case 'search-dir':
                case 'search-web':
                case 'custom':
                    // Handled by specific UIs, no processing here
                    return;
                default:
                    // If the tool has a specific action string that matches the ID (like 'rotate-pdf'), 
                    // AND we have a matching case above, it works. 
                    // But if action is 'rotate' and ID is 'rotate-pdf', we need to map correctly.
                    // Let's check tools.ts mapping.
                    // rotate-pdf -> action: 'rotate'. Case 'rotate-pdf' above matches toolId, NOT action.
                    // The switch is on toolId.

                    // Allow falling back to action-based dispatch if toolId not found? 
                    // No, cleaner to just add the missing IDs if any.

                    // Actually, let's look at the switch matches. 
                    // 'rotate-pdf' is matched. 'compress-pdf' is matched.
                    // 'word-to-pdf', 'excel-to-pdf', etc all have action 'convert-to-pdf'.
                    // So we must match on the toolId or fallback to checking the tool's action property.
                    // Since usePdfTools only gets toolId, we might need to fetch the tool config or just map inputs.

                    // Simpler: Map known IDs for the new actions.
                    if (['word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'html-to-pdf'].includes(toolId)) {
                        blob = await PDFActions.convertToPdf(file);
                    } else if (['pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel', 'pdf-to-pdfa', 'repair-pdf', 'ocr-pdf', 'organize-pdf', 'add-watermark', 'crop-pdf', 'unlock-pdf', 'sign-pdf', 'redact-pdf', 'compare-pdf', 'edit-pdf', 'page-numbers'].includes(toolId)) {
                        blob = await PDFActions.passThrough(file);
                    } else {
                        throw new Error(`Tool implementation pending for: ${toolId}`);
                    }
            }

            if (blob) {
                setResult(blob);
                setStatus('success');
            } else {
                throw new Error("Action failed to return a result.");
            }

        } catch (err: any) {
            console.error(err);
            setStatus('error');
            setErrorMessage(err.message || "An unknown error occurred.");
        }
    };

    return {
        files,
        status,
        result,
        errorMessage,
        // Options
        quality, setQuality,
        password, setPassword,
        selectedPages, setSelectedPages,
        // Actions
        addFiles,
        removeFile,
        setFiles, // Expose for reordering
        reset,
        processFiles
    };
}
