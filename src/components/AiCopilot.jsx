import { useState, useEffect, useRef } from 'react';
import { Cpu, Send, Sparkles, MessageSquare, History, Trash2, Zap, Brain } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const AiCopilot = ({ activeFile }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Get model and key from settings
            const model = await invoke('get_preference', { key: 'ai_model' }) || 'gpt-3.5-turbo';
            const apiKey = await invoke('get_preference', { key: 'ai_api_key' }) || '';

            if (!apiKey) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Please set your AI API Key in Settings to use Ziege's Mind."
                }]);
                return;
            }

            const response = await invoke('ask_ai', {
                bookId: 'workspace_ide', // Special ID for IDE chat
                model,
                apiKey,
                messages: [...messages, userMsg].map(m => [m.role, m.content]),
                selectedText: null // Future: get selected text from editor
            });

            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(10, 10, 15, 0.2)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Brain size={16} color="var(--accent-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Ziege's Mind</span>
                </div>
                <button className="btn-icon" onClick={() => setMessages([])} title="Clear Chat"><Trash2 size={14} /></button>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', opacity: 0.5, textAlign: 'center' }}>
                        <Sparkles size={32} color="var(--accent-primary)" />
                        <p style={{ fontSize: '13px' }}>Ask Ziege's Mind to explain code, refactor, or help with your workspace.</p>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '90%',
                        background: m.role === 'user' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        borderBottomRightRadius: m.role === 'user' ? '2px' : '12px',
                        borderBottomLeftRadius: m.role === 'assistant' ? '2px' : '12px',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                        {m.content}
                    </div>
                ))}
            </div>

            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    padding: '8px',
                    border: '1px solid var(--border-subtle)'
                }}>
                    <textarea
                        placeholder="Ask anything..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            resize: 'none',
                            outline: 'none',
                            minHeight: '24px',
                            maxHeight: '150px'
                        }}
                    />
                    <button
                        onClick={handleSend}
                        className="btn-icon"
                        disabled={!input.trim() || isLoading}
                        style={{ alignSelf: 'flex-end', background: 'var(--accent-primary)', color: 'white' }}
                    >
                        {isLoading ? <Zap size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AiCopilot;
