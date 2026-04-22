import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Send, Bot, User, Trash2, Cpu, FileDown } from 'lucide-react';

const MarkdownLite = ({ content }) => {
    if (!content) return null;

    // Split by code blocks first
    const sections = content.split(/(```[\s\S]*?```)/g);

    return (
        <div style={{ lineHeight: '1.6', fontSize: '14px' }}>
            {sections.map((section, si) => {
                if (section.startsWith('```') && section.endsWith('```')) {
                    const code = section.slice(3, -3).trim();
                    const lines = code.split('\n');
                    const hasLang = lines[0].length < 20 && lines[0].length > 0 && !lines[0].includes(' ');
                    const displayCode = hasLang ? lines.slice(1).join('\n') : code;

                    return (
                        <div key={si} style={{
                            background: '#1a1a1f',
                            padding: '12px',
                            borderRadius: '8px',
                            margin: '12px 0',
                            border: '1px solid rgba(255,255,255,0.05)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {hasLang && <div style={{ fontSize: '10px', color: '#666', position: 'absolute', top: '4px', right: '8px', textTransform: 'uppercase', pointerEvents: 'none' }}>{lines[0]}</div>}
                            <code style={{
                                fontFamily: '"Fira Code", "Source Code Pro", monospace',
                                fontSize: '12px',
                                whiteSpace: 'pre',
                                display: 'block',
                                overflowX: 'auto',
                                color: '#dcdcaa',
                                padding: '4px 0'
                            }}>
                                {displayCode}
                            </code>
                        </div>
                    );
                }

                const lines = section.split('\n');
                return lines.map((line, li) => {
                    const key = `${si}-${li}`;
                    if (line.trim() === '---') return <hr key={key} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '15px 0' }} />;

                    if (line.startsWith('### ')) return <h3 key={key} style={{ margin: '15px 0 8px', color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>{line.replace('### ', '')}</h3>;
                    if (line.startsWith('## ')) return <h2 key={key} style={{ margin: '20px 0 10px', color: '#fff', fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>{line.replace('## ', '')}</h2>;

                    if (line.startsWith('- ') || line.startsWith('* ')) {
                        return <li key={key} style={{ marginLeft: '12px', marginBottom: '4px' }}>{renderInline(line.substring(2))}</li>;
                    }
                    if (line.match(/^\d+\. /)) {
                        return <li key={key} style={{ marginLeft: '12px', marginBottom: '4px', listStyleType: 'decimal' }}>{renderInline(line.replace(/^\d+\. /, ''))}</li>;
                    }

                    if (!line.trim()) return <div key={key} style={{ height: '8px' }} />;
                    return <div key={key} style={{ marginBottom: '4px' }}>{renderInline(line)}</div>;
                });
            })}
        </div>
    );
};

const renderInline = (text) => {
    let parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, pi) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pi} style={{ color: '#fff', fontWeight: 'bold' }}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={pi} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', color: '#ce9178' }}>{part.slice(1, -1)}</code>;
        }
        return part;
    });
};

const AiAssistant = ({ bookId, selectedText, onClearSelection }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const [config, setConfig] = useState({ model: '', apiKey: '' });

    useEffect(() => {
        // Load initial configuration
        const loadConfig = async () => {
            const key = await invoke('get_preference', { key: 'ai_api_key' });
            const model = await invoke('get_preference', { key: 'ai_model' });
            setConfig({
                apiKey: key || '',
                model: model || 'google/gemini-2.5-flash'
            });
        };
        loadConfig();

        // Load history
        const loadHistory = async () => {
            if (!bookId) return;
            try {
                const history = await invoke('get_ai_history', { bookId });
                setMessages(history);
            } catch (e) {
                console.error("Failed to load history:", e);
            }
        };
        loadHistory();
    }, [bookId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if ((!input.trim() && !selectedText) || loading) return;

        const userMsg = input.trim();
        const currentSelectedText = selectedText;

        // Optimistic update
        const newMsg = {
            id: Date.now(),
            role: 'user',
            content: userMsg,
            selected_text: currentSelectedText,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMsg]);
        setInput('');
        setLoading(true);
        if (onClearSelection) onClearSelection();

        try {
            // Fetch latest config right before sending to ensure universal propagation
            const currentKey = await invoke('get_preference', { key: 'ai_api_key' }) || '';
            const currentModel = await invoke('get_preference', { key: 'ai_model' }) || 'google/gemini-2.5-flash';
            
            // Check config
            if (!currentKey && !currentModel.includes('free') && !currentModel.includes('google')) { 
                if (!currentKey) throw new Error("Please set your API Key in Settings.");
            }

            // Ensure our UI knows the new config
            setConfig({ apiKey: currentKey, model: currentModel });

            const response = await invoke('ask_ai', {
                bookId,
                model: currentModel,
                apiKey: currentKey || 'sk-or-dummy', // Fallback for free models if handled
                messages: messages.concat(newMsg).map(m => [m.role, m.content]), // Naive history passing
                selectedText: currentSelectedText
            });

            const botMsg = {
                id: Date.now() + 1,
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (e) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: `Error: ${e}`,
                isError: true
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleClearHistory = async () => {
        if (!bookId) return;
        if (!window.confirm("Are you sure you want to clear the AI chat history for this book?")) return;

        // Optimistic clear
        setMessages([]);

        try {
            // Using both naming conventions to be extra sure (some Tauri versions/configs differ)
            await invoke('clear_ai_history', { book_id: bookId, bookId });
        } catch (e) {
            console.error("Failed to clear history:", e);
            // Optionally reload history if it failed? 
            // Better to just show error.
            alert("Failed to clear history on server. Please try again.");
        }
    };

    const handleSaveChat = async () => {
        if (messages.length === 0) return;
        try {
            const fileName = `chat_export_${bookId}_${new Date().getTime()}.md`;
            const workspacePath = await invoke('get_preference', { key: 'workspace_path' }) || 'C:/Users/siman/Documents/Vinyl/Content';
            const fullPath = `${workspacePath}/${fileName}`;

            let content = `# AI Chat Export: ${bookId}\n\n`;
            messages.forEach(msg => {
                content += `### ${msg.role.toUpperCase()} (${new Date(msg.timestamp).toLocaleString()})\n\n`;
                if (msg.selected_text) {
                    content += `> **Context:** ${msg.selected_text}\n\n`;
                }
                content += `${msg.content}\n\n---\n\n`;
            });

            await invoke('create_workspace_item', { path: fullPath, isDir: false, content });
            alert(`Chat saved to workspace: ${fileName}`);
        } catch (e) {
            alert(`Failed to save chat: ${e}`);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e24' }}>
            {/* Header */}
            <div style={{ padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                    <Bot size={18} color="#a18cd1" /> AI Assistant
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Cpu size={12} /> {config.model.split('/').pop()}
                    </div>
                    <button
                        onClick={handleSaveChat}
                        title="Save Chat to Workspace"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255,255,255,0.3)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                    >
                        <FileDown size={16} />
                    </button>
                    <button
                        onClick={handleClearHistory}
                        title="Clear History"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255,255,255,0.3)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ff4d4d'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#888', marginTop: '40px', padding: '20px' }}>
                        <Bot size={48} style={{ opacity: 0.2, marginBottom: '15px' }} />
                        <p>Ask anything about this book.</p>
                        <small>Select text and click "Ask AI" for context.</small>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                        {msg.selected_text && (
                            <div style={{
                                fontSize: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                padding: '8px',
                                borderRadius: '8px 8px 0 0',
                                borderLeft: '3px solid #a18cd1',
                                marginBottom: '2px',
                                color: '#aaa',
                                fontStyle: 'italic'
                            }}>
                                "{msg.selected_text.substring(0, 100)}{msg.selected_text.length > 100 ? '...' : ''}"
                            </div>
                        )}
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: msg.selected_text ? '0 0 12px 12px' : '12px',
                            background: msg.role === 'user' ? '#a18cd1' : '#2a2a35',
                            color: msg.role === 'user' ? '#fff' : '#e0e0e0',
                            border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                        }}>
                            <MarkdownLite content={msg.content} />
                        </div>
                    </div>
                ))}
                {loading && (
                    <div style={{ alignSelf: 'flex-start', background: '#2a2a35', padding: '10px 14px', borderRadius: '12px', display: 'flex', gap: '4px' }}>
                        <span className="dot-animate" style={{ animationDelay: '0s' }}>.</span>
                        <span className="dot-animate" style={{ animationDelay: '0.2s' }}>.</span>
                        <span className="dot-animate" style={{ animationDelay: '0.4s' }}>.</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', background: '#1a1a1a' }}>
                {selectedText && (
                    <div style={{
                        marginBottom: '10px',
                        padding: '8px',
                        background: 'rgba(161, 140, 209, 0.1)',
                        border: '1px solid rgba(161, 140, 209, 0.3)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ color: '#a18cd1' }}>Context: Selection ({selectedText.length} chars)</span>
                        <button onClick={onClearSelection} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><Trash2 size={12} /></button>
                    </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={selectedText ? "Ask about this selection..." : "Type a message..."}
                        style={{
                            flex: 1,
                            background: '#2a2a35',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '10px',
                            color: 'white',
                            outline: 'none',
                            resize: 'none',
                            height: '44px',
                            minHeight: '44px',
                            maxHeight: '120px',
                            fontFamily: 'inherit'
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || (!input.trim() && !selectedText)}
                        className="btn-primary"
                        style={{
                            borderRadius: '50%',
                            width: '44px',
                            height: '44px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: (loading || (!input.trim() && !selectedText)) ? 0.5 : 1
                        }}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
            <style>{`
                .dot-animate { animation: blink 1.4s infinite both; }
                @keyframes blink { 0% { opacity: .2; } 20% { opacity: 1; } 100% { opacity: .2; } }
            `}</style>
        </div>
    );
};

export default AiAssistant;
