import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { invoke } from '@tauri-apps/api/core';
import { Bot, ChevronLeft, ChevronRight, Plus, Minus, Copy, RotateCcw, Trash2 } from 'lucide-react';
import './pdf_viewer.css';

// Set worker source - we use the public file with .mjs extension to match the library expectation
try {
    // We use the absolute URL to ensure it's found
    const workerUrl = new URL('/pdf.worker.min.mjs', window.location.origin).toString();
    console.log("Setting PDF Worker Src to:", workerUrl);
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
} catch (e) {
    console.error("Failed to set PDF worker:", e);
}

const PdfReader = ({
    filePath,
    bookId,
    onAskAi,
    currentPage: propPage,
    onPageChange,
    onTotalPages,
    scale: propScale,
    onScaleChange,
    darkMode: propDarkMode,
    onDarkModeChange
}) => {
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const containerRef = useRef(null);

    const [pdfDoc, setPdfDoc] = useState(null);

    const [localPage, setLocalPage] = useState(1);
    const currentPage = propPage !== undefined ? propPage : localPage;
    const setCurrentPage = onPageChange || setLocalPage;

    const [totalPages, setTotalPages] = useState(0);

    const [localScale, setLocalScale] = useState(1.5);
    const scale = propScale !== undefined ? propScale : localScale;
    const setScale = onScaleChange || setLocalScale;

    // Sync initial scale
    useEffect(() => {
        if (onScaleChange && propScale !== 1.5 && propScale <= 3) {
            // Already set or needs default
        } else if (onScaleChange && propScale === 1) {
            onScaleChange(1.5);
        }
    }, []);

    useEffect(() => {
        if (onTotalPages) onTotalPages(totalPages);
    }, [totalPages, onTotalPages]);
    const [rendering, setRendering] = useState(false);
    const [error, setError] = useState(null);
    const [localDarkMode, setLocalDarkMode] = useState(true);
    const darkMode = propDarkMode !== undefined ? propDarkMode : localDarkMode;
    const setDarkMode = onDarkModeChange || setLocalDarkMode;
    const [highlights, setHighlights] = useState([]);
    const [selectionMenu, setSelectionMenu] = useState({ visible: false, x: 0, y: 0, text: '', range: null });
    const [metadata, setMetadata] = useState({ title: 'Loading...', author: '' });

    // Load Highlights for this book
    useEffect(() => {
        async function loadHighlights() {
            if (!bookId) return;
            try {
                const data = await invoke('get_highlights', { bookId });
                setHighlights(data);
            } catch (e) {
                console.error("Failed to load highlights:", e);
            }
        }
        loadHighlights();
    }, [bookId]);

    // Load PDF is handled by the second useEffect below
    // (Cleaning up duplicate effect found in existing code)

    // Handle Selection
    useEffect(() => {
        const handleGlobalMouseUp = (e) => {
            // Don't process if clicking on the menu
            if (e.target.closest('.selection-menu')) {
                return;
            }

            const selection = window.getSelection();

            // Check click on existing highlight overlay
            if (e.target.dataset.highlightId) {
                e.preventDefault();
                e.stopPropagation();
                const id = e.target.dataset.highlightId;
                const highlight = highlights.find(h => h.id === id);
                const rect = e.target.getBoundingClientRect();
                setSelectionMenu({
                    visible: true,
                    x: rect.left + (rect.width / 2),
                    y: rect.top - 10,
                    text: highlight ? highlight.content : '',
                    highlightId: id,
                    rects: null
                });
                return;
            }

            // Get selected text immediately
            const selectedText = selection ? selection.toString() : '';

            if (selectedText.length > 0) {
                try {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();

                    if (rect.width === 0 || rect.height === 0) return;

                    // Check if within viewer
                    if (e.target.closest('.textLayer') || e.target.closest('canvas')) {
                        // Capture Rects for Coordinate-based Highlighting
                        let normalizedRects = [];
                        if (textLayerRef.current) {
                            const pageRect = textLayerRef.current.getBoundingClientRect();
                            const clientRects = range.getClientRects();

                            for (const r of clientRects) {
                                normalizedRects.push({
                                    x: (r.left - pageRect.left) / scale,
                                    y: (r.top - pageRect.top) / scale,
                                    width: r.width / scale,
                                    height: r.height / scale
                                });
                            }
                        }

                        setSelectionMenu({
                            visible: true,
                            x: rect.left + (rect.width / 2),
                            y: rect.top - 10,
                            text: selectedText,
                            range: range.cloneRange(),
                            rects: normalizedRects,
                            highlightId: null
                        });
                    }
                } catch (err) {
                    console.warn("Could not get range:", err);
                }
            } else if (!e.target.closest('.selection-menu')) {
                setSelectionMenu(prev => prev.visible ? { ...prev, visible: false } : prev);
            }
        };

        document.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [scale, highlights]);

    const addHighlight = async (color) => {
        if ((!selectionMenu.text && !selectionMenu.highlightId) || !bookId) {
            if (!selectionMenu.highlightId) console.warn("bookId missing or no text selected");
        }

        // Handle Delete/Edit
        if (selectionMenu.highlightId) {
            const oldId = selectionMenu.highlightId;
            setHighlights(prev => prev.filter(h => h.id !== oldId));
            try { await invoke('delete_highlight', { id: oldId }); } catch (e) { }
        }

        const newHighlight = {
            id: crypto.randomUUID(),
            book_id: bookId,
            content: selectionMenu.text || "Image/Area", // Fallback if text missing
            annotation: null,
            location: JSON.stringify({
                page: currentPage,
                rects: selectionMenu.rects || [] // NEW: Store coordinates
            }),
            color: color
        };

        try {
            if (bookId) {
                await invoke('add_highlight', { highlight: newHighlight });
            }
            setHighlights(prev => [...prev, newHighlight]);

            setSelectionMenu({ ...selectionMenu, visible: false });
            window.getSelection().removeAllRanges();
        } catch (e) {
            console.error("Failed to add highlight:", e);
            setError("Failed to save highlight");
        }
    };

    const deleteHighlight = async () => {
        if (!selectionMenu.highlightId) return;
        const id = selectionMenu.highlightId;
        setHighlights(prev => prev.filter(h => h.id !== id));
        setSelectionMenu({ ...selectionMenu, visible: false });
        try {
            await invoke('delete_highlight', { id });
        } catch (e) {
            console.error("Failed to delete highlight:", e);
        }
    };




    // Load PDF is handled by the second useEffect below
    // (Cleaning up duplicate effect found in existing code)



    // Zoom Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault(); e.stopPropagation();
                    setScale(prev => Math.min(prev + 0.2, 5.0));
                } else if (e.key === '-' || e.key === '_') {
                    e.preventDefault(); e.stopPropagation();
                    setScale(prev => Math.max(prev - 0.2, 0.5));
                } else if (e.key === '0') {
                    e.preventDefault(); e.stopPropagation();
                    setScale(1.5);
                }
            }
        };

        const handleWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setScale(prev => Math.min(Math.max(prev + delta, 0.5), 5.0));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const copyText = async () => {
        if (selectionMenu.text) {
            await navigator.clipboard.writeText(selectionMenu.text);
            setSelectionMenu({ ...selectionMenu, visible: false });
            window.getSelection().removeAllRanges();
        }
    };

    // Load PDF
    useEffect(() => {
        async function loadPdf() {
            try {
                if (!filePath) return;
                setError(null);
                console.log("Loading PDF from:", filePath);
                const data = await invoke('read_book_file', { filePath });

                if (!data || data.length === 0) {
                    throw new Error("Empty file data received from backend");
                }

                console.log("PDF Data Size:", data.length);
                const arrayBuffer = new Uint8Array(data);

                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const doc = await loadingTask.promise;

                console.log("PDF Loaded. Pages:", doc.numPages);
                setPdfDoc(doc);
                setTotalPages(doc.numPages);
                setCurrentPage(1);
            } catch (e) {
                console.error("Error loading PDF:", e);
                setError(e.toString());
            }
        }
        if (filePath) loadPdf();
    }, [filePath]);

    // Render Page
    useEffect(() => {
        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current || rendering) return;

            setRendering(true);
            try {
                const page = await pdfDoc.getPage(currentPage);
                const viewport = page.getViewport({ scale });

                // Canvas Render
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };
                await page.render(renderContext).promise;

                // Text Layer Render
                if (textLayerRef.current) {
                    const textLayerDiv = textLayerRef.current;
                    textLayerDiv.innerHTML = ""; // Clear previous text
                    textLayerDiv.style.height = `${viewport.height}px`;
                    textLayerDiv.style.width = `${viewport.width}px`;
                    textLayerDiv.style.setProperty('--scale-factor', scale);

                    const textContent = await page.getTextContent();
                    console.log("Text content loaded:", textContent);

                    // Custom Text Rendering Loop to avoid needing TextLayer module import issues
                    // This mimics what PDF.js TextLayer does but simpler
                    textContent.items.forEach(item => {
                        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                        const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));

                        const span = document.createElement('span');
                        span.textContent = item.str;
                        span.style.fontFamily = 'sans-serif';
                        span.style.fontSize = `${fontHeight}px`;
                        span.style.position = 'absolute';
                        span.style.left = `${tx[4]}px`;
                        span.style.top = `${tx[5] - fontHeight}px`;
                        span.style.transform = `scaleX(${tx[0] / fontHeight})`;

                        // Check if this text is part of a highlight (Legacy Fallback)
                        // Verify if we have rects-based highlights first, if so skip text matching
                        // Not strictly necessary to remove, but cleaner to not double-process.
                        // We will rely on the Overlay Layer for all highlights now.
                        // (Removing text-match logic to prevent duplicate or ugly rendering)

                        span.style.color = 'transparent';
                        span.style.cursor = 'text';
                        span.style.whiteSpace = 'pre';

                        textLayerDiv.appendChild(span);
                    });
                }

            } catch (e) {
                console.error("Render error:", e);
                setError(`Render Error on Page ${currentPage}: ${e.message}`);
            } finally {
                setRendering(false);
            }
        };
        renderPage();
    }, [pdfDoc, currentPage, scale]);

    const changePage = (offset) => {
        const newPage = currentPage + offset;
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative',
            background: '#1a1a1a',
            color: '#e0e0e0',
            overflow: 'hidden'
        }}>


            {error && (
                <div style={{
                    position: 'absolute',
                    top: '140px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 90,
                    color: '#ff6b6b',
                    background: 'rgba(30,0,0,0.8)',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #ff4444'
                }}>
                    {error}
                </div>
            )}

            {/* Content Container */}
            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '60px 20px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    background: '#1a1a1a',
                    width: '100%'
                }}
            >
                <div style={{
                    position: 'relative',
                    borderRadius: '4px',
                    lineHeight: 0,
                    filter: darkMode ? 'invert(0.9) hue-rotate(180deg)' : 'none',
                    transition: 'filter 0.3s ease'
                }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                    <div
                        ref={textLayerRef}
                        className="textLayer"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            overflow: 'hidden',
                            lineHeight: 1.0,
                        }}
                    ></div>

                    {/* Highlight Overlay Layer */}
                    <div className="highlight-layer" style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        zIndex: 5
                    }}>
                        {highlights.filter(h => {
                            try {
                                const loc = JSON.parse(h.location);
                                return loc.page === currentPage;
                            } catch (e) { return false; }
                        }).map(h => {
                            try {
                                const loc = JSON.parse(h.location);
                                return loc.rects.map((r, i) => (
                                    <div
                                        key={`${h.id}-${i}`}
                                        data-highlight-id={h.id}
                                        style={{
                                            position: 'absolute',
                                            left: `${r.x * scale}px`,
                                            top: `${r.y * scale}px`,
                                            width: `${r.width * scale}px`,
                                            height: `${r.height * scale}px`,
                                            backgroundColor: h.color,
                                            opacity: 0.45,
                                            mixBlendMode: 'multiply',
                                            cursor: 'pointer',
                                            pointerEvents: 'auto',
                                            borderRadius: '1px',
                                            transition: 'opacity 0.2s',
                                        }}
                                        title={`Highlight: ${h.content}`}
                                        onMouseEnter={(e) => e.target.style.opacity = '0.6'}
                                        onMouseLeave={(e) => e.target.style.opacity = '0.45'}
                                    />
                                ));
                            } catch (e) { return null; }
                        })}
                    </div>
                </div>
            </div>

            {/* Selection Context Menu */}
            {selectionMenu.visible && (
                <div
                    className="selection-menu"
                    style={{
                        position: 'fixed', top: selectionMenu.y, left: selectionMenu.x,
                        background: 'rgba(30,30,40,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '14px', padding: '8px', zIndex: 2000,
                        boxShadow: '0 12px 48px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)',
                        display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px',
                        transform: 'translate(-50%, -100%)', marginTop: '-15px'
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {!selectionMenu.highlightId && (
                        <>
                            <div
                                className="menu-item"
                                onClick={copyText}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                                    cursor: 'pointer', color: '#e0e0e0', borderRadius: '8px',
                                    fontSize: '14px', fontWeight: '500'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <Copy size={16} /> Copy Selection
                            </div>
                            <div
                                className="menu-item"
                                onClick={() => {
                                    if (onAskAi) onAskAi(selectionMenu.text);
                                    setSelectionMenu({ ...selectionMenu, visible: false });
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                                    cursor: 'pointer', color: '#a18cd1', borderRadius: '8px',
                                    fontSize: '14px', fontWeight: '600'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(161, 140, 209, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <Bot size={16} /> Ask AI
                            </div>
                        </>
                    )}


                    {selectionMenu.highlightId && (
                        <>
                            <div
                                className="menu-item"
                                onClick={() => {
                                    if (onAskAi) onAskAi(selectionMenu.text);
                                    setSelectionMenu({ ...selectionMenu, visible: false });
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                                    cursor: 'pointer', color: '#a18cd1', borderRadius: '8px',
                                    fontSize: '14px', fontWeight: '600'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(161, 140, 209, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <Bot size={16} /> Ask AI
                            </div>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                        </>
                    )}

                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.4)', padding: '6px 14px 2px', fontWeight: 'bold' }}>
                        {selectionMenu.highlightId ? 'Edit Shade' : 'Add Highlight'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['#ffeb3b', '#a2fca2', '#90caf9', '#f48fb1'].map((c) => (
                                <div
                                    key={c}
                                    onClick={() => addHighlight(c)}
                                    style={{
                                        width: '28px', height: '28px', borderRadius: '50%', background: c,
                                        cursor: 'pointer', border: '2px solid rgba(255,255,255,0.15)'
                                    }}
                                />
                            ))}
                        </div>

                        {selectionMenu.highlightId && (
                            <button
                                onClick={deleteHighlight}
                                className="btn-icon"
                                style={{ background: 'rgba(255, 68, 68, 0.1)', color: '#ff6b6b', marginLeft: '10px' }}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .textLayer ::selection { background: rgba(255, 235, 59, 0.4) !important; color: transparent !important; }
                .textLayer span { opacity: 1 !important; }
                @keyframes fadeInZoom { from { opacity: 0; transform: translate(-50%, -90%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -100%) scale(1); } }
                .selection-menu { animation: fadeInZoom 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
                .btn-icon { background: transparent; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 8px; transition: all 0.2s; }
                .btn-icon:hover { background: rgba(255,255,255,0.1); }
                .btn-icon:disabled { opacity: 0.3; cursor: not-allowed; }
            `}</style>
        </div>
    );
};

export default PdfReader;
