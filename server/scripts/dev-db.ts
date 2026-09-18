/** Starts the API against local persistent MongoDB that saves data across restarts. */
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(__dirname, '../data/db');
fs.mkdirSync(dbDir, { recursive: true });

// Clean stale locks if no mongod process is running
for (const lock of ['mongod.lock', 'WiredTiger.lock']) {
  const p = path.join(dbDir, lock);
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
}

// Function to check if a port is ready
function isPortReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createConnection(port, '127.0.0.1');
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => { s.destroy(); resolve(false); });
  });
}

// Check if MongoDB is already listening on port 27018
let mongodProc: ReturnType<typeof spawn> | null = null;
const alreadyUp = await isPortReady(27018);

if (!alreadyUp) {
  console.log(`Starting native MongoDB server on port 27018 (data: ${dbDir})...`);
  mongodProc = spawn('/usr/bin/mongod', [
    '--dbpath', dbDir,
    '--port', '27018',
    '--nounixsocket',
    '--bind_ip', '127.0.0.1',
    '--logpath', path.join(dbDir, 'mongod.log'),
  ], {
    stdio: 'ignore',
    detached: false,
  });

  // Wait for 27018 to become ready
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await isPortReady(27018)) {
      ready = true;
      break;
    }
  }
  if (!ready) {
    console.error('Failed to start MongoDB on port 27018. Check server/data/db/mongod.log');
    process.exit(1);
  }
}

console.log('MongoDB is ready! Starting ShiftLine API...');

const tsxBin = path.resolve(__dirname, '../node_modules/.bin/tsx');
const child = spawn(tsxBin, ['src/index.ts'], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  env: {
    ...process.env,
    PORT: process.env.PORT ?? '4400',
    MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27018/shiftline',
    JWT_SECRET: process.env.JWT_SECRET ?? 'shiftline-super-secret-jwt-key-2026-persistent',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? 'supervisor@example.com',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? 'supervisor1',
    CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:5211',
    AI_PUBLIC: process.env.AI_PUBLIC ?? 'true',
  },
});

const cleanup = () => {
  try { child.kill('SIGTERM'); } catch {}
  if (mongodProc) {
    try { mongodProc.kill('SIGTERM'); } catch {}
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
child.on('exit', (code) => {
  if (mongodProc) {
    try { mongodProc.kill('SIGTERM'); } catch {}
  }
  process.exit(code ?? 0);
});
