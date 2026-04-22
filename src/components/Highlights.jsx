import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Highlighter, Trash2, MapPin } from 'lucide-react';

const Highlights = ({ bookId, onNavigate }) => {
    const [highlights, setHighlights] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadHighlights();
    }, [bookId]);

    const loadHighlights = async () => {
        if (!bookId) return;
        try {
            const data = await invoke('get_highlights', { bookId });
            setHighlights(data);
        } catch (e) {
            console.error("Failed to load highlights:", e);
        }
    };

    const handleDeleteHighlight = async (id) => {
        try {
            await invoke('delete_highlight', { id });
            await loadHighlights();
            // Optional: notify parent to re-render reader overlays? 
            // Since we are just a list, parent should probably refresh or we should use shared state.
            // For now, refreshing the list is enough.
        } catch (e) {
            console.error("Failed to delete highlight:", e);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e24' }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                    <Highlighter size={18} color="#ffeb3b" /> Highlights
                </div>

                <div style={{ flex: 1, overflowY: 'auto', marginTop: '10px', paddingRight: '5px' }}>
                    {highlights.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>
                            <Highlighter size={40} style={{ opacity: 0.1, marginBottom: '10px' }} />
                            <p>No highlights yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {highlights.map((h) => {
                                let locationText = "";
                                try {
                                    const loc = JSON.parse(h.location);
                                    if (loc.page) locationText = `Pg ${loc.page}`;
                                    else if (loc.chapter !== undefined) locationText = `Ch ${loc.chapter + 1}`;
                                } catch (e) { }

                                return (
                                    <div key={h.id}
                                        onClick={() => onNavigate && onNavigate(h.location)}
                                        className="glass-panel"
                                        style={{
                                            padding: '12px',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderLeft: `4px solid ${h.color}`,
                                            cursor: onNavigate ? 'pointer' : 'default',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    >
                                        <div style={{ fontSize: '13px', color: '#e0e0e0', marginBottom: '8px', lineHeight: '1.4' }}>
                                            "{h.content}"
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#888' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MapPin size={12} />
                                                {locationText}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteHighlight(h.id)}
                                                className="btn-icon"
                                                style={{ padding: '4px', color: '#ff6b6b' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Highlights;
