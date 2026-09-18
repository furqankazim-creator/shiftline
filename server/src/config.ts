import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `\nMissing ${name}.\n` +
      `  • For real use: copy server/.env.example to server/.env and fill it in.\n` +
      `  • To try it now with no setup: npx tsx scripts/dev-mem.ts (in-memory database)\n`,
    );
    process.exit(1);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4400),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/shiftline',
  jwtSecret: process.env.JWT_SECRET || 'shiftline-super-secret-jwt-key-2026-persistent',
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqModel: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
  adminEmail: process.env.ADMIN_EMAIL ?? '',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  /** When true, /ai/ask works without signing in — for demos. Applying still needs a supervisor. */
  aiPublic: (process.env.AI_PUBLIC ?? 'true').toLowerCase() !== 'false',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
};
