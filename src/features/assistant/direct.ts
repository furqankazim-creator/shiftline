/**
 * Browser-direct assistant: the same prompt, guard-rails and preview as
 * server/src/ai.ts, but calling Groq straight from the browser with a key the
 * supervisor saves in Setup.
 *
 * This is what lets the chat work with no server running. The trade-off is
 * that the key lives in this browser's localStorage, so it is only as private
 * as this machine — fine for a single supervisor's own key, not for sharing.
 */
import type { AiAction, AiReply } from '@/app/api';
import { daysInMonth } from '@/domain/calendar';
import { setCell } from '@/domain/generator';
import { summarise } from '@/domain/summary';
import type { Employee, LeaveBlock, RosterMonth, ShiftCode } from '@/domain/types';
import { WEEKDAY_LABELS } from '@/domain/types';
import { validate } from '@/domain/validate';

const KEY_KEY = 'shiftline.groqKey';
export const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export function getGroqKey(): string {
  try {
    return localStorage.getItem(KEY_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setGroqKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(KEY_KEY, key.trim());
    else localStorage.removeItem(KEY_KEY);
  } catch {
    /* ignore */
  }
}

export interface DirectContext {
  roster: RosterMonth;
  employees: Employee[];
  codes: ShiftCode[];
  leave: LeaveBlock[];
}

/** One line per person — ~1k tokens for a full month, ten times less than JSON. */
function describe(ctx: DirectContext): string {
  const { roster, employees, codes, leave } = ctx;
  const nDays = daysInMonth(roster.year, roster.month);
  const days = summarise(roster, codes, nDays);
  const issues = validate({ roster, employees, codes, leaveBlocks: leave, nDays });

  const lines: string[] = [];
  lines.push(`Month: ${roster.year}-${String(roster.month).padStart(2, '0')} (${nDays} days). Day 1 is a ${WEEKDAY_LABELS[new Date(roster.year, roster.month - 1, 1).getDay()]}.`);
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
    const rest = e.restDays.map((d) => WEEKDAY_LABELS[d]).join('+');
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

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

async function complete(key: string, messages: Msg[], strictJson: boolean): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_tokens: 4000,
      messages,
      // gpt-oss reasons before answering; keep it short or the budget runs
      // out before any JSON is written.
      reasoning_effort: 'low',
      ...(strictJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string }; choices?: { message?: { content?: string } }[] };
  if (!res.ok) {
    const why = body.error?.message ?? `Groq request failed (${res.status})`;
    if (res.status === 401) throw new Error('Groq rejected the key. Check it in Setup → Assistant.');
    throw new Error(why);
  }
  return body.choices?.[0]?.message?.content ?? '';
}

export async function askDirect(
  question: string,
  ctx: DirectContext,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): Promise<AiReply> {
  const key = getGroqKey();
  if (!key) throw new Error('No Groq key saved. Add one in Setup → Assistant.');

  const messages: Msg[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `ROSTER CONTEXT\n\n${describe(ctx)}` },
    ...history.slice(-6),
    { role: 'user', content: question },
  ];

  let raw = '';
  try {
    raw = await complete(key, messages, true);
  } catch (e) {
    // Groq's strict JSON validation occasionally rejects a fine answer; fall
    // back to a free-form completion and pull the JSON object out of it.
    if (!(e instanceof Error && /json/i.test(e.message))) throw e;
    raw = await complete(key, messages, false);
  }

  let parsed: { answer?: string; actions?: { employeeId?: string; day?: number; code?: string; reason?: string }[] };
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return { answer: raw.trim() || 'I could not form an answer — please try rephrasing.', actions: [], preview: null };
  }

  const actions = validateActions(parsed.actions ?? [], ctx);
  return {
    answer: parsed.answer ?? '',
    actions: actions.accepted,
    preview: actions.accepted.length || actions.rejected.length ? preview(actions.accepted, actions.rejected, ctx) : null,
  };
}

/** The first balanced {...} in a string — tolerates prose or code fences around the JSON. */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('no json');
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('unbalanced json');
}

/** Drops anything the model made up: unknown people, codes, or days. */
function validateActions(
  raw: { employeeId?: string; day?: number; code?: string; reason?: string }[],
  ctx: DirectContext,
): { accepted: AiAction[]; rejected: { action: AiAction; why: string }[] } {
  const nDays = daysInMonth(ctx.roster.year, ctx.roster.month);
  const empIds = new Set(ctx.employees.map((e) => e.id));
  const codeIds = new Set([...ctx.codes.map((c) => c.id), '-']);
  const accepted: AiAction[] = [];
  const rejected: { action: AiAction; why: string }[] = [];

  for (const a of raw) {
    const action: AiAction = {
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
function preview(actions: AiAction[], rejected: { action: AiAction; why: string }[], ctx: DirectContext): AiReply['preview'] {
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
