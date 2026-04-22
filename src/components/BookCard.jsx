import { useState } from 'react';
import { BookOpen } from 'lucide-react';

const BookCard = ({ book, navigate, handleContextMenu, getRandomColor }) => {
    const [imgError, setImgError] = useState(false);

    // Some books might not have full metadata if loaded from simplified history,
    // so we provide fallbacks for properties that are expected
    const title = book.title || book.file_path?.split(/[\\/]/).pop() || 'Unknown Title';
    const author = book.author || 'Unknown Author';

    return (
        <div
            className="book-card"
            onClick={() => navigate(`/read/${book.id}`)}
            onContextMenu={(e) => {
                e.stopPropagation();
                if (handleContextMenu) {
                    handleContextMenu(e, book.id);
                }
            }}
            style={{
                background: 'var(--bg-card)',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                height: '100%' // Ensure consistent height if used in flex/grid
            }}
        >
            <div style={{
                height: '220px',
                background: (book.cover_image && !imgError) ? '#2a2a35' : getRandomColor(book.id),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                position: 'relative',
                flexShrink: 0
            }}>
                {(book.cover_image && !imgError) ? (
                    <img
                        src={`data:image/jpeg;base64,${book.cover_image}`}
                        onError={() => setImgError(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        alt={`Cover of ${title}`}
                    />
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '10px',
                        color: 'rgba(255,255,255,0.9)',
                        fontWeight: '600'
                    }}>
                        <BookOpen size={40} style={{ marginBottom: '10px', opacity: 0.8 }} />
                        <div style={{ fontSize: '14px', lineHeight: '1.2', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{title}</div>
                    </div>
                )}
            </div>
            <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{
                    margin: '0 0 4px',
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'var(--text-main)'
                }} title={title}>{title}</h3>
                <p style={{
                    margin: 0,
                    fontSize: '12px',
                    color: 'var(--text-muted)'
                }}>{author}</p>
                {book.lastOpened && (
                    <p style={{
                        margin: '8px 0 0 0',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        opacity: 0.8
                    }}>
                        Opened: {new Date(book.lastOpened).toLocaleDateString()}
                    </p>
                )}
            </div>
        </div>
    );
};

export default BookCard;
