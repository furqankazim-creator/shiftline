import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireSupervisor } from '../auth.ts';
import { audit } from '../audit.ts';
import {
  autoRotate, buildHistory, daysInMonth, generateMonth, rosterId, setCell, summarise, validate,
  type DomainCode, type DomainEmployee, type DomainLeave, type RosterMonth,
} from '../engine.ts';
import { Employee, Leave, Roster, ShiftCode } from '../models.ts';

export const rostersRouter = Router();
rostersRouter.use(requireAuth);

/** Everything the engine needs for one line, straight from Mongo. */
async function loadLine(lineId: string) {
  const employees = (await Employee.find({ lineId }).sort({ order: 1 }).lean()) as unknown as DomainEmployee[];
  const ids = employees.map((e) => e.id);
  const leave = (await Leave.find({ employeeId: { $in: ids } }).lean()) as unknown as DomainLeave[];
  const codes = (await ShiftCode.find().sort({ order: 1 }).lean()) as unknown as DomainCode[];
  return { employees, leave, codes };
}

/** Stored month if there is one, otherwise generated from rules (and saved). */
async function loadOrBuild(lineId: string, year: number, month: number): Promise<RosterMonth> {
  const id = rosterId(lineId, year, month);
  const stored = await Roster.findOne({ id }).lean();
  const { employees, leave } = await loadLine(lineId);
  const roster = generateMonth({
    year, month, lineId, employees, leaveBlocks: leave,
    overrides: (stored?.overrides as RosterMonth['overrides']) ?? {},
  });
  if (!stored) await Roster.create(roster);
  return roster;
}

rostersRouter.get('/:lineId/:year/:month', async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const roster = await loadOrBuild(req.params.lineId, year, month);
  const { employees, leave, codes } = await loadLine(req.params.lineId);
  const nDays = daysInMonth(year, month);
  res.json({
    roster,
    days: summarise(roster, codes, nDays),
    issues: validate({ roster, employees, codes, leaveBlocks: leave, nDays }),
  });
});

/** One hand edit. The engine keeps `cells` and `overrides` in step. */
rostersRouter.post('/:lineId/:year/:month/cell', requireSupervisor, async (req, res) => {
  const body = z.object({ employeeId: z.string(), dayIndex: z.number().int().min(0), code: z.string() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'employeeId, dayIndex and code are required.' });

  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const current = await loadOrBuild(req.params.lineId, year, month);
  const before = current.cells[body.data.employeeId]?.[body.data.dayIndex]?.code;
  const next = setCell(current, body.data.employeeId, body.data.dayIndex, body.data.code);

  await Roster.updateOne({ id: next.id }, next, { upsert: true });
  audit(req, 'roster.cell', `${next.id} / ${body.data.employeeId} / day ${body.data.dayIndex + 1}`, before, body.data.code);
  res.json(next);
});

/** Rebuild from rules, optionally dropping hand edits. */
rostersRouter.post('/:lineId/:year/:month/generate', requireSupervisor, async (req, res) => {
  const respectOverrides = req.body?.respectOverrides !== false;
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const stored = await Roster.findOne({ id: rosterId(req.params.lineId, year, month) }).lean();
  const { employees, leave } = await loadLine(req.params.lineId);

  const next = generateMonth({
    year, month, lineId: req.params.lineId, employees, leaveBlocks: leave,
    overrides: respectOverrides ? ((stored?.overrides as RosterMonth['overrides']) ?? {}) : {},
    respectOverrides,
  });
  await Roster.updateOne({ id: next.id }, next, { upsert: true });
  audit(req, 'roster.generate', next.id, undefined, { respectOverrides });
  res.json(next);
});

/** Preview (GET) or apply (POST) a fair rotation into the following month. */
rostersRouter.get('/:lineId/:year/:month/rotate', async (req, res) => {
  const aggressiveness = Number(req.query.aggressiveness ?? 1);
  res.json(await rotation(req.params.lineId, Number(req.params.year), Number(req.params.month), aggressiveness));
});

rostersRouter.post('/:lineId/:year/:month/rotate', requireSupervisor, async (req, res) => {
  const aggressiveness = Number(req.body?.aggressiveness ?? 1);
  const { target, result } = await rotation(req.params.lineId, Number(req.params.year), Number(req.params.month), aggressiveness);

  const key = `${target.year}-${String(target.month).padStart(2, '0')}`;
  const span = daysInMonth(target.year, target.month);
  for (const [empId, code] of Object.entries(result.assignments)) {
    const emp = await Employee.findOne({ id: empId });
    if (!emp) continue;
    emp.rotations = { ...(emp.rotations ?? {}), [key]: [{ fromDay: 1, toDay: span, code }] };
    emp.markModified('rotations');
    await emp.save();
  }
  await Roster.deleteOne({ id: rosterId(req.params.lineId, target.year, target.month) });
  audit(req, 'roster.rotate', `${req.params.lineId}:${key}`, undefined, result.assignments);
  res.json({ target, result });
});

async function rotation(lineId: string, year: number, month: number, aggressiveness: number) {
  const { employees, codes } = await loadLine(lineId);
  const past = (await Roster.find({ lineId }).lean()) as unknown as RosterMonth[];
  const history = buildHistory(past.filter((r) => r.year * 12 + r.month <= year * 12 + month));
  const zero = year * 12 + month; // month is 1-based, so this is next month's index
  const target = { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
  const result = autoRotate({ year: target.year, month: target.month, employees, codes, history, aggressiveness });
  return { target, result };
}
