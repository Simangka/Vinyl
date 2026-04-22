import { useState } from 'react';
import { Search, X, ChevronRight, FileCode } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const GlobalSearch = ({ rootPath, onFileSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsSearching(true);
        try {
            // Using agent_grep which returns "path:line: match"
            const grepResults = await invoke('agent_grep', {
                pattern: query,
                path: rootPath
            });

            // Parse results into groups by file
            const grouped = grepResults.reduce((acc, curr) => {
                const [path, line, ...contentArr] = curr.split(':');
                const content = contentArr.join(':').trim();
                const fileName = path.split(/[/\\]/).pop();

                if (!acc[path]) {
                    acc[path] = { fileName, path, matches: [] };
                }
                acc[path].matches.push({ line, content });
                return acc;
            }, {});

            setResults(Object.values(grouped));
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        placeholder="Search workspace..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        style={{
                            width: '100%',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            outline: 'none'
                        }}
                    />
                    <button
                        onClick={handleSearch}
                        className="btn-icon"
                        style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
                    >
                        <Search size={14} />
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
                {isSearching ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</div>
                ) : results.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        {query ? 'No results found' : 'Enter a search term'}
                    </div>
                ) : (
                    results.map(file => (
                        <div key={file.path} style={{ marginBottom: '4px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 16px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                fontSize: '13px',
                                fontWeight: '500'
                            }}>
                                <FileCode size={14} color="var(--accent-primary)" />
                                {file.fileName}
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '400' }}>
                                    {file.path.length > 30 ? '...' + file.path.slice(-30) : file.path}
                                </span>
                            </div>
                            {file.matches.map((match, i) => (
                                <div
                                    key={i}
                                    onClick={() => onFileSelect({ path: file.path, name: file.fileName })}
                                    style={{
                                        padding: '4px 16px 4px 40px',
                                        fontSize: '12px',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        transition: 'background 0.1s'
                                    }}
                                    className="search-match"
                                >
                                    <span style={{ color: 'var(--accent-secondary)', marginRight: '8px' }}>{match.line}:</span>
                                    {match.content}
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
            <style>
                {`
                    .search-match:hover {
                        background: rgba(255, 255, 255, 0.05);
                        color: var(--text-main);
                    }
                `}
            </style>
        </div>
    );
};

export default GlobalSearch;
