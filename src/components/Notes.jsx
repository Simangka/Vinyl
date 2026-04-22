import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Trash2, StickyNote, Calendar, MapPin } from 'lucide-react';

const Notes = ({ bookId, currentLocation, onNavigate }) => {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadNotes();
    }, [bookId]);

    const loadNotes = async () => {
        if (!bookId) return;
        try {
            const data = await invoke('get_notes', { bookId });
            // Sort by date newest first
            setNotes(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        } catch (e) {
            console.error("Failed to load notes:", e);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || loading) return;
        setLoading(true);
        try {
            await invoke('save_note', { bookId, content: newNote.trim(), location: JSON.stringify(currentLocation) });
            setNewNote('');
            await loadNotes();
        } catch (e) {
            console.error("Failed to save note:", e);
        } finally {
            setLoading(false);
        }
    };

    // Note: delete_note command might not exist yet, but we'll add it if needed
    // For now we'll just implement the UI and use save_note/get_notes

    const handleDeleteNote = async (id) => {
        if (loading) return;
        setLoading(true);
        try {
            await invoke('delete_note', { id });
            await loadNotes();
        } catch (e) {
            console.error("Failed to delete note:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e24' }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '5px' }}>
                    <StickyNote size={18} color="#64b5f6" /> Notes
                </div>

                {/* Input Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a new note..."
                        style={{
                            width: '100%',
                            background: '#2a2a35',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '12px',
                            color: 'white',
                            outline: 'none',
                            resize: 'none',
                            height: '100px',
                            fontSize: '14px',
                            fontFamily: 'inherit'
                        }}
                    />
                    <button
                        onClick={handleAddNote}
                        disabled={loading || !newNote.trim()}
                        className="btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px',
                            opacity: (loading || !newNote.trim()) ? 0.6 : 1
                        }}
                    >
                        <Plus size={18} /> Add Note
                    </button>
                </div>

                {/* Notes List */}
                <div style={{ flex: 1, overflowY: 'auto', marginTop: '10px', paddingRight: '5px' }}>
                    {notes.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>
                            <StickyNote size={40} style={{ opacity: 0.1, marginBottom: '10px' }} />
                            <p>No notes for this book yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {notes.map((note) => (
                                <div key={note.id}
                                    onClick={() => note.location && onNavigate && onNavigate(note.location)}
                                    className="glass-panel"
                                    style={{
                                        padding: '15px',
                                        background: 'rgba(255,255,255,0.03)',
                                        cursor: note.location ? 'pointer' : 'default',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                >
                                    <div style={{ fontSize: '14px', color: '#e0e0e0', whiteSpace: 'pre-wrap', marginBottom: '10px', lineHeight: '1.5' }}>
                                        {note.content}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#888' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={12} />
                                                {new Date(note.created_at).toLocaleDateString()}
                                            </div>
                                            {note.location && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64b5f6' }}>
                                                    <MapPin size={12} />
                                                    {(() => {
                                                        try {
                                                            const loc = JSON.parse(note.location);
                                                            return loc.page ? `Pg ${loc.page}` : `Ch ${loc.chapter + 1}`;
                                                        } catch (e) { return ""; }
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteNote(note.id)}
                                            className="btn-icon"
                                            style={{ padding: '4px', color: '#ff6b6b' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notes;
