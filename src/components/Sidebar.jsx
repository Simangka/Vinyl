import { useState, useEffect, useCallback, useRef } from 'react';
import { Library, Clock, Settings, BookOpen, Folder, Code, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
    const [width, setWidth] = useState(240);
    const [isResizing, setIsResizing] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const sidebarRef = useRef(null);

    const startResizing = useCallback(() => setIsResizing(true), []);
    const stopResizing = useCallback(() => setIsResizing(false), []);

    const resize = useCallback((e) => {
        if (isResizing) {
            const newWidth = e.clientX;
            if (newWidth < 80) {
                setIsCollapsed(true);
            } else {
                setIsCollapsed(false);
                setWidth(Math.min(Math.max(newWidth, 160), 600));
            }
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    const navItems = [
        { icon: Library, label: 'Library', path: '/' },
        { icon: Clock, label: 'Recent', path: '/recent' },
        { icon: Code, label: 'Code', path: '/workspace' },
        { icon: Sparkles, label: "Ziege's Mind", path: '/agents' },
    ];

    return (
        <aside
            ref={sidebarRef}
            style={{
                width: isCollapsed ? '64px' : `${width}px`,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--border-subtle)',
                background: 'var(--bg-sidebar)',
                transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                zIndex: 200, // Higher than IDE activity bar
                userSelect: isResizing ? 'none' : 'auto'
            }}
        >
            <div style={{
                height: '60px', // Fixed height for header area
                display: 'flex',
                alignItems: 'center',
                padding: isCollapsed ? '0' : '0 20px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
            }}>
                <BookOpen size={24} color="#646cff" style={{ flexShrink: 0 }} />
                {!isCollapsed && <span style={{ fontWeight: '700', fontSize: '18px', marginLeft: '12px' }}>VinylReader</span>}
            </div>

            <nav style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                flex: 1,
                padding: '0 10px',
                alignItems: isCollapsed ? 'center' : 'stretch',
                overflowX: 'hidden',
                marginTop: '10px'
            }}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        title={isCollapsed ? item.label : ''}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            color: isActive ? 'white' : 'var(--text-muted)',
                            background: isActive ? 'var(--accent-muted)' : 'transparent',
                            transition: 'all 0.2s ease',
                            justifyContent: isCollapsed ? 'center' : 'flex-start',
                            height: '44px',
                            width: isCollapsed ? '44px' : '100%',
                            padding: isCollapsed ? '0' : '0 12px',
                        })}
                    >
                        <div style={{ width: '20px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                            <item.icon size={20} />
                        </div>
                        {!isCollapsed && <span style={{ fontSize: '13px', fontWeight: '500', marginLeft: '12px', whiteSpace: 'nowrap' }}>{item.label}</span>}
                    </NavLink>
                ))}

                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '16px 0' }} />

                <NavLink
                    to="/root-workspace"
                    title={isCollapsed ? 'Root Workspace' : ''}
                    style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: isActive ? 'white' : 'var(--text-muted)',
                        background: isActive ? 'var(--accent-muted)' : 'transparent',
                        transition: 'all 0.2s ease',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        height: '44px',
                        width: isCollapsed ? '44px' : '100%',
                        padding: isCollapsed ? '0' : '0 12px',
                    })}
                >
                    <div style={{ width: '20px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        <Folder size={20} />
                    </div>
                    {!isCollapsed && <span style={{ fontSize: '13px', fontWeight: '500', marginLeft: '12px', whiteSpace: 'nowrap' }}>Root Workspace</span>}
                </NavLink>
            </nav>

            <nav style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px',
                alignItems: isCollapsed ? 'center' : 'stretch'
            }}>
                <div
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        background: 'transparent',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        height: '44px',
                        width: isCollapsed ? '44px' : '100%',
                        padding: isCollapsed ? '0' : '0 12px',
                    }}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                    <div style={{ width: '20px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </div>
                    {!isCollapsed && <span style={{ fontSize: '13px', fontWeight: '500', marginLeft: '12px', whiteSpace: 'nowrap' }}>Collapse</span>}
                </div>
                <NavLink
                    to="/settings"
                    title={isCollapsed ? 'Settings' : ''}
                    style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: isActive ? 'white' : 'var(--text-muted)',
                        background: isActive ? 'var(--accent-muted)' : 'transparent',
                        transition: 'all 0.2s ease',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        height: '44px',
                        width: isCollapsed ? '44px' : '100%',
                        padding: isCollapsed ? '0' : '0 12px',
                    })}
                >
                    <div style={{ width: '20px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        <Settings size={20} />
                    </div>
                    {!isCollapsed && <span style={{ fontSize: '13px', fontWeight: '500', marginLeft: '12px', whiteSpace: 'nowrap' }}>Settings</span>}
                </NavLink>
            </nav>

            {/* Resize Handle - Invisible hit area extends past boundary */}
            <div
                onMouseDown={startResizing}
                style={{
                    position: 'absolute',
                    top: 0,
                    right: '-4px',
                    bottom: 0,
                    width: '8px',
                    cursor: 'ew-resize',
                    zIndex: 1000,
                    background: isResizing ? 'var(--accent-primary)' : 'transparent',
                    transition: 'background 0.2s'
                }}
            />
        </aside>
    );
};

export default Sidebar;
