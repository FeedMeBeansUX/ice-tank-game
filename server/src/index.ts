/**
 * Ice Tank Sumo game server.
 *
 * One command (`npm start` in the repository folder) builds the browser game
 * and starts this server. It:
 * - serves the game at http://localhost:8080 (and on your local network),
 * - runs the multiplayer test room over a WebSocket at /ws.
 *
 * The server runs the real game (the shared simulation, 60 steps a second)
 * and sends the state to every browser about 20 times a second. Browsers only
 * send inputs, so positions, hits and scores can't be faked.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { SOCKET_PATH } from '@ice-tank-sumo/shared';
import { Room } from './room';

const PORT = Number(process.env.PORT ?? 8080);
const here = fileURLToPath(new URL('.', import.meta.url));
const STATIC_DIR = resolve(here, '../../client/dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const room = new Room((text) => console.log(`[room] ${text}`));

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ server: 'ice-tank-sumo', socketPath: SOCKET_PATH }));
    return;
  }
  // Static files from the built browser game (client/dist).
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = join(STATIC_DIR, relative || 'index.html');
  if (!file.startsWith(STATIC_DIR + sep) && file !== STATIC_DIR) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('The game has not been built yet. Run "npm start" (it builds first) instead of starting the server on its own.');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
});

const sockets = new WebSocketServer({ server, path: SOCKET_PATH });
sockets.on('connection', (socket) => {
  const handlers = room.connect({
    send: (data) => {
      if (socket.readyState === socket.OPEN) socket.send(data);
    },
    close: () => socket.close(),
  });
  socket.on('message', (data) => handlers.onMessage(String(data)));
  socket.on('close', () => handlers.onClose());
  socket.on('error', () => socket.close());
});

// Run the room: simulation steps and state updates.
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  room.advance((now - last) / 1000);
  last = now;
}, 1000 / 120);

server.listen(PORT, () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => `http://${a!.address}:${PORT}`);
  console.log('');
  console.log('  Ice Tank Sumo server is running.');
  console.log(`  Play on this computer:   http://localhost:${PORT}`);
  for (const address of lan) console.log(`  Friends on your Wi-Fi:   ${address}`);
  console.log('  Stop the server with Ctrl+C.');
  console.log('');
});
