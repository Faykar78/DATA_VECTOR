'use client';

import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

// Set worker again just in case (client side)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// --- Components ---

export function CompressOptions({ quality, setQuality }: { quality: number, setQuality: (v: number) => void }) {
    return (
        <div className="w-full max-w-md mx-auto bg-white/5 p-6 rounded-xl border border-white/10 mb-8">
            <h3 className="text-xl font-bold text-center mb-4">Compression Level</h3>
            <div className="flex justify-between text-sm text-white/50 mb-2">
                <span>High Quality</span>
                <span>Small Size</span>
            </div>
            <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center mt-2 font-mono text-blue-400">
                Quality: {(quality * 100).toFixed(0)}%
            </div>
        </div>
    );
}

export function ProtectOptions({ password, setPassword }: { password: string, setPassword: (v: string) => void }) {
    return (
        <div className="w-full max-w-md mx-auto bg-white/5 p-6 rounded-xl border border-white/10 mb-8">
            <h3 className="text-xl font-bold text-center mb-4">Set Password</h3>
            <input
                type="password"
                placeholder="Enter PDF Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-center text-white/40 mt-2">
                This password will be required to open the PDF.
            </p>
        </div>
    );
}

// --- Thumbnail Helper ---
const PdfThumbnail = ({ pdf, pageIndex, scale = 0.2 }: { pdf: any, pageIndex: number, scale?: number }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!pdf || !canvasRef.current) return;

        let active = true;
        const renderPage = async () => {
            try {
                const page = await pdf.getPage(pageIndex + 1);
                const viewport = page.getViewport({ scale });

                if (active && canvasRef.current) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: context, viewport }).promise;
                        setLoaded(true);
                    }
                }
            } catch (err) {
                console.error("Error rendering page thumbnail:", err);
            }
        };
        renderPage();
        return () => { active = false; };
    }, [pdf, pageIndex, scale]);

    return (
        <div className={`relative w-full h-full flex items-center justify-center bg-white overflow-hidden transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
            <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
        </div>
    );
};


export function PageSelector({ file, selectedPages, setSelectedPages }: {
    file: File,
    selectedPages: Set<number>,
    setSelectedPages: (s: Set<number>) => void
}) {
    const [pdf, setPdf] = useState<any>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPdf = async () => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const doc = await pdfjsLib.getDocument(arrayBuffer).promise;
                setPdf(doc);
                setNumPages(doc.numPages);
                setLoading(false);
            } catch (e) {
                console.error(e);
                setLoading(false);
            }
        };
        loadPdf();
    }, [file]);

    const togglePage = (index: number) => {
        const newSet = new Set(selectedPages);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedPages(newSet);
    };

    if (loading) return <div className="text-center p-8">Loading pages...</div>;

    return (
        <div className="w-full max-w-6xl mx-auto mb-8">
            <h3 className="text-center text-xl font-bold mb-6">Select Pages</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Array.from({ length: numPages }).map((_, i) => (
                    <div
                        key={i}
                        onClick={() => togglePage(i)}
                        className={`
                            aspect-[3/4] rounded-lg border-4 cursor-pointer relative overflow-visible group transition-all duration-200
                            ${selectedPages.has(i) ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-105 z-10' : 'border-transparent hover:border-white/20 bg-white/5'}
                        `}
                    >
                        {/* Thumbnail or Placeholder */}
                        <div className="w-full h-full bg-white relative rounded-sm overflow-hidden">
                            {pdf ? (
                                <PdfThumbnail pdf={pdf} pageIndex={i} />
                            ) : (
                                <div className="flex items-center justify-center h-full text-black/20 font-bold">{i + 1}</div>
                            )}
                        </div>

                        {/* Page Number Badge */}
                        <div className="absolute -bottom-3 -right-3 bg-black/80 text-white text-xs px-2 py-1 rounded-md z-20 pointer-events-none">
                            Page {i + 1}
                        </div>

                        {/* Check Overlay */}
                        <div className={`
                            absolute inset-0 bg-blue-500/20 flex items-center justify-center transition-opacity duration-200 pointer-events-none
                            ${selectedPages.has(i) ? 'opacity-100' : 'opacity-0 group-hover:opacity-10'}
                        `}>
                            {selectedPages.has(i) && <div className="text-4xl text-white font-bold drop-shadow-md">✓</div>}
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-center text-sm text-white/50 mt-4">
                Click thumbnails to select/deselect pages.
            </p>
        </div>
    );
}

export function FileReorderList({ files, setFiles }: { files: File[], setFiles: (f: File[]) => void }) {

    const moveUp = (index: number) => {
        if (index === 0) return;
        const newFiles = [...files];
        [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
        setFiles(newFiles);
    };

    const moveDown = (index: number) => {
        if (index === files.length - 1) return;
        const newFiles = [...files];
        [newFiles[index + 1], newFiles[index]] = [newFiles[index], newFiles[index + 1]];
        setFiles(newFiles);
    };

    const remove = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    // Simple Drag & Drop implementation
    const [draggedItem, setDraggedItem] = useState<number | null>(null);

    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItem(index);
        // e.dataTransfer.effectAllowed = "move"; 
        // Chrome requires setting data to drag
        e.dataTransfer.setData("text/html", "");
    };

    const onDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        // hover visual
    };

    const onDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedItem === null) return;
        if (draggedItem === dropIndex) return;

        const newFiles = [...files];
        const item = newFiles.splice(draggedItem, 1)[0];
        newFiles.splice(dropIndex, 0, item);
        setFiles(newFiles);
        setDraggedItem(null);
    };

    return (
        <div className="w-full max-w-3xl mx-auto mb-8 bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="text-center text-lg font-bold mb-4">Arrange Files</h3>
            <p className="text-center text-xs text-white/40 mb-4">Drag and drop to reorder</p>

            <div className="flex flex-col gap-2">
                {files.map((file, idx) => (
                    <div
                        key={`${file.name}-${idx}`}
                        draggable
                        onDragStart={(e) => onDragStart(e, idx)}
                        onDragOver={(e) => onDragOver(e, idx)}
                        onDrop={(e) => onDrop(e, idx)}
                        className={`
                            flex items-center gap-4 bg-white/10 p-3 rounded-lg border border-white/5 transition-all
                            ${draggedItem === idx ? 'opacity-50' : 'hover:bg-white/20'}
                        `}
                    >
                        <div className="cursor-grab text-white/30 hover:text-white">
                            <GripVertical size={20} />
                        </div>

                        <div className="flex-grow min-w-0">
                            <p className="font-medium truncate text-sm">{file.name}</p>
                            <p className="text-xs text-white/40">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>

                        <div className="flex items-center gap-1">
                            <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1 text-white/30 hover:text-white disabled:opacity-0">
                                <ChevronUp size={18} />
                            </button>
                            <button onClick={() => moveDown(idx)} disabled={idx === files.length - 1} className="p-1 text-white/30 hover:text-white disabled:opacity-0">
                                <ChevronDown size={18} />
                            </button>
                        </div>

                        <button onClick={() => remove(idx)} className="p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors ml-2">
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
