import Groq from 'groq-sdk';

import { config } from './config.ts';
import {
  daysInMonth, setCell, summarise, validate,
  type DomainCode, type DomainEmployee, type DomainLeave, type RosterMonth,
} from './engine.ts';

export interface AiContext {
  roster: RosterMonth;
  employees: DomainEmployee[];
  codes: DomainCode[];
  leave: DomainLeave[];
}

export interface ProposedAction {
  employeeId: string;
  dayIndex: number; // 0-based
  code: string;
  reason?: string;
}

export interface AiAnswer {
  answer: string;
  actions: ProposedAction[];
  preview: {
    errorsBefore: number;
    errorsAfter: number;
    warningsBefore: number;
    warningsAfter: number;
    rejected: { action: ProposedAction; why: string }[];
  } | null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Renders the month for the model as compact text — one line per person —
 * rather than JSON. 22 people × 30 days is ~1k tokens this way; as JSON it
 * would be ten times that and no easier for the model to read.
 */
function describe(ctx: AiContext): string {
  const { roster, employees, codes, leave } = ctx;
  const nDays = daysInMonth(roster.year, roster.month);
  const days = summarise(roster, codes, nDays);
  const issues = validate({ roster, employees, codes, leaveBlocks: leave, nDays });

  const lines: string[] = [];
  lines.push(`Month: ${roster.year}-${String(roster.month).padStart(2, '0')} (${nDays} days). Day 1 is a ${WEEKDAYS[new Date(roster.year, roster.month - 1, 1).getDay()]}.`);
  lines.push('');
  lines.push('Shift codes (id: label, timing, minimum people per day):');
  for (const c of codes) {
    lines.push(`  ${c.id}: ${c.label}, ${c.timing}, min ${c.minHeadcount}${c.isStatus ? ' (non-working status)' : ''}${c.rotates ? ' (rotates)' : ''}`);
  }
  lines.push('  -: day off');
  lines.push('');
  lines.push('People (id | name | default shift | rest days | fixed?) and their month, one character-code per day from day 1:');
  for (const e of employees) {
    const row = roster.cells[e.id]?.map((c) => c.code).join(' ') ?? '';
    const rest = e.restDays.map((d) => WEEKDAYS[d]).join('+');
    lines.push(`  ${e.id} | ${e.name} | ${e.defaultShift} | ${rest} | ${e.pinned ? 'fixed' : 'rotates'}`);
    lines.push(`     ${row}`);
  }
  lines.push('');
  lines.push('Headcount per day (day: M/E/N …):');
  const worked = codes.filter((c) => !c.isStatus && (c.minHeadcount > 0 || days.some((d) => (d.total[c.id] ?? 0) > 0)));
  lines.push('  ' + days.map((d, i) => `${i + 1}:${worked.map((c) => `${c.id}${d.total[c.id] ?? 0}`).join('/')}`).join('  '));
  lines.push('');
  lines.push(`Current issues (${issues.length}):`);
  for (const i of issues.slice(0, 40)) lines.push(`  [${i.severity}] ${i.message}`);
  if (issues.length > 40) lines.push(`  …and ${issues.length - 40} more`);
  return lines.join('\n');
}

const SYSTEM = `You are ShiftLine's roster assistant for a supervisor running a three-shift operation (Morning, Evening, Night) with fixed weekly rest days per person.

Answer questions about the roster plainly and briefly, in the supervisor's terms. Use day numbers and people's names, not ids, in the answer text.

If the supervisor asks you to CHANGE the roster, propose the specific cell edits as actions. Each action sets one person on one day to one code. Rules you must respect:
- Never put someone on a day inside their leave block.
- Prefer not to work someone on their rest days; if you must, say so.
- Never schedule Night one day and Morning the next for the same person.
- Keep every shift at or above its minimum on every day.
- People marked "fixed" stay on their current shift unless explicitly asked.

Respond ONLY with JSON of the form:
{"answer": "<plain-English answer>", "actions": [{"employeeId": "<id>", "day": <1-based day number>, "code": "<code>", "reason": "<short why>"}]}
If no change is being requested, "actions" is an empty array. Do not invent employee ids or codes that are not listed.`;

export async function ask(question: string, ctx: AiContext, history: { role: 'user' | 'assistant'; content: string }[] = []): Promise<AiAnswer> {
  if (!config.groqApiKey) {
    throw new Error('GROQ_API_KEY is not set on the server.');
  }
  const groq = new Groq({ apiKey: config.groqApiKey });

  const completion = await groq.chat.completions.create({
    model: config.groqModel,
    temperature: 0.2,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `ROSTER CONTEXT\n\n${describe(ctx)}` },
      ...history.slice(-6),
      { role: 'user', content: question },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: { answer?: string; actions?: { employeeId?: string; day?: number; code?: string; reason?: string }[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { answer: raw, actions: [], preview: null };
  }

  const actions = validateActions(parsed.actions ?? [], ctx);
  return {
    answer: parsed.answer ?? '',
    actions: actions.accepted,
    preview: actions.accepted.length || actions.rejected.length ? preview(actions.accepted, actions.rejected, ctx) : null,
  };
}

/** Drops anything the model made up: unknown people, codes, or days. */
function validateActions(
  raw: { employeeId?: string; day?: number; code?: string; reason?: string }[],
  ctx: AiContext,
): { accepted: ProposedAction[]; rejected: { action: ProposedAction; why: string }[] } {
  const nDays = daysInMonth(ctx.roster.year, ctx.roster.month);
  const empIds = new Set(ctx.employees.map((e) => e.id));
  const codeIds = new Set([...ctx.codes.map((c) => c.id), '-']);
  const accepted: ProposedAction[] = [];
  const rejected: { action: ProposedAction; why: string }[] = [];

  for (const a of raw) {
    const action: ProposedAction = {
      employeeId: String(a.employeeId ?? ''),
      dayIndex: Number(a.day ?? 0) - 1,
      code: String(a.code ?? ''),
      reason: a.reason,
    };
    if (!empIds.has(action.employeeId)) { rejected.push({ action, why: 'unknown person' }); continue; }
    if (!codeIds.has(action.code)) { rejected.push({ action, why: `unknown code "${action.code}"` }); continue; }
    if (!(action.dayIndex >= 0 && action.dayIndex < nDays)) { rejected.push({ action, why: 'day out of range' }); continue; }
    accepted.push(action);
  }
  return { accepted, rejected };
}

/** Applies the actions to a copy and reports how the issue count moves. */
function preview(actions: ProposedAction[], rejected: { action: ProposedAction; why: string }[], ctx: AiContext): AiAnswer['preview'] {
  const nDays = daysInMonth(ctx.roster.year, ctx.roster.month);
  const count = (r: RosterMonth) => {
    const issues = validate({ roster: r, employees: ctx.employees, codes: ctx.codes, leaveBlocks: ctx.leave, nDays });
    return {
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
    };
  };
  const before = count(ctx.roster);
  let next = ctx.roster;
  for (const a of actions) next = setCell(next, a.employeeId, a.dayIndex, a.code);
  const after = count(next);
  return {
    errorsBefore: before.errors, errorsAfter: after.errors,
    warningsBefore: before.warnings, warningsAfter: after.warnings,
    rejected,
  };
}
