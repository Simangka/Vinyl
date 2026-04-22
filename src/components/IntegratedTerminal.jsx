import { useEffect, useRef } from 'react';
import { Terminal as XtermTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

const IntegratedTerminal = ({ rootPath }) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new XtermTerminal({
            theme: {
                background: '#0c0c0f', // Match bg-editor
                foreground: '#fafafa',
                cursor: '#6366f1',
                selection: 'rgba(99, 102, 241, 0.3)',
                black: '#000000',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#f59e0b',
                blue: '#3b82f6',
                magenta: '#a855f7',
                cyan: '#06b6d4',
                white: '#ffffff',
            },
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            cursorBlink: true,
            allowProposedApi: true,
            rows: 30
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;

        term.writeln('\x1b[1;36mVinylReader Shell\x1b[0m');
        term.write(`\x1b[1;32m${rootPath}\x1b[0m > `);

        let input = '';
        term.onData(data => {
            const code = data.charCodeAt(0);
            if (code === 13) {
                term.write('\r\n');
                if (input.trim()) executeCommand(input.trim());
                else term.write(`\x1b[1;32m${rootPath}\x1b[0m > `);
                input = '';
            } else if (code === 127) {
                if (input.length > 0) {
                    input = input.slice(0, -1);
                    term.write('\b \b');
                }
            } else {
                input += data;
                term.write(data);
            }
        });

        const executeCommand = async (cmd) => {
            const trimmedCmd = cmd.trim();
            if (trimmedCmd === 'clear' || trimmedCmd === 'cls') {
                term.clear();
                term.write(`\x1b[1;32m${rootPath}\x1b[0m > `);
                return;
            }

            try {
                // Determine if it's a shell command that needs 'cmd /c' (like py)
                const command = 'cmd';
                const args = ['/c', trimmedCmd];

                const result = await window.__TAURI_INTERNALS__.invoke('execute_agent_command', {
                    command,
                    args,
                    path: rootPath
                });
                term.writeln(result);
            } catch (err) {
                term.writeln(`\x1b[31mError: ${err}\x1b[0m`);
            }
            term.write(`\x1b[1;32m${rootPath}\x1b[0m > `);
        };

        const handleResize = () => { fitAddon.fit(); };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            term.dispose();
        };
    }, [rootPath]);

    return (
        <div
            ref={terminalRef}
            style={{
                height: '100%',
                width: '100%',
                background: '#0c0c0f',
                padding: '12px'
            }}
        />
    );
};

export default IntegratedTerminal;
