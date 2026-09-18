import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

import { seedAdmin } from './auth.ts';
import { config } from './config.ts';
import { aiRouter } from './routes/ai.ts';
import { auditRouter } from './routes/audit.ts';
import { authRouter } from './routes/auth.ts';
import { codesRouter, employeesRouter, leaveRouter, linesRouter, settingsRouter } from './routes/data.ts';
import { rostersRouter } from './routes/rosters.ts';
import { syncRouter } from './routes/sync.ts';

const app = express();
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, ai: Boolean(config.groqApiKey) }));

app.use('/auth', authRouter);
app.use('/lines', linesRouter);
app.use('/codes', codesRouter);
app.use('/employees', employeesRouter);
app.use('/leave', leaveRouter);
app.use('/settings', settingsRouter);
app.use('/rosters', rostersRouter);
app.use('/sync', syncRouter);
app.use('/audit', auditRouter);
app.use('/ai', aiRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');
  await seedAdmin();
  app.listen(config.port, () => console.log(`ShiftLine API on http://localhost:${config.port}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
