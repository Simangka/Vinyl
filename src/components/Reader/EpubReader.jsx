import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Minus, RotateCcw, Copy, Search, Trash2, ChevronLeft, ChevronRight, Bot } from 'lucide-react';

const EpubReader = ({
    filePath,
    bookId,
    onAskAi,
    index: propIndex,
    onIndexChange,
    onTotalChapters,
    fontSize: propFontSize,
    onFontSizeChange,
    showSearchBar: propShowSearch,
    onShowSearchBarChange
}) => {
    const [originalContent, setOriginalContent] = useState("");

    // Fallback to local state if props not provided (though in Reader.jsx they are)
    const [localIndex, setLocalIndex] = useState(0);
    const index = propIndex !== undefined ? propIndex : localIndex;
    const setIndex = onIndexChange || setLocalIndex;

    const [total, setTotal] = useState(0);
    const containerRef = useRef(null);

    const [localFontSize, setLocalFontSize] = useState(18);
    const fontSize = propFontSize !== undefined ? propFontSize : localFontSize;
    const setFontSize = onFontSizeChange || setLocalFontSize;

    // Sync initial fontSize if it was defaulted in Reader.jsx
    useEffect(() => {
        if (onFontSizeChange && propFontSize === 1) { // 1 is PDF default, fix mismatch
            onFontSizeChange(18);
        }
    }, []);

    useEffect(() => {
        if (onTotalChapters) onTotalChapters(total);
    }, [total, onTotalChapters]);

    const [searchQuery, setSearchQuery] = useState("");
    const [searchMatchCount, setSearchMatchCount] = useState(0);
    const [localShowSearch, setLocalShowSearch] = useState(false);
    const showSearchBar = propShowSearch !== undefined ? propShowSearch : localShowSearch;
    const setShowSearchBar = onShowSearchBarChange || setLocalShowSearch;

    // Use ref for highlights to avoid re-renders
    const highlightsRef = useRef([]);
    const [highlightsLoaded, setHighlightsLoaded] = useState(false);

    const currentRangeRef = useRef(null);
    const selectionDataRef = useRef({ text: '', highlightId: null });
    const [menuState, setMenuState] = useState({ visible: false, x: 0, y: 0, isEdit: false });

    // Load Highlights into ref (not state)
    useEffect(() => {
        async function loadHighlights() {
            if (!bookId) return;
            try {
                const data = await invoke('get_highlights', { bookId });
                highlightsRef.current = data;
                setHighlightsLoaded(prev => !prev); // Toggle to trigger content render
            } catch (e) {
                console.error("Failed to load highlights:", e);
            }
        }
        loadHighlights();
    }, [bookId]);

    // Load Chapter
    useEffect(() => {
        async function loadChapter() {
            try {
                const [html, count] = await invoke('get_epub_chapter', { filePath, index });
                setOriginalContent(html);
                setTotal(count);
                if (containerRef.current) containerRef.current.scrollTop = 0;
            } catch (e) {
                console.error("Error loading chapter:", e);
            }
        }
        if (filePath) loadChapter();
    }, [filePath, index]);

    // Helper to calculate contrasting text color based on background luminance
    const getContrastingTextColor = (bgColor) => {
        // Convert hex to RGB
        let r, g, b;
        if (bgColor.startsWith('#')) {
            const hex = bgColor.replace('#', '');
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
        } else {
            // Handle rgba/rgb format if needed
            return '#000000'; // Default to black
        }

        // Calculate relative luminance using sRGB formula
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Return black for light backgrounds, white for dark backgrounds
        return luminance > 0.5 ? '#000000' : '#FFFFFF';
    };

    // Unified helper for text nodes
    const getDocLayout = () => {
        if (!containerRef.current) return { nodes: [], combined: "" };
        const walker = document.createTreeWalker(containerRef.current, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let combined = "";
        let node;
        while (node = walker.nextNode()) {
            nodes.push({ node, start: combined.length, end: combined.length + node.textContent.length });
            combined += node.textContent;
        }
        return { nodes, combined };
    };

    // Render content ONLY when chapter/search changes, NOT when highlights change
    useEffect(() => {
        if (!originalContent || !containerRef.current) return;

        // 1. Render raw HTML first
        containerRef.current.innerHTML = originalContent;

        // 2. Identify all text nodes
        const { nodes, combined } = getDocLayout();

        // Helper to wrap a text range across nodes
        const applyRobustWrap = (startIdx, endIdx, elementCreator) => {
            // Re-scan nodes for accuracy after previous wraps
            const current = getDocLayout().nodes;
            current.forEach(({ node, start, end }) => {
                const overlapStart = Math.max(startIdx, start);
                const overlapEnd = Math.min(endIdx, end);
                if (overlapStart < overlapEnd) {
                    try {
                        const r = document.createRange();
                        r.setStart(node, overlapStart - start);
                        r.setEnd(node, overlapEnd - start);

                        // Use extract+insert for maximum robustness
                        const content = r.extractContents();
                        const wrapper = elementCreator();
                        wrapper.appendChild(content);
                        r.insertNode(wrapper);
                    } catch (e) {
                        console.warn("Failed to wrap segment:", e);
                    }
                }
            });
        };

        // 3. Apply Search Highlights
        if (searchQuery.trim()) {
            const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'gi');
            let match;
            let count = 0;
            const matches = [];
            while ((match = regex.exec(combined)) !== null) {
                matches.push({ start: match.index, end: match.index + match[0].length });
                count++;
            }
            matches.forEach(m => applyRobustWrap(m.start, m.end, () => {
                const s = document.createElement('span');
                s.style.background = 'orange';
                s.style.color = 'black';
                return s;
            }));
            setSearchMatchCount(count);
        } else {
            setSearchMatchCount(0);
        }

        // 4. Apply Saved Highlights
        const chapterHighlights = highlightsRef.current.filter(h => {
            try {
                const loc = JSON.parse(h.location);
                return loc.chapter === index;
            } catch { return false; }
        });

        chapterHighlights.forEach(h => {
            let startIdx = -1;
            try {
                const loc = JSON.parse(h.location);
                if (loc.offset !== undefined) {
                    startIdx = loc.offset;
                } else {
                    // Fallback to occurrence-based search
                    let pos = 0;
                    for (let i = 0; i < (loc.occurrence || 1); i++) {
                        const m = combined.indexOf(h.content, pos);
                        if (m === -1) break;
                        startIdx = m;
                        pos = m + 1;
                    }
                }
            } catch { }

            if (startIdx !== -1) {
                applyRobustWrap(startIdx, startIdx + h.content.length, () => {
                    const mark = document.createElement('mark');
                    mark.style.backgroundColor = h.color;
                    const textColor = getContrastingTextColor(h.color);
                    mark.style.setProperty('color', textColor, 'important');
                    mark.style.cursor = 'pointer';
                    mark.style.borderRadius = '2px';
                    mark.style.padding = '0 2px';
                    mark.dataset.highlightId = h.id;

                    // CRITICAL FIX: Strip inline color styles from ALL elements
                    const stripColorStyles = (element) => {
                        // Process the element itself
                        if (element && element.style) {
                            element.style.removeProperty('color');
                            element.style.removeProperty('text-shadow');
                            element.style.removeProperty('-webkit-text-fill-color');
                            element.style.setProperty('color', textColor, 'important');
                        }
                        // Process all child elements recursively (including text nodes' parent elements)
                        if (element && element.children) {
                            Array.from(element.children).forEach(child => stripColorStyles(child));
                        }
                    };

                    // Strip styles immediately (catches any pre-existing children)
                    stripColorStyles(mark);

                    // Watch for content being appended (applyRobustWrap adds content AFTER returning)
                    const observer = new MutationObserver(() => {
                        stripColorStyles(mark);
                    });

                    observer.observe(mark, {
                        childList: true,
                        subtree: true,
                        characterData: false
                    });

                    // Also strip after a delay to catch anything the observer missed
                    setTimeout(() => {
                        stripColorStyles(mark);
                        observer.disconnect();
                    }, 50);

                    return mark;
                });
            }
        });

        // CRITICAL FIX: Global sweep to fix ALL mark elements after all highlights are rendered
        // applyRobustWrap creates MULTIPLE mark elements (one per text node), 
        // so we need to catch them all after rendering is complete
        setTimeout(() => {
            const allMarks = containerRef.current?.querySelectorAll('mark[data-highlight-id]');
            if (allMarks) {
                allMarks.forEach(mark => {
                    // Get the highlight color from the mark's background
                    const bgColor = mark.style.backgroundColor;
                    const textColor = getContrastingTextColor(bgColor);

                    // Strip and fix the mark itself
                    mark.style.removeProperty('color');
                    mark.style.removeProperty('text-shadow');
                    mark.style.removeProperty('-webkit-text-fill-color');
                    mark.style.setProperty('color', textColor, 'important');

                    // Fix all descendants
                    const fixDescendants = (element) => {
                        if (element && element.style) {
                            element.style.removeProperty('color');
                            element.style.removeProperty('text-shadow');
                            element.style.removeProperty('-webkit-text-fill-color');
                            element.style.setProperty('color', textColor, 'important');
                        }
                        if (element && element.children) {
                            Array.from(element.children).forEach(child => fixDescendants(child));
                        }
                    };
                    fixDescendants(mark);
                });
            }
        }, 100);
    }, [searchQuery, originalContent, index, highlightsLoaded]);

    // Handle text selection - store Range immediately
    const handleMouseUp = useCallback((e) => {
        if (e.target.closest('.selection-menu')) {
            return;
        }

        // Check if clicking an existing highlight
        const clickedMark = e.target.closest('mark[data-highlight-id]');
        if (clickedMark) {
            const rect = clickedMark.getBoundingClientRect();
            currentRangeRef.current = null;
            selectionDataRef.current = {
                text: clickedMark.textContent,
                highlightId: clickedMark.dataset.highlightId
            };
            setMenuState({
                visible: true,
                x: rect.left + rect.width / 2,
                y: rect.top - 10,
                isEdit: true
            });
            return;
        }

        const selection = window.getSelection();
        const selectedText = selection ? selection.toString() : '';

        if (selectedText.length > 0 && selectedText.length < 10000) {
            try {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // Store the Range - since we won't re-render, it stays valid!
                currentRangeRef.current = range;
                selectionDataRef.current = {
                    text: selectedText,
                    highlightId: null
                };

                setMenuState({
                    visible: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 50,
                    isEdit: false
                });
            } catch (err) {
                console.error("Selection error:", err);
            }
        } else {
            if (menuState.visible) {
                setMenuState(prev => ({ ...prev, visible: false }));
            }
        }
    }, [menuState.visible]);

    useEffect(() => {
        setMenuState(prev => ({ ...prev, visible: false }));
        currentRangeRef.current = null;
    }, [index]);

    const addHighlight = async (color) => {
        const { text, highlightId } = selectionDataRef.current;
        const range = currentRangeRef.current;

        if (!bookId) {
            console.error("No bookId");
            return;
        }

        // Handle editing existing highlight
        if (highlightId) {
            const marks = containerRef.current?.querySelectorAll(`mark[data-highlight-id="${highlightId}"]`);
            if (marks && marks.length > 0) {
                marks.forEach(m => {
                    const textNode = document.createTextNode(m.textContent);
                    m.parentNode.replaceChild(textNode, m);
                });

                // Find in ref
                const hIdx = highlightsRef.current.findIndex(h => h.id === highlightId);
                if (hIdx >= 0) {
                    const h = highlightsRef.current[hIdx];
                    // Update ref with new color
                    h.color = color;

                    // Re-render to show updated color (since we just stripped the old marks)
                    // The useEffect [searchQuery, originalContent, index, highlightsLoaded] will trigger 
                    // if highlightsLoaded changes, or we can just call it manually or wait for next state update.
                    // Actually, it's safer to just re-apply the robust wrap here for the current segments.
                    // But easier to just trigger a re-render by updating state.

                    try {
                        await invoke('delete_highlight', { id: highlightId });
                        // Create a NEW ID for the updated highlight to ensure fresh state/DB 
                        const newHighlight = { ...h, id: crypto.randomUUID(), color };
                        highlightsRef.current[hIdx] = newHighlight;
                        await invoke('add_highlight', { highlight: newHighlight });

                        // Force a re-render of highlights
                        setHighlightsLoaded(prev => !prev);
                    } catch (e) { console.error("Update failed:", e); }
                }
            }

            setMenuState({ visible: false, x: 0, y: 0, isEdit: false });
            return;
        }

        if (!text || !range) {
            console.error("No text or range");
            return;
        }

        const newId = crypto.randomUUID();

        // Calculate precise offsets in the combined text
        const { nodes, combined } = getDocLayout();
        let startOffset = -1;
        let endOffset = -1;

        nodes.forEach(({ node, start }) => {
            if (node === range.startContainer) {
                startOffset = start + range.startOffset;
            }
            if (node === range.endContainer) {
                endOffset = start + range.endOffset;
            }
        });

        // If spanning multiple nodes, range.endContainer might be a different node
        // but our forEach covers all nodes, so this is robust.

        if (startOffset === -1 || endOffset === -1) {
            console.error("Could not find selection boundaries");
            return;
        }

        const exactContent = combined.substring(startOffset, endOffset);

        // Calculate occurrence for backward compatibility fallback
        const beforeText = combined.substring(0, startOffset);
        let matchCount = 0;
        let pos = -1;
        while ((pos = beforeText.indexOf(exactContent, pos + 1)) !== -1) {
            matchCount++;
        }
        let occurrence = matchCount + 1;

        const newHighlight = {
            id: newId,
            book_id: bookId,
            content: exactContent,
            annotation: null,
            location: JSON.stringify({
                chapter: index,
                offset: startOffset,
                occurrence: occurrence
            }),
            color: color
        };

        try {
            await invoke('add_highlight', { highlight: newHighlight });
            highlightsRef.current.push(newHighlight);
            setMenuState({ ...menuState, visible: false });
            window.getSelection()?.removeAllRanges();

            // Trigger the unified render effect
            setHighlightsLoaded(prev => !prev);
        } catch (e) {
            console.error("Save highlight failed:", e);
        }
    };

    const deleteHighlight = async () => {
        const { highlightId } = selectionDataRef.current;
        if (!highlightId) return;

        // Multi-segment removal
        const marks = containerRef.current?.querySelectorAll(`mark[data-highlight-id="${highlightId}"]`);
        if (marks && marks.length > 0) {
            marks.forEach(m => {
                const textNode = document.createTextNode(m.textContent);
                m.parentNode.replaceChild(textNode, m);
            });

            // Update ref
            highlightsRef.current = highlightsRef.current.filter(h => h.id !== highlightId);

            // Update backend
            try {
                await invoke('delete_highlight', { id: highlightId });
            } catch (e) { }
        }

        setMenuState({ visible: false, x: 0, y: 0, isEdit: false });
    };

    const copyText = async () => {
        const { text } = selectionDataRef.current;
        if (text) {
            await navigator.clipboard.writeText(text);
            setMenuState({ visible: false, x: 0, y: 0, isEdit: false });
            window.getSelection()?.removeAllRanges();
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey) {
                if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    setFontSize(prev => Math.min(prev + 2, 60));
                } else if (e.key === '-') {
                    e.preventDefault();
                    setFontSize(prev => Math.max(prev - 2, 10));
                } else if (e.key === '0') {
                    e.preventDefault();
                    setFontSize(18);
                } else if (e.key === 'f') {
                    e.preventDefault();
                    setShowSearchBar(prev => !prev);
                }
            }
            if (e.key === 'Escape') {
                setShowSearchBar(false);
                setMenuState({ visible: false, x: 0, y: 0, isEdit: false });
            }
        };

        const handleWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                setFontSize(prev => Math.min(Math.max(prev + (e.deltaY > 0 ? -2 : 2), 10), 60));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const changeChapter = (offset) => {
        const newIndex = index + offset;
        if (newIndex >= 0 && newIndex < total) {
            setIndex(newIndex);
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


            {/* Search Bar */}
            {showSearchBar && (
                <div style={{
                    position: 'absolute', top: '80px', left: '50%',
                    transform: 'translateX(-50%)', width: '400px', maxWidth: '90%',
                    zIndex: 90, background: 'rgba(30, 30, 40, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)', padding: '10px',
                    borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    display: 'flex', gap: '10px'
                }}>
                    <input
                        type="text"
                        placeholder="Find in page..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        style={{
                            flex: 1, padding: '8px 12px', borderRadius: '6px',
                            border: '1px solid #444', background: '#1e1e24',
                            color: 'white', outline: 'none'
                        }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#aaa' }}>
                        {searchQuery && <span>{searchMatchCount} found</span>}
                    </div>
                </div>
            )}

            {/* Content - No dangerouslySetInnerHTML, use ref directly */}
            <div
                ref={containerRef}
                className="epub-content hidden-scrollbar"
                onMouseUp={handleMouseUp}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '60px max(15%, 40px) 100px',
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.7',
                    width: '100%',
                    cursor: 'text'
                }}
            />

            <style>{`
                .epub-content img, .epub-content image {
                    max-width: 100% !important;
                    height: auto !important;
                    display: block;
                    margin: 20px auto;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                .epub-content svg {
                    max-width: 100% !important;
                    height: auto !important;
                }
                /* CRITICAL: Force all elements inside highlights to use readable text color */
                /* Direct color override - all current highlight colors are light, so use black */
                mark[data-highlight-id],
                mark[data-highlight-id] *,
                mark[data-highlight-id] span,
                mark[data-highlight-id] p,
                mark[data-highlight-id] div {
                    color: #000000 !important;
                }
            `}</style>

            {/* Selection Menu */}
            {menuState.visible && (
                <div
                    className="selection-menu"
                    style={{
                        position: 'fixed',
                        top: menuState.y,
                        left: menuState.x,
                        background: 'rgba(30, 30, 40, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '6px',
                        zIndex: 2000,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(12px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        minWidth: '160px',
                        transform: 'translate(-50%, -100%)',
                        marginTop: '-10px'
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {!menuState.isEdit && (
                        <>
                            <div
                                onClick={copyText}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '8px 12px', cursor: 'pointer', color: '#e0e0e0',
                                    borderRadius: '6px', fontSize: '14px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <Copy size={16} /> Copy
                            </div>
                            <div
                                onClick={() => {
                                    if (onAskAi) onAskAi(selectionDataRef.current.text);
                                    setMenuState({ visible: false, x: 0, y: 0, isEdit: false });
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '8px 12px', cursor: 'pointer', color: '#a18cd1',
                                    borderRadius: '6px', fontSize: '14px', fontWeight: '600'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(161, 140, 209, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <Bot size={16} /> Ask AI
                            </div>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                        </>
                    )}

                    {menuState.isEdit && (
                        <>
                            <div
                                onClick={() => {
                                    if (onAskAi) onAskAi(selectionDataRef.current.text);
                                    setMenuState({ visible: false, x: 0, y: 0, isEdit: false });
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '8px 12px', cursor: 'pointer', color: '#a18cd1',
                                    borderRadius: '6px', fontSize: '14px', fontWeight: '600'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(161, 140, 209, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <Bot size={16} /> Ask AI
                            </div>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                        </>
                    )}

                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', padding: '4px 12px' }}>
                        {menuState.isEdit ? 'Edit Highlight' : 'Highlight'}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', padding: '4px 12px 8px' }}>
                        {['#ffeb3b', '#a2fca2', '#90caf9', '#f48fb1'].map(color => (
                            <div
                                key={color}
                                onClick={() => addHighlight(color)}
                                style={{
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    background: color, cursor: 'pointer',
                                    border: '2px solid rgba(255,255,255,0.2)',
                                    transition: 'transform 0.1s'
                                }}
                                onMouseEnter={(e) => e.target.style.transform = 'scale(1.15)'}
                                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                            />
                        ))}
                        {menuState.isEdit && (
                            <div
                                onClick={deleteHighlight}
                                style={{
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.1)', cursor: 'pointer',
                                    border: '1px solid #ff6b6b', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    color: '#ff6b6b', marginLeft: 'auto'
                                }}
                            >
                                <Trash2 size={14} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EpubReader;
