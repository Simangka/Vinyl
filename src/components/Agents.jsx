import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Send, Bot, User, Cpu, Terminal, Search, Folder, Calculator, Loader2, Sparkles, Code2, Globe, Image as ImageIcon, X, Check, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';

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
                            background: '#0d0d12',
                            padding: '12px',
                            borderRadius: '8px',
                            margin: '12px 0',
                            border: '1px solid rgba(255,255,255,0.1)',
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
                                color: '#a6accd',
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
            return <code key={pi} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', color: '#82aaff' }}>{part.slice(1, -1)}</code>;
        }
        return part;
    });
};

// Component to visualize tool execution
const ToolExecutionMUI = ({ tool }) => {
    const [expanded, setExpanded] = useState(false);
    
    // Pick an icon based on tool name
    let Icon = Terminal;
    if (tool.name === 'create_file' || tool.name === 'save_workspace_file') Icon = Code2;
    if (tool.name === 'grep' || tool.name === 'list_files') Icon = Folder;
    if (tool.name === 'calculator') Icon = Calculator;

    return (
        <div style={{
            marginTop: '12px',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            overflow: 'hidden'
        }}>
            <div 
                onClick={() => setExpanded(!expanded)}
                style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                        width: '24px', height: '24px', borderRadius: '6px', 
                        background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Icon size={14} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#e0e0e0', fontFamily: 'monospace' }}>
                        {tool.name}
                    </span>
                    <CheckCircle2 size={14} color="#10b981" style={{ marginLeft: '4px' }} />
                </div>
                {expanded ? <ChevronDown size={16} color="#888" /> : <ChevronRight size={16} color="#888" />}
            </div>
            
            {expanded && (
                <div style={{
                    padding: '12px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    background: '#0a0a0f',
                    fontSize: '12px',
                    fontFamily: '"Fira Code", monospace',
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    <div style={{ color: '#888', marginBottom: '8px' }}>// Output:</div>
                    <div style={{ color: '#a6accd', whiteSpace: 'pre-wrap' }}>
                        {Array.isArray(tool.result) ? tool.result.join('\n') : tool.result}
                    </div>
                </div>
            )}
        </div>
    );
};

const Agents = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const messagesEndRef = useRef(null);
    const [config, setConfig] = useState({ model: '', apiKey: '' });
    const [editingModel, setEditingModel] = useState(false);
    const [tempModel, setTempModel] = useState('');
    const [attachedImage, setAttachedImage] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const loadConfig = async () => {
            const key = await invoke('get_preference', { key: 'ai_api_key' });
            const model = await invoke('get_preference', { key: 'ai_model' });
            setConfig({
                apiKey: key || '',
                model: model || 'google/gemini-2.5-flash'
            });
        };
        loadConfig();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachedImage({
                url: reader.result,
                name: file.name
            });
        };
        reader.readAsDataURL(file);
    };

    const handleSaveModel = async () => {
        if (!tempModel.trim()) return;
        await invoke('save_preference', { key: 'ai_model', value: tempModel.trim() });
        setConfig(prev => ({ ...prev, model: tempModel.trim() }));
        setEditingModel(false);
    };

    const executeTool = async (toolName, args) => {
        setStatus(`Executing ${toolName}...`);
        try {
            switch (toolName) {
                case 'grep':
                    const workspaceGrep = await invoke('get_preference', { key: 'workspace_path' });
                    return await invoke('agent_grep', { pattern: args.pattern, path: args.path || workspaceGrep });
                case 'list_files':
                    const workspaceList = await invoke('get_preference', { key: 'workspace_path' });
                    return await invoke('agent_list_files', { path: args.path || workspaceList });
                case 'cli':
                    return await invoke('execute_agent_command', { command: args.command, args: args.args || [] });
                case 'create_file':
                case 'save_workspace_file':
                     let content = args.content || "";
                     let filePath = args.path;
                     if(!filePath.includes('/')) {
                        const ws = await invoke('get_preference', { key: 'workspace_path' }) || 'C:/Users/siman/Documents/Vinyl/Content';
                        filePath = `${ws}/${filePath}`;
                     }
                     await invoke('create_workspace_item', { path: filePath, isDir: false, content });
                     return `File successfully created at ${filePath}`;
                case 'calculator':
                    return eval(args.expression).toString();
                default:
                    return `Unknown tool: ${toolName}`;
            }
        } catch (e) {
            return `Error: ${e}`;
        } finally {
            setStatus('');
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsgContent = attachedImage 
            ? [
                { type: "text", text: input.trim() || "What is in this image?" },
                { type: "image_url", image_url: { url: attachedImage.url } }
              ]
            : input.trim();

        const userMsg = {
            id: Date.now(),
            role: 'user',
            content: userMsgContent,
            displayImage: attachedImage?.url,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setAttachedImage(null);
        setLoading(true);

        try {
            // Fetch latest config from db to ensure it syncs with settings tab without reload
            const currentKey = await invoke('get_preference', { key: 'ai_api_key' }) || '';
            const currentModel = await invoke('get_preference', { key: 'ai_model' }) || 'google/gemini-2.5-flash';
            setConfig(prev => ({ ...prev, apiKey: currentKey, model: currentModel }));
        
            let currentMessages = [...messages, userMsg].map(m => {
                // Ensure content is passed correctly as JSON or string
                return {
                    role: m.role,
                    content: m.content
                };
            });

            // Initial call
            let response = await invoke('ask_ai', {
                bookId: 'system', // Special ID for general agent chat
                model: currentModel,
                apiKey: currentKey || 'sk-or-dummy',
                messages: currentMessages,
                selectedText: `
You are VinylAgent, a powerful coding assistant on steroids.
You have access to the following tools:
1. grep(pattern, path?): Search for pattern in files.
2. list_files(path?): List files in a directory.
3. cli(command, args[]): Execute a terminal command.
4. create_file(path, content): Create a new file with the specified content. Use absolute paths or filenames for the workspace root.
5. calculator(expression): Evaluate a math expression.

To use a tool, respond with: [TOOL: toolName({"arg1": "value"})]
Always explain what you are doing. If you get a tool result, use it to refine your answer.
`
            });

            // Tool calling loop (Simplified for now: max 3 rounds)
            let rounds = 0;
            while (response.includes('[TOOL:') && rounds < 3) {
                const toolMatch = response.match(/\[TOOL:\s*(\w+)\((.*?)\)\]/);
                if (toolMatch) {
                    const toolName = toolMatch[1];
                    const toolArgsStr = toolMatch[2];
                    let toolArgs = {};
                    try { toolArgs = JSON.parse(toolArgsStr); } catch (e) { }

                    const toolResult = await executeTool(toolName, toolArgs);

                    // Call LLM again with tool result
                    let currentContent = response;
                    // Clean the response so parsing markup implies tool is used.
                    if (currentContent.endsWith(`[TOOL: ${toolName}(${toolArgsStr})]`)) {
                        currentContent = currentContent.replace(`[TOOL: ${toolName}(${toolArgsStr})]`, '').trim();
                    }
                    
                    if (currentContent) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: currentContent,
                            timestamp: new Date().toISOString(),
                            tool: { name: toolName, result: toolResult }
                        }]);
                    } else {
                        // If it only output the tool, disguise the tool as a message
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `*Used tool: ${toolName}*`,
                            timestamp: new Date().toISOString(),
                            tool: { name: toolName, result: toolResult }
                        }]);
                    }

                    // Call LLM again with tool result
                    currentMessages.push({ role: 'assistant', content: response });
                    currentMessages.push({ role: 'user', content: `Tool Result (${toolName}): ${JSON.stringify(toolResult)}` });

                    const lateKey = await invoke('get_preference', { key: 'ai_api_key' }) || '';
                    const lateModel = await invoke('get_preference', { key: 'ai_model' }) || 'google/gemini-2.5-flash';

                    response = await invoke('ask_ai', {
                        bookId: 'system',
                        model: lateModel,
                        apiKey: lateKey || 'sk-or-dummy',
                        messages: currentMessages
                    });
                }
                rounds++;
            }

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString()
            }]);

        } catch (e) {
            setMessages(prev => [...prev, {
                id: Date.now() + 2,
                role: 'assistant',
                content: `Something went wrong: ${e}`,
                isError: true
            }]);
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'linear-gradient(135deg, #0f0f12 0%, #1a1a1f 100%)',
            color: '#e0e0e0',
            fontFamily: '"Inter", sans-serif'
        }}>
            {/* Header */}
            <div style={{
                padding: '20px 30px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.2)',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'linear-gradient(45deg, #6366f1, #a855f7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                    }}>
                        <Sparkles size={20} color="white" />
                    </div>
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '18px', letterSpacing: '-0.5px' }}>VinylAgent</div>
                        <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                            System Online • 
                            {editingModel ? (
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '2px 6px' }}>
                                    <input 
                                        autoFocus
                                        value={tempModel} 
                                        onChange={e => setTempModel(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveModel()}
                                        style={{ background: 'transparent', border: 'none', color: '#e0e0e0', fontSize: '12px', width: '150px', outline: 'none' }}
                                    />
                                    <button onClick={handleSaveModel} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '0 4px' }}><Check size={12} /></button>
                                    <button onClick={() => setEditingModel(false)} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: '0 4px' }}><X size={12} /></button>
                                </div>
                            ) : (
                                <span 
                                    onClick={() => { setTempModel(config.model); setEditingModel(true); }}
                                    style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                    title="Click to change model"
                                >
                                    {config.model.split('/').pop()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <div title="CLI Access" style={{ color: '#888' }}><Terminal size={18} /></div>
                    <div title="Grep Tool" style={{ color: '#888' }}><Search size={18} /></div>
                    <div title="File System" style={{ color: '#888' }}><Folder size={18} /></div>
                </div>
            </div>

            {/* Messages Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                scrollBehavior: 'smooth'
            }}>
                {messages.length === 0 && (
                    <div style={{
                        margin: 'auto',
                        textAlign: 'center',
                        maxWidth: '400px',
                        animation: 'fadeIn 0.5s ease-out'
                    }}>
                        <div style={{
                            fontSize: '48px',
                            marginBottom: '20px',
                            background: 'linear-gradient(45deg, #6366f1, #a855f7)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontWeight: '800'
                        }}>
                            AI on Steroids.
                        </div>
                        <p style={{ color: '#888', lineHeight: '1.6' }}>
                            I can browse your workspace, execute CLI commands, search through code, and even build entire UIs for you.
                        </p>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            marginTop: '30px'
                        }}>
                            {['List my books', 'Search for "TODO"', 'Execute dir', 'New React UI'].map(t => (
                                <div key={t} onClick={() => setInput(t)} style={{
                                    padding: '12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                                    {t}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        gap: '8px',
                        animation: 'slideIn 0.3s ease-out'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11px',
                            color: '#666',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {msg.role === 'user' ? (
                                <><User size={12} /> You</>
                            ) : (
                                <><Bot size={12} /> Agent</>
                            )}
                        </div>
                        <div style={{
                            padding: '16px 20px',
                            borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                            background: msg.role === 'user' ? '#6366f1' : 'rgba(255,255,255,0.04)',
                            color: msg.role === 'user' ? '#fff' : '#e0e0e0',
                            maxWidth: '85%',
                            lineHeight: '1.6',
                            fontSize: '15px',
                            boxShadow: msg.role === 'user' ? '0 10px 25px rgba(99, 102, 241, 0.2)' : 'none',
                            border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.05)' : 'none',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {msg.displayImage && (
                                <img src={msg.displayImage} alt="User upload" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '10px', display: 'block' }} />
                            )}
                            {msg.role === 'assistant' ? (
                                <MarkdownLite content={typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.find(c => c.type === 'text')?.text : JSON.stringify(msg.content))} />
                            ) : (
                                typeof msg.content === 'string' 
                                    ? msg.content 
                                    : (Array.isArray(msg.content) ? msg.content.find(c => c.type === 'text')?.text : JSON.stringify(msg.content))
                            )}

                            {msg.tool && <ToolExecutionMUI tool={msg.tool} />}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', color: '#888', fontSize: '13px' }}>
                        <Loader2 className="animate-spin" size={18} />
                        {status || "Agent is thinking..."}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{
                padding: '30px',
                background: 'rgba(0,0,0,0.3)',
                borderTop: '1px solid rgba(255,255,255,0.03)'
            }}>
                <div style={{
                    position: 'relative',
                    maxWidth: '900px',
                    margin: '0 auto'
                }}>
                    {attachedImage && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', width: 'fit-content' }}>
                            <img src={attachedImage.url} alt="Attached preview" style={{ height: '30px', width: '30px', objectFit: 'cover', borderRadius: '4px' }} />
                            <span style={{ fontSize: '12px', color: '#ccc' }}>{attachedImage.name}</span>
                            <button onClick={() => setAttachedImage(null)} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: '0 4px' }}><X size={14} /></button>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleImageUpload} 
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '16px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.6)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'white'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                            title="Attach Image"
                        >
                            <ImageIcon size={20} />
                        </button>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Tell the agent what to do... (e.g. Please analyze this image or Create a React component)"
                            style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '16px',
                                padding: '18px 60px 18px 20px',
                                color: 'white',
                                outline: 'none',
                                resize: 'none',
                                height: '60px',
                                fontSize: '15px',
                                transition: 'all 0.3s ease',
                                boxSizing: 'border-box'
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || (!input.trim() && !attachedImage)}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: attachedImage ? 'calc(50% + 23px)' : '50%', // Re-center if image preview exists
                                transform: 'translateY(-50%)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: loading || (!input.trim() && !attachedImage) ? 'transparent' : '#6366f1',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
                <div style={{
                    textAlign: 'center',
                    fontSize: '11px',
                    color: '#555',
                    marginTop: '12px'
                }}>
                    Steroid Mode Active • Press Shift+Enter for new line
                </div>
            </div>

            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Agents;
