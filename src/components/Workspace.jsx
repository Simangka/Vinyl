import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FileExplorer from './FileExplorer';
import IntegratedTerminal from './IntegratedTerminal';
import GlobalSearch from './GlobalSearch';
import GitPanel from './GitPanel';
import AiCopilot from './AiCopilot';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
    X, Save, Eye, Edit2, Columns, Folder, Library, FileImage, Film,
    ChevronRight, GitBranch, Search, Command, SplitSquareHorizontal,
    FileCode, FileJson, FileText, Braces, Hash, Settings2, Terminal,
    AlertCircle, CheckCircle2, Copy, Trash2, FolderOpen, MoreHorizontal,
    Files, GitFork, Cpu, Plus, Minus, Square, Maximize2, Minimize2,
    SearchCode, Boxes, Ghost, Sparkles, Layout, Code, Activity,
    FilePlus, FolderPlus
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { rust } from '@codemirror/lang-rust';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { go } from '@codemirror/lang-go';
import { php } from '@codemirror/lang-php';
import { search, highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { EditorState } from '@codemirror/state';

const Workspace = ({ isRootLocked = false }) => {
    const navigate = useNavigate();
    const [rootPath, setRootPath] = useState('');

    const [openTabs, setOpenTabs] = useState([]);
    const [activeTabIndex, setActiveTabIndex] = useState(-1);

    const [activeSidebar, setActiveSidebar] = useState('explorer');
    const [showBottomPanel, setShowBottomPanel] = useState(false);
    const [bottomPanelTab, setBottomPanelTab] = useState('terminal');
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [showQuickOpen, setShowQuickOpen] = useState(false);
    const [commandSearch, setCommandSearch] = useState('');
    const [quickOpenSearch, setQuickOpenSearch] = useState('');
    const [allFiles, setAllFiles] = useState([]);
    const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const commandInputRef = useRef(null);
    const quickOpenInputRef = useRef(null);

    const activeTab = activeTabIndex >= 0 && activeTabIndex < openTabs.length ? openTabs[activeTabIndex] : null;

    useEffect(() => {
        async function initWorkspace() {
            try {
                const path = await invoke('get_preference', { key: isRootLocked ? 'workspace_path' : 'code_sidebar_path' })
                    || await invoke('get_preference', { key: 'workspace_path' })
                    || 'C:/Users/siman/Documents/Vinyl/Content';
                setRootPath(path);
                loadAllFiles(path);
            } catch (e) { console.error(e); }
        }
        initWorkspace();
    }, [isRootLocked]);

    const loadAllFiles = async (path) => {
        try {
            const result = await invoke('list_workspace_files', { path });
            setAllFiles(result.filter(f => !f.is_dir));
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (rootPath) {
            invoke('watch_workspace', { path: rootPath }).catch(e => console.error('Failed to start watcher:', e));
            loadAllFiles(rootPath);
        }
    }, [rootPath]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') { e.preventDefault(); handleSave(); }
                if (e.key === 'p' && !e.shiftKey) { e.preventDefault(); setShowQuickOpen(true); setQuickOpenSearch(''); }
                if (e.key === 'P' && e.shiftKey) { e.preventDefault(); setShowCommandPalette(true); setCommandSearch(''); }
                if (e.key === 'j') { e.preventDefault(); setShowBottomPanel(p => !p); }
                if (e.key === 'b') { e.preventDefault(); setSidebarCollapsed(p => !p); }
            }
            if (e.key === 'Escape') { setShowCommandPalette(false); setShowQuickOpen(false); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, activeTabIndex]);

    const handleFileSelect = async (file) => {
        const existingIndex = openTabs.findIndex(tab => tab.path === file.path);
        if (existingIndex >= 0) { setActiveTabIndex(existingIndex); return; }

        const ext = file.extension?.toLowerCase();
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
        const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(ext);
        const isMedia = isImage || isVideo;

        try {
            const [content, meta] = isMedia ? ['', null] : await invoke('read_workspace_file', { path: file.path });
            const newTab = { ...file, content, originalContent: content, metadata: meta, isDirty: false, isMedia };
            setOpenTabs(prev => [...prev, newTab]);
            setActiveTabIndex(openTabs.length);
            setShowQuickOpen(false);
        } catch (e) { console.error(e); }
    };

    const handleCloseTab = (index, e) => {
        if (e) e.stopPropagation();
        const tab = openTabs[index];
        if (tab.isDirty && !confirm(`Unsaved changes in ${tab.name}. Discard?`)) return;
        setOpenTabs(prev => prev.filter((_, i) => i !== index));
        if (index === activeTabIndex) setActiveTabIndex(Math.max(0, index - 1));
        else if (index < activeTabIndex) setActiveTabIndex(activeTabIndex - 1);
    };

    const handleContentChange = (value) => {
        if (activeTabIndex < 0) return;
        setOpenTabs(prev => prev.map((tab, i) => {
            if (i === activeTabIndex) return { ...tab, content: value, isDirty: value !== tab.originalContent };
            return tab;
        }));
    };

    const handleSave = async () => {
        if (!activeTab || activeTab.isMedia) return;
        try {
            await invoke('save_workspace_file', { path: activeTab.path, content: activeTab.content, cursorPos: null, scrollPos: null });
            setOpenTabs(prev => prev.map((t, i) => i === activeTabIndex ? { ...t, isDirty: false, originalContent: t.content } : t));
        } catch (e) { alert(e); }
    };

    const getLanguageExtension = (ext) => {
        const base = [
            lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), history(), foldGutter(),
            drawSelection(), EditorState.allowMultipleSelections.of(true), indentOnInput(), bracketMatching(),
            closeBrackets(), autocompletion(), rectangularSelection(), crosshairCursor(), highlightSelectionMatches(),
            search({ top: true }), keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap]),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }), EditorView.lineWrapping,
            EditorView.updateListener.of(u => {
                if (u.selectionSet) {
                    const pos = u.state.selection.main.head; const line = u.state.doc.lineAt(pos);
                    setCursorPosition({ line: line.number, col: pos - line.from + 1 });
                }
            })
        ];
        switch (ext?.toLowerCase()) {
            case 'md': return [...base, markdown({ base: markdownLanguage, addKeymap: true })];
            case 'js': case 'jsx': return [...base, javascript({ jsx: true })];
            case 'ts': case 'tsx': return [...base, javascript({ typescript: true, jsx: true })];
            case 'rs': return [...base, rust()];
            case 'py': return [...base, python()];
            case 'html': return [...base, html()];
            case 'css': return [...base, css()];
            case 'json': return [...base, json()];
            default: return base;
        }
    };

    const commands = [
        { id: 'save', label: 'Save', shortcut: 'Ctrl+S', action: handleSave, icon: Save },
        { id: 'terminal', label: 'Terminal', shortcut: 'Ctrl+J', action: () => setShowBottomPanel(p => !p), icon: Terminal },
        { id: 'sidebar', label: 'Sidebar', shortcut: 'Ctrl+B', action: () => setSidebarCollapsed(p => !p), icon: Columns },
    ];

    const filteredQuickOpen = allFiles.filter(f => f.name.toLowerCase().includes(quickOpenSearch.toLowerCase())).slice(0, 10);

    return (
        <div className="ide-container">
            {/* Activity Bar */}
            <div className="activity-bar">
                <div className={`activity-item ${activeSidebar === 'explorer' ? 'active' : ''}`} onClick={() => { setActiveSidebar('explorer'); setSidebarCollapsed(false); }} title="Explorer"><Files size={20} /></div>
                <div className={`activity-item ${activeSidebar === 'search' ? 'active' : ''}`} onClick={() => { setActiveSidebar('search'); setSidebarCollapsed(false); }} title="Search"><Search size={20} /></div>
                <div className={`activity-item ${activeSidebar === 'git' ? 'active' : ''}`} onClick={() => { setActiveSidebar('git'); setSidebarCollapsed(false); }} title="Source Control"><GitFork size={20} /></div>
                <div className={`activity-item ${activeSidebar === 'ai' ? 'active' : ''}`} onClick={() => { setActiveSidebar('ai'); setSidebarCollapsed(false); }} title="Ziege's Mind"><Sparkles size={20} /></div>
                <div className="activity-item" style={{ marginTop: 'auto', marginBottom: '10px' }} onClick={() => navigate('/settings')} title="Settings"><Settings2 size={20} /></div>
            </div>

            {/* Sidebar */}
            {!sidebarCollapsed && (
                <div className="sidebar-panel">
                    <div className="sidebar-header">
                        <span>{activeSidebar === 'ai' ? "Ziege's Mind" : activeSidebar}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {activeSidebar === 'explorer' && (
                                <>
                                    <button className="btn-icon" onClick={async () => {
                                        const name = prompt('Enter file name:');
                                        if (name) {
                                            try {
                                                await invoke('create_workspace_item', {
                                                    path: `${rootPath}/${name}`,
                                                    isDir: false
                                                });
                                            } catch (e) { alert(`Failed to create file: ${e}`); }
                                        }
                                    }} title="New File">
                                        <FilePlus size={14} />
                                    </button>
                                    <button className="btn-icon" onClick={async () => {
                                        const name = prompt('Enter folder name:');
                                        if (name) {
                                            try {
                                                await invoke('create_workspace_item', {
                                                    path: `${rootPath}/${name}`,
                                                    isDir: true
                                                });
                                            } catch (e) { alert(`Failed to create folder: ${e}`); }
                                        }
                                    }} title="New Folder">
                                        <FolderPlus size={14} />
                                    </button>
                                    <button className="btn-icon" onClick={async () => {
                                        const selected = await open({ directory: true, multiple: false });
                                        if (selected) {
                                            setRootPath(selected);
                                            await invoke('save_preference', { key: 'code_sidebar_path', value: selected });
                                        }
                                    }} title="Open Folder">
                                        <FolderOpen size={14} />
                                    </button>
                                </>
                            )}
                            <button className="btn-icon" onClick={() => setSidebarCollapsed(true)}><Columns size={14} /></button>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        {activeSidebar === 'explorer' && <FileExplorer rootPath={rootPath} onFileSelect={handleFileSelect} activeFilePath={activeTab?.path} isRootLocked={isRootLocked} />}
                        {activeSidebar === 'search' && <GlobalSearch rootPath={rootPath} onFileSelect={handleFileSelect} />}
                        {activeSidebar === 'git' && <GitPanel rootPath={rootPath} />}
                        {activeSidebar === 'ai' && <AiCopilot activeFile={activeTab} />}
                    </div>
                </div>
            )}

            {/* Main Editor View */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-editor)', overflow: 'hidden', minWidth: 0 }}>
                {/* Tabs Area */}
                <div className="tabs-container">
                    {openTabs.map((t, i) => (
                        <div key={t.path} className={`ide-tab ${i === activeTabIndex ? 'active' : ''}`} onClick={() => setActiveTabIndex(i)}>
                            <span style={{ fontSize: '13px' }}>{t.name}</span>
                            {t.isDirty && <div className="dirty-indicator" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffab00', margin: '0 4px' }} />}
                            <X size={14} className="close-btn" onClick={(e) => handleCloseTab(i, e)} />
                        </div>
                    ))}
                </div>

                {/* Editor Content */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {activeTab ? (
                        <>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                {activeTab.isMedia ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: 'black' }}>
                                        {activeTab.extension === 'mp4' ? <video src={convertFileSrc(activeTab.path)} controls style={{ maxHeight: '100%' }} /> : <img src={convertFileSrc(activeTab.path)} alt={activeTab.name} style={{ maxHeight: '100%', objectFit: 'contain' }} />}
                                    </div>
                                ) : (
                                    <CodeMirror
                                        value={activeTab.content}
                                        height="100%"
                                        theme="dark"
                                        extensions={getLanguageExtension(activeTab.extension)}
                                        onChange={handleContentChange}
                                        style={{ height: '100%' }}
                                    />
                                )}
                            </div>

                            {/* Bottom Panel */}
                            {showBottomPanel && (
                                <div style={{ height: '300px', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
                                    <div className="bottom-panel-header">
                                        <div className={`bottom-panel-tab ${bottomPanelTab === 'terminal' ? 'active' : ''}`} onClick={() => setBottomPanelTab('terminal')}>Terminal</div>
                                        <div className={`bottom-panel-tab ${bottomPanelTab === 'output' ? 'active' : ''}`} onClick={() => setBottomPanelTab('output')}>Output</div>
                                        <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setShowBottomPanel(false)}><Minimize2 size={14} /></button>
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        {bottomPanelTab === 'terminal' && <IntegratedTerminal rootPath={rootPath} />}
                                        {bottomPanelTab === 'output' && <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Console output...</div>}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', opacity: 0.1 }}>
                            <Code size={120} />
                            <div style={{ fontSize: '18px', fontWeight: '500' }}>VinylReader IDE</div>
                        </div>
                    )}
                </div>

                {/* Status Bar */}
                <div className="status-bar">
                    <div className="status-bar-section">
                        <div className="status-bar-item"><GitBranch size={12} /> main</div>
                        <div className="status-bar-item"><Activity size={12} /> Ready</div>
                    </div>
                    <div className="status-bar-section">
                        {activeTab && !activeTab.isMedia && (
                            <>
                                <div className="status-bar-item">Ln {cursorPosition.line}, Col {cursorPosition.col}</div>
                                <div className="status-bar-item">{activeTab.extension?.toUpperCase()}</div>
                                <div className="status-bar-item">UTF-8</div>
                            </>
                        )}
                        <div className="status-bar-item" onClick={() => setShowBottomPanel(!showBottomPanel)}><Terminal size={12} /></div>
                    </div>
                </div>
            </div>

            {/* Quick Open Overlay */}
            {showQuickOpen && (
                <div className="command-palette-overlay">
                    <div className="command-palette" style={{ height: 'fit-content' }}>
                        <input
                            ref={quickOpenInputRef}
                            type="text"
                            placeholder="Go to file..."
                            value={quickOpenSearch}
                            onChange={e => setQuickOpenSearch(e.target.value)}
                        />
                        <div style={{ overflowY: 'auto' }}>
                            {filteredQuickOpen.map(f => (
                                <div
                                    key={f.path}
                                    onClick={() => handleFileSelect(f)}
                                    style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-subtle)' }}
                                    className="quick-item"
                                >
                                    <span style={{ fontSize: '14px', color: 'var(--text-main)' }}>{f.name}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{f.path}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Command Palette Overlay */}
            {showCommandPalette && (
                <div className="command-palette-overlay">
                    <div className="command-palette">
                        <input
                            ref={commandInputRef}
                            type="text"
                            placeholder="Type a command..."
                            value={commandSearch}
                            onChange={e => setCommandSearch(e.target.value)}
                        />
                        <div style={{ overflowY: 'auto' }}>
                            {commands.filter(c => c.label.toLowerCase().includes(commandSearch.toLowerCase())).map(cmd => (
                                <div
                                    key={cmd.id}
                                    className="quick-item"
                                    onClick={() => { cmd.action(); setShowCommandPalette(false); }}
                                    style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                                >
                                    <cmd.icon size={16} color="var(--accent-primary)" />
                                    <span style={{ flex: 1, fontSize: '14px' }}>{cmd.label}</span>
                                    {cmd.shortcut && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cmd.shortcut}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <style>
                {`
                    .quick-item:hover { background: rgba(255, 255, 255, 0.05); }
                `}
            </style>
        </div>
    );
};

export default Workspace;
