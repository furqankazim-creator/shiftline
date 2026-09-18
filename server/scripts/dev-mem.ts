/** Starts the API against an in-memory MongoDB, for local UI testing without Atlas. */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
const mongo = await MongoMemoryServer.create();
const child = spawn('npx', ['tsx', 'src/index.ts'], {
  stdio: 'inherit',
  detached: true,
  env: { ...process.env, PORT: process.env.PORT ?? '4000', MONGODB_URI: mongo.getUri('shiftline'),
    JWT_SECRET: 'dev-secret', ADMIN_EMAIL: 'sup@example.com', ADMIN_PASSWORD: 'supervisor1',
    CORS_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:5211', AI_PUBLIC: process.env.AI_PUBLIC ?? 'false' },
});
const stop = () => { try { process.kill(-child.pid!, 'SIGTERM'); } catch { child.kill(); } void mongo.stop(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
