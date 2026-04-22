import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Trash2, BookOpen, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';

import BookCard from './BookCard';

const Library = () => {
    const [books, setBooks] = useState([]);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, bookId: null });
    const navigate = useNavigate();
    const containerRef = useRef(null);

    const refreshLibrary = async () => {
        try {
            const library = await invoke('get_library');
            setBooks(library || []);
        } catch (error) {
            console.error('Failed to load library:', error);
            setBooks([]);
        }
    };

    useEffect(() => {
        refreshLibrary();

        const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const handleImport = async () => {
        try {
            const selected = await open({
                multiple: true,
                filters: [{
                    name: 'Books',
                    extensions: ['pdf', 'epub']
                }]
            });

            if (selected) {
                const paths = Array.isArray(selected) ? selected : [selected];
                for (const path of paths) {
                    if (path) {
                        try {
                            await invoke('add_book', { filePath: path });
                        } catch (e) {
                            console.error(`Failed to add ${path}:`, e);
                        }
                    }
                }
                refreshLibrary();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleContextMenu = (e, bookId = null) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            bookId
        });
    };

    const handleExportHighlights = async (id) => {
        if (!id) return;
        try {
            const book = books.find(b => b.id === id);
            if (!book) return;

            const highlights = await invoke('get_highlights', { bookId: id });
            if (!highlights || highlights.length === 0) {
                alert("No highlights found for this book.");
                return;
            }

            const fileName = `${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_highlights.md`;
            const workspacePath = await invoke('get_preference', { key: 'workspace_path' }) || 'C:/Users/siman/Documents/Vinyl/Content';
            const fullPath = `${workspacePath}/${fileName}`;

            let content = `# Highlights: ${book.title}\n\n`;
            highlights.forEach(h => {
                content += `> ${h.content}\n\n*Location: ${h.location}*\n\n---\n\n`;
            });

            await invoke('create_workspace_item', { path: fullPath, isDir: false, content });
            alert(`Highlights exported: ${fileName}\nYou can find it in the Workspace tab.`);
        } catch (error) {
            console.error('Failed to export highlights:', error);
            alert(`Export failed: ${error}`);
        }
    };

    const handleDelete = async (id) => {
        if (!id) return;
        try {
            await invoke('delete_book', { id });
            refreshLibrary();
        } catch (error) {
            console.error('Failed to delete book:', error);
        }
    };

    const getRandomColor = (id) => {
        const colors = [
            'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)',
            'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
            'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
            'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
            'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        ];
        // Simple hash to select consistent color
        let hash = 0;
        if (id) {
            for (let i = 0; i < id.length; i++) {
                hash = id.charCodeAt(i) + ((hash << 5) - hash);
            }
        }
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div
            ref={containerRef}
            style={{ padding: '30px', flex: 1, overflowY: 'auto', position: 'relative' }}
            onContextMenu={(e) => {
                if (e.target === containerRef.current || e.target.classList.contains('library-bg')) {
                    handleContextMenu(e, null);
                }
            }}
            className="library-bg"
        >
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '40px'
            }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>Library</h1>
                <button
                    className="btn-premium"
                    onClick={handleImport}
                >
                    <Plus size={18} />
                    Add Book
                </button>
            </header>

            {books.length === 0 ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '50vh',
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.01)'
                }}>
                    <BookOpen size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
                    <p style={{ fontSize: '16px', fontWeight: '500' }}>Your library is empty</p>
                    <small style={{ opacity: 0.6 }}>Import books to get started</small>
                </div>
            ) : (
                <>
                    {/* PDF Section */}
                    {books.filter(b => b.format === 'pdf').length > 0 && (
                        <div className="library-section">
                            <h2 className="library-section-title">PDF Documents</h2>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: '24px'
                            }}>
                                {books.filter(b => b.format === 'pdf').map((book) => (
                                    <BookCard
                                        key={book.id}
                                        book={book}
                                        navigate={navigate}
                                        handleContextMenu={handleContextMenu}
                                        getRandomColor={getRandomColor}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* EPUB Section */}
                    {books.filter(b => b.format === 'epub').length > 0 && (
                        <div className="library-section">
                            <h2 className="library-section-title">EPUB Books</h2>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: '24px'
                            }}>
                                {books.filter(b => b.format === 'epub').map((book) => (
                                    <BookCard
                                        key={book.id}
                                        book={book}
                                        navigate={navigate}
                                        handleContextMenu={handleContextMenu}
                                        getRandomColor={getRandomColor}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other formats if any */}
                    {books.filter(b => b.format !== 'pdf' && b.format !== 'epub').length > 0 && (
                        <div className="library-section">
                            <h2 className="library-section-title">Other Files</h2>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: '24px'
                            }}>
                                {books.filter(b => b.format !== 'pdf' && b.format !== 'epub').map((book) => (
                                    <BookCard
                                        key={book.id}
                                        book={book}
                                        navigate={navigate}
                                        handleContextMenu={handleContextMenu}
                                        getRandomColor={getRandomColor}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {contextMenu.visible && (
                <div style={{
                    position: 'fixed',
                    top: contextMenu.y,
                    left: contextMenu.x,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px',
                    zIndex: 1000,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                    minWidth: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    {contextMenu.bookId ? (
                        <>
                            <div
                                className="menu-item"
                                onClick={() => handleExportHighlights(contextMenu.bookId)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    color: 'var(--text-main)',
                                    fontSize: '14px',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                                <FileText size={16} /> Export Highlights
                            </div>
                            <div
                                className="menu-item"
                                onClick={() => handleDelete(contextMenu.bookId)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    color: '#ff6b6b', // Softer red
                                    fontSize: '14px',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255, 107, 107, 0.1)'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                                <Trash2 size={16} /> Delete Book
                            </div>
                        </>
                    ) : (
                        <div
                            className="menu-item"
                            onClick={handleImport}
                            style={{
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                color: 'var(--text-main)',
                                fontSize: '14px'
                            }}
                        >
                            <Plus size={16} />
                            Add Book
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Library;
