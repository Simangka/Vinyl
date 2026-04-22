import { useState, useEffect } from 'react';
import { GitBranch, GitCommit, GitPullRequest, RotateCcw, Plus, Check, MapPin, History } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const GitPanel = ({ rootPath }) => {
    const [status, setStatus] = useState([]);
    const [branch, setBranch] = useState('main');
    const [commitMsg, setCommitMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const refreshStatus = async () => {
        setIsLoading(true);
        try {
            // For now, these are placeholder calls as we'd need a robust git2-rs backend
            // But we can simulate some basic git status using CLI if git is installed
            const result = await invoke('execute_agent_command', {
                command: 'git',
                args: ['status', '--porcelain']
            });

            const lines = result.split('\n').filter(l => l.trim());
            const parsed = lines.map(line => {
                const state = line.substring(0, 2);
                const path = line.substring(3);
                return { state, path, name: path.split('/').pop() };
            });
            setStatus(parsed);

            const branchRes = await invoke('execute_agent_command', {
                command: 'git',
                args: ['branch', '--show-current']
            });
            setBranch(branchRes.trim() || 'main');
        } catch (err) {
            console.error("Git status failed:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshStatus();
    }, [rootPath]);

    const handleCommit = async () => {
        if (!commitMsg.trim()) return;
        try {
            await invoke('execute_agent_command', {
                command: 'git',
                args: ['add', '.']
            });
            await invoke('execute_agent_command', {
                command: 'git',
                args: ['commit', '-m', commitMsg]
            });
            setCommitMsg('');
            refreshStatus();
        } catch (err) {
            alert(`Commit failed: ${err}`);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Source Control</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-icon" onClick={refreshStatus} title="Refresh"><RotateCcw size={14} /></button>
                    <button className="btn-icon" title="View History"><History size={14} /></button>
                </div>
            </div>

            <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-main)', fontSize: '13px' }}>
                    <GitBranch size={16} />
                    <span>{branch}</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border-subtle)' }}>
                    <textarea
                        placeholder="Commit message (Ctrl+Enter to commit)"
                        value={commitMsg}
                        onChange={e => setCommitMsg(e.target.value)}
                        onKeyDown={e => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && handleCommit()}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            resize: 'none',
                            outline: 'none',
                            minHeight: '60px'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button
                            onClick={handleCommit}
                            className="btn-primary"
                            disabled={!commitMsg.trim()}
                            style={{ padding: '4px 12px', fontSize: '12px' }}
                        >
                            Commit
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '8px 16px', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Changes ({status.length})
                </div>
                {status.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No changes detected
                    </div>
                ) : (
                    status.map(file => (
                        <div key={file.path} className="git-item" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '6px 16px',
                            cursor: 'pointer'
                        }}>
                            <span style={{
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: '700',
                                color: file.state.includes('M') ? '#f59e0b' : file.state.includes('A') ? '#22c55e' : '#ef4444'
                            }}>
                                {file.state.trim()}
                            </span>
                            <span style={{ fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{file.path.split('/').slice(0, -1).join('/')}</span>
                            <div className="git-actions" style={{ opacity: 0 }}>
                                <button className="btn-icon" style={{ padding: '2px' }}><Plus size={14} /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <style>
                {`
                    .git-item:hover { background: rgba(255, 255, 255, 0.05); }
                    .git-item:hover .git-actions { opacity: 1 !important; }
                `}
            </style>
        </div>
    );
};

export default GitPanel;
