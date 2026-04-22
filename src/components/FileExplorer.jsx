import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
    File, Folder, FolderPlus, FilePlus, ChevronRight, ChevronDown,
    Trash2, Search, Terminal, Code, RefreshCw, Edit2,
    FileCode, FileJson, FileText, FileImage, Film, Settings, Package,
    FileType2, Hash, Database, Braces, FolderOpen
} from 'lucide-react';

const FileExplorer = ({ rootPath, onFileSelect, activeFilePath = null }) => {
    const normalizePath = (path) => path?.replace(/\\/g, '/');

    const [files, setFiles] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState(new Set([normalizePath(rootPath)]));
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null });

    const loadFiles = async (path) => {
        try {
            const normalizedPath = normalizePath(path);
            const entries = await invoke('list_workspace_files', { path: path });
            const normalizedEntries = entries.map(e => ({ ...e, path: normalizePath(e.path) }));

            setFiles(prev => {
                const filtered = prev.filter(f => {
                    const fPath = normalizePath(f.path);
                    const lastSlash = fPath.lastIndexOf('/');
                    const parent = lastSlash === -1 ? '' : fPath.substring(0, lastSlash);
                    return parent !== normalizedPath;
                });
                return [...filtered, ...normalizedEntries];
            });
        } catch (e) { console.error(e); }
    };

    const expandedFoldersRef = useRef(expandedFolders);
    useEffect(() => { expandedFoldersRef.current = expandedFolders; }, [expandedFolders]);

    useEffect(() => {
        if (!rootPath) return;
        setIsLoading(true);
        loadFiles(rootPath).finally(() => setIsLoading(false));
        const setupListener = async () => {
            return await listen('workspace-changed', () => {
                loadFiles(rootPath);
                expandedFoldersRef.current.forEach(path => { if (path !== rootPath) loadFiles(path); });
            });
        };
        const unlistenRef = setupListener();

        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, item: null });
        window.addEventListener('click', handleClick);

        return () => {
            unlistenRef.then(f => f());
            window.removeEventListener('click', handleClick);
        };
    }, [rootPath]);

    const handleContextMenu = (e, file) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            item: file
        });
    };

    const handleDelete = async () => {
        if (!contextMenu.item) return;
        const confirmDelete = window.confirm(`Are you sure you want to delete ${contextMenu.item.name}?`);
        if (confirmDelete) {
            try {
                await invoke('delete_workspace_item', { path: contextMenu.item.path });
            } catch (e) { alert(`Failed to delete: ${e}`); }
        }
        setContextMenu({ visible: false, x: 0, y: 0, item: null });
    };

    const handleRename = async () => {
        if (!contextMenu.item) return;
        const oldPath = contextMenu.item.path;
        const oldName = contextMenu.item.name;
        const newName = window.prompt(`Rename ${oldName} to:`, oldName);

        if (newName && newName !== oldName) {
            const lastSlash = oldPath.lastIndexOf('/');
            const parent = lastSlash === -1 ? '' : oldPath.substring(0, lastSlash);
            const newPath = parent ? `${parent}/${newName}` : newName;

            try {
                await invoke('rename_workspace_item', { oldPath, newPath });
            } catch (e) { alert(`Failed to rename: ${e}`); }
        }
        setContextMenu({ visible: false, x: 0, y: 0, item: null });
    };

    const toggleFolder = async (path, e) => {
        if (e) e.stopPropagation();
        const normalizedPath = normalizePath(path);
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(normalizedPath)) newExpanded.delete(normalizedPath);
        else { newExpanded.add(normalizedPath); await loadFiles(path); }
        setExpandedFolders(newExpanded);
    };

    const getFileIcon = (file) => {
        const ext = file.extension?.toLowerCase();
        const iconSize = 16;
        if (file.is_dir) {
            return expandedFolders.has(normalizePath(file.path))
                ? <FolderOpen size={iconSize} color="var(--accent-primary)" />
                : <Folder size={iconSize} color="var(--accent-primary)" />;
        }
        const name = file.name?.toLowerCase();
        if (name === 'package.json') return <Package size={iconSize} color="#cb3837" />;
        if (name?.includes('config')) return <Settings size={iconSize} color="#3178c6" />;
        switch (ext) {
            case 'js': case 'mjs': case 'jsx': return <FileCode size={iconSize} color="#f7df1e" />;
            case 'ts': case 'tsx': return <FileCode size={iconSize} color="#3178c6" />;
            case 'json': return <FileJson size={iconSize} color="#cbcb41" />;
            case 'py': return <FileCode size={iconSize} color="#3776ab" />;
            case 'rs': return <FileCode size={iconSize} color="#dea584" />;
            case 'html': return <FileCode size={iconSize} color="#e34c26" />;
            case 'css': return <FileCode size={iconSize} color="#264de4" />;
            case 'md': return <FileText size={iconSize} color="#083fa1" />;
            case 'png': case 'jpg': case 'jpeg': return <FileImage size={iconSize} color="#43e97b" />;
            default: return <File size={iconSize} color="var(--text-disabled)" />;
        }
    };

    const renderTree = (path, depth = 0) => {
        const normalizedPath = normalizePath(path);
        let folderFiles = files.filter(f => {
            const fPath = normalizePath(f.path);
            const lastSlash = fPath.lastIndexOf('/');
            const parent = lastSlash === -1 ? '' : fPath.substring(0, lastSlash);
            return parent === normalizedPath;
        }).sort((a, b) => (b.is_dir === a.is_dir ? a.name.localeCompare(b.name) : b.is_dir ? 1 : -1));

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            folderFiles = folderFiles.filter(f => f.name.toLowerCase().includes(term));
        }

        return folderFiles.map(file => {
            const isActive = activeFilePath && normalizePath(file.path) === normalizePath(activeFilePath);
            return (
                <div key={file.path}>
                    <div
                        className="file-item"
                        onClick={() => file.is_dir ? toggleFolder(file.path) : onFileSelect(file)}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '4px 12px',
                            paddingLeft: `${depth * 12 + 12}px`,
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                            background: isActive ? 'var(--accent-muted)' : 'transparent',
                            transition: 'all 0.1s',
                            position: 'relative',
                            userSelect: 'none'
                        }}
                    >
                        {file.is_dir ? (
                            <div style={{ display: 'flex', alignItems: 'center', width: '12px' }}>
                                {expandedFolders.has(normalizePath(file.path)) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            </div>
                        ) : <div style={{ width: '12px' }} />}
                        {getFileIcon(file)}
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    </div>
                    {file.is_dir && expandedFolders.has(normalizePath(file.path)) && (
                        <div>{renderTree(file.path, depth + 1)}</div>
                    )}
                </div>
            );
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 0' }}>
            <div style={{ padding: '0 12px 12px 12px' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-disabled)' }} />
                    <input
                        type="text"
                        placeholder="Filter..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            padding: '6px 10px 6px 30px',
                            color: 'var(--text-main)',
                            fontSize: '12px',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {renderTree(rootPath)}
            </div>

            {contextMenu.visible && (
                <div style={{
                    position: 'fixed',
                    top: contextMenu.y,
                    left: contextMenu.x,
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-premium)',
                    padding: '4px',
                    zIndex: 1000,
                    minWidth: '150px'
                }}>
                    <div
                        className="menu-item"
                        onClick={handleRename}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            color: 'var(--text-main)'
                        }}
                    >
                        <Edit2 size={14} /> Rename
                    </div>
                    <div
                        className="menu-item delete"
                        onClick={handleDelete}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            color: '#ff4d4d'
                        }}
                    >
                        <Trash2 size={14} /> Delete
                    </div>
                </div>
            )}

            <style>
                {`
                    .file-item:hover { background: rgba(255, 255, 255, 0.03); color: var(--text-main); }
                    .menu-item:hover { background: var(--accent-muted); }
                    .menu-item.delete:hover { background: rgba(255, 77, 77, 0.1); }
                `}
            </style>
        </div>
    );
};

export default FileExplorer;
