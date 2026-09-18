import { Router } from 'express';
import type { Model } from 'mongoose';

import { requireAuth, requireSupervisor } from '../auth.ts';
import { audit } from '../audit.ts';
import { Employee, Leave, Line, Settings, ShiftCode } from '../models.ts';

/**
 * Plain CRUD for the reference collections. Each is keyed by the app's own
 * string `id`, so PUT is an upsert and the web app can keep using its ids.
 */
function crud(name: string, model: Model<any>) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (req, res) => {
    const filter = req.query.lineId ? { lineId: String(req.query.lineId) } : {};
    res.json(await model.find(filter).sort({ order: 1 }).lean());
  });

  r.put('/:id', requireSupervisor, async (req, res) => {
    const before = await model.findOne({ id: req.params.id }).lean();
    const doc = { ...req.body, id: req.params.id };
    await model.updateOne({ id: req.params.id }, doc, { upsert: true });
    audit(req, `${name}.upsert`, req.params.id, before ?? undefined, doc);
    res.json(doc);
  });

  r.delete('/:id', requireSupervisor, async (req, res) => {
    const before = await model.findOneAndDelete({ id: req.params.id }).lean();
    if (name === 'employee') await Leave.deleteMany({ employeeId: req.params.id });
    audit(req, `${name}.delete`, req.params.id, before ?? undefined);
    res.json({ ok: true });
  });

  return r;
}

export const linesRouter = crud('line', Line);
export const codesRouter = crud('code', ShiftCode);
export const employeesRouter = crud('employee', Employee);
export const leaveRouter = crud('leave', Leave);

export const settingsRouter = Router();
settingsRouter.use(requireAuth);
settingsRouter.get('/', async (_req, res) => {
  const s = await Settings.findOne({ key: 'app' }).lean();
  res.json(s?.data ?? {});
});
settingsRouter.put('/', requireSupervisor, async (req, res) => {
  await Settings.updateOne({ key: 'app' }, { data: req.body }, { upsert: true });
  res.json(req.body);
});
