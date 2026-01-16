'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackgroundCanvas from '@/components/BackgroundCanvas';
import { Upload, X, File as FileIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { usePdfTools } from '@/hooks/usePdfTools';
import { CompressOptions, ProtectOptions, PageSelector, FileReorderList } from './ToolHelpers';
import { useRef } from 'react';

import DocFixInterface from './DocFixInterface';

// Client Component to handle state
export default function ToolInterface({ tool }: { tool: any }) {
    if (tool.type === 'docfix') {
        return <DocFixInterface tool={tool} />;
    }

    const {
        files,
        addFiles,
        removeFile,
        setFiles,
        status,
        processFiles,
        result,
        reset,
        errorMessage,
        // Options
        quality, setQuality,
        password, setPassword,
        selectedPages, setSelectedPages
    } = usePdfTools(tool.id);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(Array.from(e.target.files));
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDownload = () => {
        if (result) {
            const url = URL.createObjectURL(result);
            const a = document.createElement('a');
            a.href = url;
            let ext = 'pdf';
            if (tool.id === 'pdf-to-jpg' || tool.action === 'split') ext = 'zip';
            a.download = `processed_${tool.id}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    // --- RENDER STATES ---

    // 1. SUCCESS STATE
    if (status === 'success' && result) {
        return (
            <main className="min-h-screen relative flex flex-col">
                <BackgroundCanvas />
                <Header />
                <div className="tool-interface pt-32 tool-enter-active flex-grow flex items-center justify-center">
                    <div className="w-full max-w-4xl mx-auto px-4 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4 text-green-400">
                            <CheckCircle size={40} />
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Success!</h1>
                        <p className="text-white/60 mb-8">Your files have been processed successfully.</p>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md mx-auto backdrop-blur-md">
                            <p className="mb-6 font-medium">
                                Ready for download ({(result.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                            <button onClick={handleDownload} className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-lg mb-4">
                                ⬇️ Download File
                            </button>
                            <button onClick={reset} className="text-white/50 hover:text-white text-sm">
                                Process Another File
                            </button>
                        </div>
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    // 2. STAGING / CONFIGURATION AREA
    if (status === 'idle' && files.length > 0) {
        const isPageSelectTool = ['extract-pages', 'remove-pages'].includes(tool.id);
        const isCompress = tool.id === 'compress-pdf';
        const isProtect = tool.id === 'protect-pdf';

        return (
            <main className="min-h-screen relative flex flex-col">
                <BackgroundCanvas />
                <Header />
                <div className="tool-interface pt-32 tool-enter-active flex-grow flex items-start justify-center">
                    <div className="w-full max-w-4xl mx-auto px-4">
                        <h2 className="text-2xl font-bold text-center mb-6">
                            Configure & Process
                        </h2>

                        {/* File Preview */}
                        {tool.id === 'merge-pdf' ? (
                            <FileReorderList files={files} setFiles={setFiles} />
                        ) : (
                            !isPageSelectTool && (
                                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-8 backdrop-blur-sm mx-auto max-w-2xl">
                                    {files.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-4 border-b border-white/10 last:border-0 hover:bg-white/5 transition-colors">
                                            <div className="p-2 bg-white/10 rounded-lg text-white/70">
                                                <FileIcon size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{file.name}</p>
                                                <p className="text-xs text-white/40">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                            <button
                                                onClick={() => removeFile(idx)}
                                                className="text-white/30 hover:text-red-400 transition-colors p-2"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* TOOL SPECIFIC OPTIONS */}
                        {isCompress && <CompressOptions quality={quality} setQuality={setQuality} />}
                        {isProtect && <ProtectOptions password={password} setPassword={setPassword} />}
                        {isPageSelectTool && (
                            <PageSelector
                                file={files[0]}
                                selectedPages={selectedPages}
                                setSelectedPages={setSelectedPages}
                            />
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-center gap-4 mt-8">
                            {tool.id === 'merge-pdf' && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all font-medium"
                                >
                                    + Add More
                                </button>
                            )}
                            {/* Cancel/Reset */}
                            <button onClick={reset} className="px-6 py-3 rounded-xl text-white/50 hover:text-white transition-all font-medium">
                                Cancel
                            </button>

                            <button
                                onClick={processFiles}
                                className="btn-primary px-8 py-3 text-lg flex items-center gap-2"
                            >
                                {tool.id === 'compress-pdf' ? 'Compress PDF' :
                                    tool.id === 'protect-pdf' ? 'Encrypt PDF' :
                                        tool.title.split(' ')[0] + ' Now'}
                            </button>
                        </div>

                        {/* Hidden Input for Add More */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept={tool.accept}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    // 3. PROCESSING STATE
    if (status === 'processing') {
        return (
            <main className="min-h-screen relative flex flex-col">
                <BackgroundCanvas />
                <Header />
                <div className="tool-interface pt-32 tool-enter-active flex-grow flex flex-col items-center justify-center">
                    <Loader2 size={48} className="animate-spin text-accent-primary mb-6" />
                    <h2 className="text-2xl font-bold mb-2">Processing...</h2>
                    <p className="text-white/60">Please wait while we handle your files.</p>
                </div>
                <Footer />
            </main>
        );
    }

    // 4. DEFAULT DROPZONE (No files yet)
    return (
        <main className="min-h-screen relative flex flex-col">
            <BackgroundCanvas />
            <Header />

            <div className="tool-interface pt-32 tool-enter-active flex-grow flex items-center justify-center">
                <div className="w-full max-w-4xl mx-auto px-4 text-center">
                    {/* Tool Header */}
                    <div className="tool-header-inner mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            {tool.title}
                        </h1>
                        <p className="text-lg text-white/60 max-w-xl mx-auto">{tool.desc}</p>
                    </div>

                    {/* Error Message */}
                    {errorMessage && (
                        <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-200">
                            <AlertCircle size={20} />
                            <p>{errorMessage}</p>
                        </div>
                    )}

                    {/* Action Area (Dropzone) */}
                    <div className="action-area max-w-2xl mx-auto">
                        <div
                            className="dropzone group cursor-pointer relative overflow-hidden"
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors duration-300" />

                            <div className="relative z-10 flex flex-col items-center gap-6 py-12">
                                {/* Icon */}
                                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-white/10 group-hover:border-blue-500/30 shadow-2xl">
                                    <img
                                        src={tool.icon}
                                        alt={tool.title}
                                        className="w-10 h-10 invert opacity-90"
                                    />
                                </div>

                                <div className="text-center">
                                    <p className="text-2xl font-semibold mb-3">Drop your files here</p>
                                    <span className="inline-block px-4 py-1 rounded-full bg-white/5 text-sm text-white/50 border border-white/5">
                                        or click to select {tool.accept?.replace(/\./g, '').toUpperCase()} files
                                    </span>
                                </div>

                                <button className="btn-primary mt-2 flex items-center gap-2 pointer-events-none">
                                    <Upload size={20} />
                                    Select Files
                                </button>

                                {tool.id === 'scan-pdf' && (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                document.getElementById('cameraInput')?.click();
                                            }}
                                            className="btn-primary bg-red-500 hover:bg-red-600 mt-2 flex items-center gap-2 pointer-events-auto z-20"
                                        >
                                            📷 Camera
                                        </button>
                                        <input
                                            id="cameraInput"
                                            type="file"
                                            capture="environment"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                    </>
                                )}
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept={tool.accept}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </main>
    );
}
