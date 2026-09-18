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
  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqModel: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  adminEmail: process.env.ADMIN_EMAIL ?? '',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  /** When true, /ai/ask works without signing in — for demos. Applying still needs a supervisor. */
  aiPublic: (process.env.AI_PUBLIC ?? 'true').toLowerCase() !== 'false',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
};
