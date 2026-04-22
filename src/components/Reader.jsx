import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Book, Highlighter, FileText, Bot, ChevronRight, ChevronLeft, Search, FilePlus } from 'lucide-react';
import PdfReader from './Reader/PdfReader';
import EpubReader from './Reader/EpubReader';
import AiAssistant from './AiAssistant';
import Notes from './Notes';
import Highlights from './Highlights';

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rightSidebar, setRightSidebar] = useState({ visible: true, activeTab: 'ai' }); // Default to AI for now
    const [sidebarWidth, setSidebarWidth] = useState(350);
    const [isResizing, setIsResizing] = useState(false);
    const [aiContext, setAiContext] = useState('');

    // Lifted Reader States
    const [navIndex, setNavIndex] = useState(0);
    const [totalUnits, setTotalUnits] = useState(0);
    const [zoom, setZoom] = useState(1); // 1.0 for PDF, 18 for EPUB (handled dynamic)

    // Feature States
    const [showSearch, setShowSearch] = useState(false);
    const [darkMode, setDarkMode] = useState(true);

    useEffect(() => {
        async function loadBook() {
            try {
                const library = await invoke('get_library');
                const found = library.find(b => b.id === id);
                if (found) {
                    setBook(found);
                    // Add to recent books
                    try {
                        const recentsStr = localStorage.getItem('recent_books');
                        let recents = recentsStr ? JSON.parse(recentsStr) : [];
                        
                        // Remove if already exists so we can move it to front
                        recents = recents.filter(item => item.id !== found.id);
                        
                        // Add to front with timestamp
                        recents.unshift({
                            id: found.id,
                            timestamp: Date.now()
                        });
                        
                        // Keep only last 20 recent books
                        if (recents.length > 20) {
                            recents = recents.slice(0, 20);
                        }
                        
                        localStorage.setItem('recent_books', JSON.stringify(recents));
                    } catch (err) {
                        console.error("Failed to save recent book:", err);
                    }
                } else {
                    console.error("Book not found");
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        loadBook();
    }, [id]);

    const handleAskAi = (text) => {
        setAiContext(text);
        setRightSidebar({ visible: true, activeTab: 'ai' });
    };

    const handleNavigate = (location) => {
        if (!location) return;
        try {
            const loc = typeof location === 'string' ? JSON.parse(location) : location;
            if (book.format === 'pdf' && loc.page) {
                setNavIndex(loc.page - 1);
            } else if (book.format === 'epub' && loc.chapter !== undefined) {
                setNavIndex(loc.chapter);
            }
        } catch (e) {
            console.error("Navigation failed:", e);
        }
    };

    const startResizing = (e) => {
        setIsResizing(true);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 250 && newWidth < 800) {
                setSidebarWidth(newWidth);
            }
        };

        const stopResizing = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', stopResizing);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing]);

    const handleCreateWorkspaceNote = async () => {
        try {
            const fileName = `${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.md`;
            const workspacePath = await invoke('get_preference', { key: 'workspace_path' }) || 'C:/Users/siman/Documents/Vinyl/Content';
            const fullPath = `${workspacePath}/${fileName}`;

            const content = `# Notes on ${book.title}\n\n**Source:** ${book.title}\n**Location:** ${book.format === 'pdf' ? `Page ${navIndex + 1}` : `Chapter ${navIndex + 1}`}\n\n## Summary\n\n\n## Key Takeaways\n\n- \n\n## AI Discussion\n\n`;

            await invoke('create_workspace_item', { path: fullPath, isDir: false, content });
            alert(`Note created: ${fileName}\nYou can find it in the Workspace tab.`);
        } catch (e) {
            alert(`Failed to create note: ${e}`);
        }
    };

    if (loading) return <div className="glass-panel" style={{ margin: '20px', padding: '20px' }}>Loading...</div>;
    if (!book) return <div className="glass-panel" style={{ margin: '20px', padding: '20px' }}>Book not found</div>;

    const tabs = [
        { id: 'toc', icon: <Book size={18} />, label: 'TOC' },
        { id: 'highlights', icon: <Highlighter size={18} />, label: 'Highlights' },
        { id: 'notes', icon: <FileText size={18} />, label: 'Notes' },
        { id: 'ai', icon: <Bot size={18} />, label: 'AI Assistant' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)', overflow: 'hidden' }}>
            {/* Top Bar */}
            <div className="glass-panel" style={{
                height: '50px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                gap: '20px',
                borderBottom: 'var(--glass-border)',
                zIndex: 10
            }}>
                <button className="btn-ghost" onClick={() => navigate('/')}>
                    <ArrowLeft size={20} />
                </button>
                <span style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                    {(book.title && book.title !== 'Loading...') ? book.title : (book.file_path.split(/[\\/]/).pop())}
                </span>

                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                    {/* Navigation Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '12px' }}>
                        <button className="btn-icon" onClick={() => setNavIndex(prev => Math.max(0, prev - 1))} disabled={navIndex <= 0}>
                            <ChevronLeft size={18} />
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                            <span style={{ opacity: 0.6 }}>{book.format === 'pdf' ? 'Pg' : 'Ch'}</span>
                            <input
                                type="number"
                                value={navIndex + 1}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) - 1;
                                    if (!isNaN(val) && val >= 0 && val < totalUnits) setNavIndex(val);
                                }}
                                style={{ width: '35px', textAlign: 'center', background: 'transparent', border: 'none', color: 'white', fontWeight: 'bold' }}
                            />
                            <span style={{ opacity: 0.4 }}>/ {totalUnits}</span>
                        </div>
                        <button className="btn-icon" onClick={() => setNavIndex(prev => Math.min(totalUnits - 1, prev + 1))} disabled={navIndex >= totalUnits - 1}>
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

                    {/* Zoom Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button className="btn-icon" onClick={() => setZoom(z => book.format === 'pdf' ? Math.max(0.5, z - 0.1) : Math.max(10, z - 2))}>
                            <ChevronLeft size={16} /> {/* Using icons since minus/plus might be missing from this scope or look different */}
                        </button>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', width: '40px', textAlign: 'center' }}>
                            {book.format === 'pdf' ? `${Math.round(zoom * 100)}%` : `${Math.round(zoom / 18 * 100)}%`}
                        </span>
                        <button className="btn-icon" onClick={() => setZoom(z => book.format === 'pdf' ? Math.min(3, z + 0.1) : Math.min(60, z + 2))}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {book.format === 'epub' && (
                        <button
                            className="btn-icon"
                            onClick={() => setShowSearch(!showSearch)}
                            style={{ color: showSearch ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                            title="Find in page"
                        >
                            <Search size={18} />
                        </button>
                    )}
                    {book.format === 'pdf' && (
                        <button
                            className="btn-icon"
                            onClick={() => setDarkMode(!darkMode)}
                            style={{ color: darkMode ? '#a2fca2' : 'var(--text-muted)' }}
                            title="Toggle Dark Mode"
                        >
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid currentColor', background: darkMode ? 'currentColor' : 'transparent' }} />
                        </button>
                    )}

                    <button
                        className="btn-icon"
                        onClick={handleCreateWorkspaceNote}
                        title="Create Quick Note in Workspace"
                        style={{ color: 'var(--accent-secondary)' }}
                    >
                        <FilePlus size={18} />
                    </button>

                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 5px' }} />

                    <button
                        className="btn-icon"
                        onClick={() => setRightSidebar(prev => ({ ...prev, visible: !prev.visible }))}
                        style={{
                            color: rightSidebar.visible ? 'var(--accent-primary)' : 'var(--text-muted)',
                            background: rightSidebar.visible ? 'rgba(161, 140, 209, 0.1)' : 'transparent'
                        }}
                        title={rightSidebar.visible ? "Close Sidebar" : "Open Sidebar"}
                    >
                        <Book size={20} />
                    </button>
                </div>
            </div>

            {/* Main Layout */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Reader Content */}
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    {book.format === 'pdf' ? (
                        <PdfReader
                            filePath={book.file_path}
                            bookId={book.id}
                            onAskAi={handleAskAi}
                            currentPage={navIndex + 1}
                            onPageChange={(p) => setNavIndex(p - 1)}
                            onTotalPages={(t) => setTotalUnits(t)}
                            scale={zoom}
                            onScaleChange={setZoom}
                            darkMode={darkMode}
                            onDarkModeChange={setDarkMode}
                        />
                    ) : (
                        <EpubReader
                            filePath={book.file_path}
                            bookId={book.id}
                            onAskAi={handleAskAi}
                            index={navIndex}
                            onIndexChange={setNavIndex}
                            onTotalChapters={setTotalUnits}
                            fontSize={zoom}
                            onFontSizeChange={setZoom}
                            showSearchBar={showSearch}
                            onShowSearchBarChange={setShowSearch}
                        />
                    )}
                </div>

                {/* Right Sidebar */}
                {rightSidebar.visible && (
                    <>
                        <div
                            className={`resize-handle ${isResizing ? 'active' : ''}`}
                            onMouseDown={startResizing}
                        />
                        <div style={{
                            width: `${sidebarWidth}px`,
                            background: 'var(--bg-sidebar)',
                            borderLeft: 'var(--glass-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            zIndex: 5
                        }}>
                            {/* Tab Headers */}
                            <div style={{
                                display: 'flex',
                                background: 'rgba(0,0,0,0.2)',
                                borderBottom: 'var(--glass-border)',
                                padding: '4px'
                            }}>
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setRightSidebar({ ...rightSidebar, activeTab: tab.id })}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '8px 0',
                                            background: rightSidebar.activeTab === tab.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            border: 'none',
                                            borderRadius: '6px',
                                            color: rightSidebar.activeTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        title={tab.label}
                                    >
                                        {tab.icon}
                                        <span style={{ fontSize: '10px', marginTop: '4px', fontWeight: '600' }}>{tab.label.split(' ')[0]}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                {rightSidebar.activeTab === 'ai' && (
                                    <AiAssistant
                                        bookId={book.id}
                                        selectedText={aiContext}
                                        onClearSelection={() => setAiContext('')}
                                    />
                                )}
                                {rightSidebar.activeTab === 'highlights' && (
                                    <Highlights bookId={book.id} onNavigate={handleNavigate} />
                                )}
                                {rightSidebar.activeTab === 'notes' && (
                                    <Notes
                                        bookId={book.id}
                                        currentLocation={book.format === 'pdf' ? { page: navIndex + 1 } : { chapter: navIndex }}
                                        onNavigate={handleNavigate}
                                    />
                                )}
                                {rightSidebar.activeTab === 'toc' && <div style={{ padding: '20px', color: 'var(--text-muted)' }}>TOC (Coming Soon)</div>}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Reader;
