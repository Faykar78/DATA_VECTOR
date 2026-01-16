'use client';

import { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackgroundCanvas from '@/components/BackgroundCanvas';
import { Upload, X, CheckCircle, AlertCircle, Loader2, Download, RefreshCw, Settings2, Image as ImageIcon } from 'lucide-react';

// --- Types ---

type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';
type FitMode = 'cover' | 'contain';
type Format = 'image/jpeg' | 'image/png' | 'image/webp';
type QualityPreset = 'default' | 'high' | 'small';

interface DocFixSettings {
    width: number;
    height: number;
    maxKb: number;
    minKb: number;
    format: Format;
    fitMode: FitMode;
    qualityPreset: QualityPreset;
    bgColor: string;
}

// --- Logic Helpers (Ported) ---

function extensionForFormat(fmt: Format) {
    if (fmt === "image/png") return "png";
    if (fmt === "image/webp") return "webp";
    return "jpg";
}

function formatLabel(fmt: Format) {
    if (fmt === "image/png") return "PNG";
    if (fmt === "image/webp") return "WebP";
    return "JPEG";
}

function toBlobAsync(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
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

function dataURLToImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

async function compressToTarget(
    sourceImg: HTMLImageElement,
    settings: DocFixSettings
): Promise<{ blob: Blob; sizeKb: number; finalQuality: number | null }> {
    // Create temporary canvas
    const canvas = document.createElement('canvas');
    canvas.width = settings.width;
    canvas.height = settings.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error("Could not get canvas context");

    // Fill background
    ctx.fillStyle = settings.bgColor || "#ffffff";
    ctx.fillRect(0, 0, settings.width, settings.height);

    // Draw Image logic
    const iw = sourceImg.width;
    const ih = sourceImg.height;

    const scaleContain = Math.min(settings.width / iw, settings.height / ih);
    const scaleCover = Math.max(settings.width / iw, settings.height / ih);

    const s = settings.fitMode === 'cover' ? scaleCover : scaleContain;
    const drawW = iw * s;
    const drawH = ih * s;

    const dx = (settings.width - drawW) / 2;
    const dy = (settings.height - drawH) / 2;

    ctx.drawImage(sourceImg, dx, dy, drawW, drawH);

    // Compression Loop
    if (settings.format === "image/png") {
        const blob = await toBlobAsync(canvas, settings.format);
        const sizeKb = blob.size / 1024;
        return { blob, sizeKb, finalQuality: null };
    }

    let startQuality = 0.9;
    let minQuality = 0.4;

    if (settings.qualityPreset === "high") {
        startQuality = 0.95;
        minQuality = 0.6;
    } else if (settings.qualityPreset === "small") {
        startQuality = 0.8;
        minQuality = 0.3;
    }

    let q = startQuality;
    let bestBlob: Blob | null = null;
    let bestSize = Infinity;
    let bestQ = null;

    for (let i = 0; i < 15; i++) {
        const blob = await toBlobAsync(canvas, settings.format, q);
        const sizeKb = blob.size / 1024;

        // If under limit, this is a valid candidate
        if (sizeKb <= settings.maxKb) {
            bestBlob = blob;
            bestSize = sizeKb;
            bestQ = q;
            // We found a valid one, but maybe we can get closer to limit with higher quality
            // Standard approach: simple linear descent. If we found one, we could stop if it is "good enough"
            // But legacy code breaks on first valid? Legacy code:
            // if (sizeKb <= maxKb) { bestBlob... break; } -- Yes, it takes the first one that fits (highest quality)
            break;
        }

        // If over limit, keep track of smallest seen so far just in case we never hit target
        if (sizeKb < bestSize) {
            bestBlob = blob;
            bestSize = sizeKb;
            bestQ = q;
        }

        q -= 0.05; // Slightly finer step than legacy 0.08
        if (q < minQuality) break;
    }

    if (!bestBlob) throw new Error("Could not compress to target.");

    // If we finished loop and bestSize is still > maxKb, we might want to return it anyway or throw?
    // Legacy throws if !bestBlob (which is initialized to null).
    // But bestBlob is set in loop. If we only find files > maxKb, bestBlob holds the smallest one.

    return { blob: bestBlob, sizeKb: bestSize, finalQuality: bestQ };
}


// --- Main Component ---

export default function DocFixInterface({ tool }: { tool: any }) {
    // State
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [result, setResult] = useState<{ blob: Blob; sizeKb: number; finalQuality: number | null } | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [mode, setMode] = useState<'photo' | 'signature'>('photo');

    // Settings State
    const [settings, setSettings] = useState<DocFixSettings>({
        width: 200,
        height: 230,
        maxKb: 50,
        minKb: 20,
        format: 'image/jpeg',
        fitMode: 'cover',
        qualityPreset: 'default',
        bgColor: '#ffffff'
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Apply Presets
    useEffect(() => {
        if (mode === 'photo') {
            setSettings(prev => ({
                ...prev,
                width: 200, height: 230, maxKb: 50, minKb: 20,
                format: 'image/jpeg', fitMode: 'cover', bgColor: '#ffffff'
            }));
        } else {
            setSettings(prev => ({
                ...prev,
                width: 140, height: 60, maxKb: 20, minKb: 5,
                format: 'image/jpeg', fitMode: 'contain', bgColor: '#ffffff'
            }));
        }
    }, [mode]);


    // Handlers
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            loadFile(e.target.files[0]);
        }
    };

    const loadFile = (f: File) => {
        if (!f.type.startsWith('image/')) {
            setErrorMsg("Please upload a valid image file.");
            return;
        }
        setFile(f);
        setPreviewUrl(URL.createObjectURL(f));
        setStatus('idle');
        setResult(null);
        setErrorMsg(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            loadFile(e.dataTransfer.files[0]);
        }
    };

    const handleProcess = async () => {
        if (!file || !previewUrl) return;
        setStatus('processing');
        setErrorMsg(null);

        try {
            // Wait for image to load
            const img = await dataURLToImage(previewUrl);
            const res = await compressToTarget(img, settings);
            setResult(res);
            setStatus('success');
        } catch (err: any) {
            console.error(err);
            setStatus('error');
            setErrorMsg(err.message || "Failed to process image.");
        }
    };

    const handleDownload = () => {
        if (!result || !file) return;
        const ext = extensionForFormat(settings.format);
        const nameBase = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const fileName = `${nameBase}-docfix.${ext}`;

        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleReset = () => {
        setResult(null);
        setStatus('idle');
        // keep file loaded? behavior in legacy was reset output but keep input.
    };

    const handleFullReset = () => {
        setResult(null);
        setStatus('idle');
        setFile(null);
        setPreviewUrl(null);
    };


    // --- RENDER ---

    return (
        <main className="min-h-screen relative flex flex-col font-sans text-white">
            <BackgroundCanvas />
            <Header />

            <div className="pt-32 pb-20 flex-grow px-4 relative z-10 flex flex-col items-center">

                {/* Header Section */}
                <div className="text-center mb-10 max-w-2xl">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-teal-400">
                        {tool.title}
                    </h1>
                    <p className="text-lg text-white/60">{tool.desc}</p>
                </div>

                {/* Main Content Card */}
                <div className="w-full max-w-6xl bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[600px]">

                    {/* LEFT PANEL: CONFIGURATION */}
                    <div className="w-full md:w-1/3 bg-white/5 border-b md:border-b-0 md:border-r border-white/10 p-6 flex flex-col">

                        {/* Mode Tabs */}
                        <div className="flex bg-black/40 p-1 rounded-xl mb-6">
                            {(['photo', 'signature'] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${mode === m ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
                                        }`}
                                >
                                    {m} Fixer
                                </button>
                            ))}
                        </div>

                        {/* Settings Form */}
                        <div className="space-y-5 overflow-y-auto pr-2 custom-scrollbar flex-grow">

                            {/* Dimensions */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-medium text-white/70">
                                    <Settings2 size={16} /> Dimensions (px)
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-white/40 mb-1 block">Width</label>
                                        <input
                                            type="number"
                                            value={settings.width}
                                            onChange={e => setSettings({ ...settings, width: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-green-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/40 mb-1 block">Height</label>
                                        <input
                                            type="number"
                                            value={settings.height}
                                            onChange={e => setSettings({ ...settings, height: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-green-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Size Limits */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-white/70">Size Limits (KB)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-white/40 mb-1 block">Max KB</label>
                                        <input
                                            type="number"
                                            value={settings.maxKb}
                                            onChange={e => setSettings({ ...settings, maxKb: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-green-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/40 mb-1 block">Min KB (Optional)</label>
                                        <input
                                            type="number"
                                            value={settings.minKb}
                                            onChange={e => setSettings({ ...settings, minKb: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-green-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Other Options */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-white/40 mb-1 block">Output Format</label>
                                    <select
                                        value={settings.format}
                                        onChange={e => setSettings({ ...settings, format: e.target.value as Format })}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-green-500 outline-none"
                                    >
                                        <option value="image/jpeg">JPEG (Standard)</option>
                                        <option value="image/png">PNG (Lossless)</option>
                                        <option value="image/webp">WebP (Modern)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-white/40 mb-1 block">Fit Mode</label>
                                    <div className="flex bg-black/30 rounded-lg p-1">
                                        <button
                                            onClick={() => setSettings({ ...settings, fitMode: 'cover' })}
                                            className={`flex-1 py-1.5 text-xs rounded transition-colors ${settings.fitMode === 'cover' ? 'bg-white/20 text-white' : 'text-white/40'}`}
                                        >
                                            Cover (Crop)
                                        </button>
                                        <button
                                            onClick={() => setSettings({ ...settings, fitMode: 'contain' })}
                                            className={`flex-1 py-1.5 text-xs rounded transition-colors ${settings.fitMode === 'contain' ? 'bg-white/20 text-white' : 'text-white/40'}`}
                                        >
                                            Contain (Bars)
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-white/40 mb-1 block">Background</label>
                                    <div className="flex gap-2">
                                        {['#ffffff', '#000000', 'transparent'].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setSettings({ ...settings, bgColor: c === 'transparent' ? 'transparent' : c })}
                                                className={`w-8 h-8 rounded-full border-2 ${settings.bgColor === c ? 'border-green-500' : 'border-white/10'}`}
                                                style={{ backgroundColor: c === 'transparent' ? 'transparent' : c }}
                                                title={c}
                                            >
                                                {c === 'transparent' && <div className="w-full h-full bg-[url('/images/transparent-grid.png')] bg-cover opacity-50 rounded-full" />}
                                            </button>
                                        ))}
                                        <input
                                            type="color"
                                            value={settings.bgColor === 'transparent' ? '#ffffff' : settings.bgColor}
                                            onChange={e => setSettings({ ...settings, bgColor: e.target.value })}
                                            className="w-8 h-8 rounded-full border-none p-0 overflow-hidden cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* RIGHT PANEL: INTERACTION AREA */}
                    <div className="w-full md:w-2/3 p-8 relative flex flex-col bg-[#111]">

                        {/* Error Banner */}
                        {errorMsg && (
                            <div className="absolute top-4 left-8 right-8 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                                <AlertCircle size={20} />
                                <span className="text-sm">{errorMsg}</span>
                                <button onClick={() => setErrorMsg(null)} className="ml-auto"><X size={16} /></button>
                            </div>
                        )}

                        <div className="flex-grow flex items-center justify-center min-h-[400px]">

                            {/* CASE 1: NO FILE */}
                            {!file && (
                                <div
                                    className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center hover:border-green-500/50 hover:bg-green-500/5 transition-all cursor-pointer w-full max-w-lg mx-auto"
                                    onDrop={handleDrop}
                                    onDragOver={e => e.preventDefault()}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-green-400">
                                        <Upload size={32} />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">Upload Image</h3>
                                    <p className="text-white/40 mb-6">Drag & drop or click to select</p>
                                    <span className="text-xs text-white/30 bg-white/5 px-3 py-1 rounded-full">JPG, PNG, WebP</span>
                                </div>
                            )}

                            {/* CASE 2: FILE LOADED (PREVIEW) */}
                            {file && !result && status !== 'processing' && (
                                <div className="flex flex-col items-center w-full max-w-xl">
                                    <div className="w-full aspect-video bg-[url('/images/transparent-grid.png')] bg-repeat rounded-xl overflow-hidden mb-6 relative border border-white/10">
                                        {/* Original Image Preview */}
                                        <img
                                            src={previewUrl!}
                                            alt="Preview"
                                            className="w-full h-full object-contain absolute inset-0"
                                        />
                                    </div>
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="flex-grow">
                                            <p className="font-medium truncate">{file.name}</p>
                                            <p className="text-sm text-white/40">
                                                {(file.size / 1024).toFixed(1)} KB • {file.type.split('/')[1].toUpperCase()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleFullReset}
                                            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-red-400 transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <button
                                        onClick={handleProcess}
                                        className="mt-8 w-full btn-primary bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-400 hover:to-teal-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                                    >
                                        <RefreshCw size={20} /> Process Image
                                    </button>
                                </div>
                            )}

                            {/* CASE 3: PROCESSING */}
                            {status === 'processing' && (
                                <div className="text-center">
                                    <Loader2 size={48} className="animate-spin text-green-400 mx-auto mb-4" />
                                    <h3 className="text-xl font-medium">Compressing...</h3>
                                </div>
                            )}

                            {/* CASE 4: SUCCESS RESULT */}
                            {result && status === 'success' && (
                                <div className="flex flex-col items-center w-full max-w-xl animate-in fade-in zoom-in duration-300">
                                    <div className="w-full aspect-video bg-[url('/images/transparent-grid.png')] bg-repeat rounded-xl overflow-hidden mb-6 relative border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                                        <img
                                            src={URL.createObjectURL(result.blob)}
                                            alt="Result"
                                            className="w-full h-full object-contain absolute inset-0"
                                        />
                                        <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                                            RESULT
                                        </div>
                                    </div>

                                    <div className="w-full bg-white/5 rounded-xl p-4 flex items-center justify-between mb-6 border border-white/10">
                                        <div>
                                            <p className="text-sm text-white/40 mb-1">Original</p>
                                            <p className="font-mono">{(file!.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                        <div className="text-center text-white/20">➜</div>
                                        <div className="text-right">
                                            <p className="text-sm text-green-400 mb-1">Compressed</p>
                                            <p className="font-mono font-bold text-lg">{result.sizeKb.toFixed(1)} KB</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 w-full">
                                        <button
                                            onClick={handleReset}
                                            className="flex-1 py-3 rounded-xl font-medium border border-white/10 hover:bg-white/5 text-white/70 transition-colors"
                                        >
                                            Try Again
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="flex-[2] btn-primary bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-400 hover:to-teal-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                                        >
                                            <Download size={20} /> Download
                                        </button>
                                    </div>

                                    {result.sizeKb > settings.maxKb && (
                                        <p className="text-amber-400 text-xs mt-4 flex items-center gap-1">
                                            <AlertCircle size={12} /> Could not reach target {settings.maxKb} KB.
                                        </p>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileChange}
                />

            </div>

            <Footer />
        </main>
    );
}
