import express from 'express';
import { createServer as createViteServer } from 'vite';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// State for active process and logs
let activeProcess: any = null;
let logs: { type: 'stdout' | 'stderr' | 'info' | 'error', text: string, timestamp: number }[] = [];
let clients: express.Response[] = [];

// Directories
const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

function broadcastLog(log: typeof logs[0]) {
  logs.push(log);
  if (logs.length > 1000) logs.shift(); // Keep last 1000 lines
  const data = JSON.stringify(log);
  clients.forEach(c => c.write(`data: ${data}\n\n`));
}

function addLog(type: typeof logs[0]['type'], text: string) {
  broadcastLog({ type, text, timestamp: Date.now() });
}

// Check installed software
app.get('/api/status', (req, res) => {
  exec('python3 --version', (errP3) => {
    const hasPython3 = !errP3;
    const pythonCmd = hasPython3 ? 'python3' : 'python';
    
    exec(`${pythonCmd} --version`, (errP) => {
      const pCmd = !errP ? pythonCmd : null;
      if (!pCmd) {
        return res.json({ python: false, instaloader: false });
      }

      exec(`${pCmd} -m instaloader --version`, (errI) => {
        res.json({
          python: true,
          pythonCommand: pCmd,
          instaloader: !errI
        });
      });
    });
  });
});

app.post('/api/install', (req, res) => {
  if (activeProcess) {
    return res.status(400).json({ error: 'A process is already running' });
  }

  const { pythonCommand } = req.body;
  if (!pythonCommand) return res.status(400).json({ error: 'Missing Python command' });

  addLog('info', 'Starting installation of instaloader...');
  
  // Use pip module
  activeProcess = spawn(pythonCommand, ['-m', 'pip', 'install', 'instaloader']);
  res.json({ success: true, message: 'Installation started' });

  activeProcess.stdout.on('data', (data: any) => addLog('stdout', data.toString()));
  activeProcess.stderr.on('data', (data: any) => addLog('stderr', data.toString()));
  
  activeProcess.on('close', (code: number) => {
    addLog('info', `Installation process exited with code ${code}`);
    activeProcess = null;
  });
});

app.post('/api/run', (req, res) => {
  if (activeProcess) {
    return res.status(400).json({ error: 'A process is already running' });
  }

  const { pythonCommand, target, options } = req.body;
  if (!pythonCommand || !target) return res.status(400).json({ error: 'Missing parameters' });

  let args = ['-m', 'instaloader', '--dirname-pattern', path.join(DOWNLOAD_DIR, '{profile}')];
  
  if (options.downloadComments) args.push('--comments');
  if (options.downloadGeotags) args.push('--geotags');
  if (options.downloadIGTV) args.push('--igtv');
  if (options.downloadStories) args.push('--stories');
  if (options.downloadHighlights) args.push('--highlights');
  if (options.downloadTagged) args.push('--tagged');
  if (options.fastUpdate) args.push('--fast-update');
  if (options.noPictures) args.push('--no-pictures');
  if (options.noVideos) args.push('--no-videos');
  if (options.noCaptions) args.push('--no-captions');
  if (options.noMetadata) args.push('--no-metadata-json');
  if (options.postFilter) args.push('--post-filter', options.postFilter);
  if (options.count) args.push('--count', options.count.toString());
  if (options.loginUser) {
    args.push('--login', options.loginUser);
    if (options.loginPassword) {
      args.push('--password', options.loginPassword);
    }
  }

  args.push(target);

  addLog('info', `Running: ${pythonCommand} ${args.join(' ')}`);
  
  activeProcess = spawn(pythonCommand, args, { cwd: DOWNLOAD_DIR });
  res.json({ success: true, message: 'Process started' });

  activeProcess.stdout.on('data', (data: any) => addLog('stdout', data.toString()));
  activeProcess.stderr.on('data', (data: any) => addLog('stderr', data.toString()));
  
  activeProcess.on('close', (code: number) => {
    addLog('info', `Instaloader process exited with code ${code}`);
    activeProcess = null;
  });
});

app.post('/api/stop', (req, res) => {
  if (activeProcess) {
    activeProcess.kill();
    activeProcess = null;
    addLog('info', 'Process terminated by user.');
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'No active process' });
});

app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send recent logs to catch up
  logs.forEach(log => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  });

  clients.push(res);
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

app.get('/api/files', (req, res) => {
  try {
    const listDir = (dirPath: string): any[] => {
      const result: any[] = [];
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        const relPath = path.relative(DOWNLOAD_DIR, fullPath);
        if (item.isDirectory()) {
          result.push({ name: item.name, type: 'directory', path: relPath, children: listDir(fullPath) });
        } else {
          result.push({ name: item.name, type: 'file', path: relPath, size: fs.statSync(fullPath).size });
        }
      }
      return result;
    };
    res.json({ profiles: listDir(DOWNLOAD_DIR) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import archiver from 'archiver';

app.delete('/api/files', (req, res) => {
  const { p } = req.query;
  if (!p || typeof p !== 'string') return res.status(400).json({ error: 'Missing path' });

  const fullPath = path.join(DOWNLOAD_DIR, p);
  // Security check to ensure it's inside DOWNLOAD_DIR
  if (!fullPath.startsWith(DOWNLOAD_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/zip', (req, res) => {
  const { p } = req.query;
  if (!p || typeof p !== 'string') return res.status(400).json({ error: 'Missing path' });

  const fullPath = path.join(DOWNLOAD_DIR, p);
  // Security check to ensure it's inside DOWNLOAD_DIR
  if (!fullPath.startsWith(DOWNLOAD_DIR) || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const stat = fs.statSync(fullPath);
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: 'Path is not a directory' });
  }

  res.attachment(`${p}.zip`);
  const archive = archiver('zip', { zlib: { level: 5 } });
  
  archive.on('error', (err) => {
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);
  archive.directory(fullPath, false);
  archive.finalize();
});

app.use('/downloads', express.static(DOWNLOAD_DIR));

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
