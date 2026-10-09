import { Router } from 'express';
import { z } from 'zod';

import { ask, type AiContext } from '../ai.ts';
import { optionalAuth, requireAuth, requireSupervisor } from '../auth.ts';
import { config } from '../config.ts';
import { audit } from '../audit.ts';
import { generateMonth, rosterId, setCell, type RosterMonth } from '../engine.ts';
import { Employee, Leave, Roster, ShiftCode } from '../models.ts';

export const aiRouter = Router();
// Demo mode: questions without sign-in; applying to the stored month still needs a supervisor.
aiRouter.use(config.aiPublic ? optionalAuth : requireAuth);

const askShape = z.object({
  lineId: z.string(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  question: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).optional(),
  /**
   * The local-first web app can send its own data instead of relying on what
   * is in Mongo, so the assistant answers about what the supervisor is
   * actually looking at.
   */
  context: z
    .object({
      roster: z.any(),
      employees: z.array(z.any()),
      codes: z.array(z.any()),
      leave: z.array(z.any()).default([]),
      /** Live Work Orders / staffing summary rendered by the web app. */
      workOrders: z.string().max(30000).optional(),
    })
    .optional(),
});

async function contextFromDb(lineId: string, year: number, month: number): Promise<AiContext> {
  const employees = (await Employee.find({ lineId }).sort({ order: 1 }).lean()) as any;
  const leave = (await Leave.find({ employeeId: { $in: employees.map((e: any) => e.id) } }).lean()) as any;
  const codes = (await ShiftCode.find().sort({ order: 1 }).lean()) as any;
  const stored = (await Roster.findOne({ id: rosterId(lineId, year, month) }).lean()) as any;
  const roster = generateMonth({ year, month, lineId, employees, leaveBlocks: leave, overrides: stored?.overrides ?? {} });
  return { roster, employees, codes, leave };
}

aiRouter.post('/ask', async (req, res) => {
  const body = askShape.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'lineId, year, month and question are required.' });
  const { lineId, year, month, question, history, context } = body.data;

  try {
    const ctx: AiContext = context
      ? (context as AiContext)
      : await contextFromDb(lineId, year, month);
    const result = await ask(question, ctx, history);
    audit(req, 'ai.ask', `${lineId}:${year}-${month}`, question, { actions: result.actions.length });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'The assistant is unavailable.' });
  }
});

/** Apply previously proposed actions to the stored month (server-side data). */
aiRouter.post('/apply', requireAuth, requireSupervisor, async (req, res) => {
  const body = z
    .object({
      lineId: z.string(), year: z.number().int(), month: z.number().int(),
      actions: z.array(z.object({ employeeId: z.string(), dayIndex: z.number().int(), code: z.string() })).min(1),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'actions are required.' });

  const { lineId, year, month, actions } = body.data;
  const ctx = await contextFromDb(lineId, year, month);
  let next: RosterMonth = ctx.roster;
  for (const a of actions) next = setCell(next, a.employeeId, a.dayIndex, a.code);
  await Roster.updateOne({ id: next.id }, next, { upsert: true });
  audit(req, 'ai.apply', next.id, undefined, actions);
  res.json(next);
});
