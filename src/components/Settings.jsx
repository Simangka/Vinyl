import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Save, Key, Cpu, RotateCcw, Folder } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

const Settings = ({ theme, setTheme }) => {
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('xiaomi/mimo-v2-flash:free');
    const [defaultZoom, setDefaultZoom] = useState(100);
    const [workspacePath, setWorkspacePath] = useState('C:/Users/siman/Documents/Vinyl/Content');
    const [status, setStatus] = useState('');

    useEffect(() => {
        // Load settings
        const loadSettings = async () => {
            try {
                const storedKey = await invoke('get_preference', { key: 'ai_api_key' });
                if (storedKey) setApiKey(storedKey);

                const storedModel = await invoke('get_preference', { key: 'ai_model' });
                if (storedModel) setModel(storedModel);

                const storedZoom = await invoke('get_preference', { key: 'default_zoom' });
                if (storedZoom) setDefaultZoom(parseInt(storedZoom));

                const storedPath = await invoke('get_preference', { key: 'workspace_path' });
                if (storedPath) setWorkspacePath(storedPath);
            } catch (err) {
                console.error('Failed to load settings:', err);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        try {
            setStatus('Saving...');
            await invoke('save_preference', { key: 'ai_api_key', value: apiKey });
            await invoke('save_preference', { key: 'ai_model', value: model });
            await invoke('save_preference', { key: 'default_zoom', value: defaultZoom.toString() });
            await invoke('save_preference', { key: 'workspace_path', value: workspacePath });

            setStatus('Settings saved successfully!');
            setTimeout(() => setStatus(''), 2000);
        } catch (err) {
            console.error('Failed to save settings:', err);
            setStatus('Error saving settings');
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', flex: 1, overflowY: 'auto' }}>
            <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '40px', background: 'linear-gradient(to right, #fff, #aaa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Settings</h1>

            <section className="glass-panel" style={{ padding: '30px', marginBottom: '30px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Cpu size={20} color="#a18cd1" /> AI Assistant
                </h2>

                <div style={{ display: 'grid', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>AI Provider</label>
                        <select
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                color: 'var(--text-main)',
                                outline: 'none'
                            }}
                            disabled
                        >
                            <option>OpenRouter (Any Provider)</option>
                        </select>
                        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>
                            We route through OpenRouter so you can use models from Google, Anthropic, OpenAI, etc.
                        </small>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Model</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="google/gemini-pro, anthropic/claude-3-opus, etc."
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px',
                                    color: 'var(--text-main)'
                                }}
                            />
                            <button
                                className="btn-secondary"
                                onClick={() => setModel('xiaomi/mimo-v2-flash:free')}
                                title="Reset to Default"
                                style={{ padding: '12px', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                <RotateCcw size={18} />
                            </button>
                        </div>
                        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>
                            Paste any model ID from OpenRouter. Recommended free: xiaomi/mimo-v2-flash:free or google/gemini-2.5-flash
                        </small>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>API Key</label>
                        <div style={{ position: 'relative' }}>
                            <Key size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-or-..."
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 40px',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px',
                                    color: 'var(--text-main)',
                                    fontFamily: 'monospace'
                                }}
                            />
                        </div>
                        <small style={{ marginTop: '5px', display: 'block' }}>
                            <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: '#a18cd1' }}>Get an OpenRouter Key →</a>
                        </small>
                    </div>
                </div>
            </section>

            <section className="glass-panel" style={{ padding: '30px', marginBottom: '30px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Folder size={20} color="#646cff" /> Workspace
                </h2>

                <div style={{ display: 'grid', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Workspace Root Path</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                value={workspacePath}
                                onChange={(e) => setWorkspacePath(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px',
                                    color: 'var(--text-main)'
                                }}
                            />
                            <button
                                className="btn-secondary"
                                onClick={async () => {
                                    const selected = await open({ directory: true });
                                    if (selected) setWorkspacePath(selected);
                                }}
                                style={{ padding: '12px' }}
                            >
                                Browse
                            </button>
                        </div>
                        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>
                            All your notes and workspace files will be stored here.
                        </small>
                    </div>
                </div>
            </section>

            <section className="glass-panel" style={{ padding: '30px', marginBottom: '30px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Appearance & Reading</h2>

                <div style={{ display: 'grid', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Theme</span>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-main)',
                                padding: '8px 15px',
                                borderRadius: '8px',
                                outline: 'none'
                            }}
                        >
                            <option value="dark">Dark Mode</option>
                            <option value="light">Light Mode</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Default Zoom Level</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <input
                                type="range"
                                min="50"
                                max="200"
                                value={defaultZoom}
                                onChange={(e) => setDefaultZoom(e.target.value)}
                                style={{ width: '150px' }}
                            />
                            <span style={{ width: '40px', textAlign: 'right', fontFamily: 'monospace' }}>{defaultZoom}%</span>
                        </div>
                    </div>
                </div>
            </section>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px' }}>
                {status && <span style={{ color: status.includes('Error') ? '#ff6b6b' : '#43e97b', fontSize: '14px' }}>{status}</span>}
                <button
                    className="btn-primary"
                    onClick={handleSave}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        fontSize: '16px',
                        borderRadius: '10px'
                    }}
                >
                    <Save size={18} /> Save Settings
                </button>
            </div>
        </div>
    );
};

export default Settings;
