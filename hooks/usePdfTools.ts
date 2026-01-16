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
                default:
                    throw new Error(`Tool action locally not implemented for: ${toolId}`);
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
