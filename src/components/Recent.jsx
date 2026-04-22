import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Clock, BookOpen, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BookCard from './BookCard';

const Recent = () => {
    const [recentBooks, setRecentBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const containerRef = useRef(null);

    const loadRecentBooks = async () => {
        setLoading(true);
        try {
            // First get the library so we have the full details of all books
            const library = await invoke('get_library');
            
            // Then get the ordered list of recent IDs and timestamps
            const recentsStr = localStorage.getItem('recent_books');
            const recentHistory = recentsStr ? JSON.parse(recentsStr) : [];
            
            // Map the history back to full book objects and sort by recent
            const populated = recentHistory.map(historyItem => {
                const book = library.find(b => b.id === historyItem.id);
                if (book) {
                    return {
                        ...book,
                        lastOpened: historyItem.timestamp
                    };
                }
                return null;
            }).filter(Boolean); // Remove nulls (e.g. if a book was deleted from library but is still in history)
            
            setRecentBooks(populated);
        } catch (error) {
            console.error('Failed to load recent books:', error);
            setRecentBooks([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecentBooks();
    }, []);

    const handleClearHistory = () => {
        if (confirm("Are you sure you want to clear your reading history? This will not delete any books.")) {
            localStorage.removeItem('recent_books');
            setRecentBooks([]);
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
            className="library-bg"
        >
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '40px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Clock size={22} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>Recent</h1>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>Jump back into your recent reads</p>
                    </div>
                </div>
                {recentBooks.length > 0 && (
                    <button
                        className="btn-ghost"
                        onClick={handleClearHistory}
                        style={{ color: '#ff6b6b' }}
                        title="Clear History"
                    >
                        <Trash2 size={18} />
                    </button>
                )}
            </header>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                    Loading history...
                </div>
            ) : recentBooks.length === 0 ? (
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
                    <p style={{ fontSize: '16px', fontWeight: '500' }}>No recent books</p>
                    <small style={{ opacity: 0.6 }}>Books you open will appear here</small>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '24px'
                }}>
                    {recentBooks.map((book) => (
                        <BookCard
                            key={book.id}
                            book={book}
                            navigate={navigate}
                            handleContextMenu={null} // Disable context menu in recent view, or implement a "Remove from History" one
                            getRandomColor={getRandomColor}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Recent;
