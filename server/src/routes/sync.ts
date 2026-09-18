import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireSupervisor } from '../auth.ts';
import { audit } from '../audit.ts';
import { Employee, Leave, Line, Roster, Settings, ShiftCode } from '../models.ts';

/**
 * Whole-dataset sync, in the same shape as the app's JSON backup.
 *
 * This is what lets the existing local-first web app share data across
 * devices without rewriting its store: push everything up, pull everything
 * down. Per-record routes exist too, for the next step.
 */
export const syncRouter = Router();
syncRouter.use(requireAuth);

const backupShape = z.object({
  lines: z.array(z.any()).default([]),
  codes: z.array(z.any()).default([]),
  employees: z.array(z.any()),
  leave: z.array(z.any()).default([]),
  rosters: z.array(z.any()).default([]),
  settings: z.any().optional(),
});

syncRouter.get('/', async (_req, res) => {
  const [lines, codes, employees, leave, rosters, settings] = await Promise.all([
    Line.find().lean(), ShiftCode.find().lean(), Employee.find().lean(),
    Leave.find().lean(), Roster.find().lean(), Settings.findOne({ key: 'app' }).lean(),
  ]);
  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    lines, codes, employees, leave, rosters,
    settings: settings?.data ?? null,
  });
});

syncRouter.post('/', requireSupervisor, async (req, res) => {
  const body = backupShape.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'That is not a ShiftLine backup.' });
  const d = body.data;

  const strip = (rows: any[]) => rows.map(({ _id, __v, ...rest }) => rest);
  const replace = async (model: any, rows: any[]) => {
    await model.deleteMany({});
    if (rows.length) await model.insertMany(strip(rows));
  };

  await replace(Line, d.lines);
  await replace(ShiftCode, d.codes);
  await replace(Employee, d.employees);
  await replace(Leave, d.leave);
  await replace(Roster, d.rosters);
  if (d.settings) {
    const { key: _k, seeded: _s, ...data } = d.settings;
    await Settings.updateOne({ key: 'app' }, { data }, { upsert: true });
  }

  audit(req, 'sync.push', 'all', undefined, {
    lines: d.lines.length, employees: d.employees.length, rosters: d.rosters.length,
  });
  res.json({ ok: true, employees: d.employees.length, rosters: d.rosters.length });
});
