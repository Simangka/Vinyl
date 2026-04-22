import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Library from './components/Library';
import Reader from './components/Reader';
import Settings from './components/Settings';
import Workspace from './components/Workspace';
import Agents from './components/Agents';
import Recent from './components/Recent';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';

function App() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    let unlisten;
    async function setupListener() {
      // Trying both common event names for robustness in v1/v2 transition
      unlisten = await listen('tauri://drag-drop', async (event) => {
        console.log("File drop event:", event);
        const paths = event.payload.paths;

        let added = false;
        for (const path of paths) {
          try {
            console.log("Adding book from drop:", path);
            await invoke('add_book', { filePath: path });
            added = true;
          } catch (e) {
            console.error("Failed to add book:", e);
          }
        }

        if (added) {
          window.location.reload();
        }
      });
    }
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)',
        minWidth: 0,
        height: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/read/:id" element={<Reader />} />
          <Route path="/recent" element={<Recent />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/root-workspace" element={<Workspace isRootLocked={true} />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/settings" element={<Settings theme={theme} setTheme={setTheme} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
