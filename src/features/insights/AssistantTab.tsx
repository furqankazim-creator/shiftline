import { useEffect, useRef, useState } from 'react';

import { askAssistant, cloudEnabled, getUser, type AiAction, type AiReply } from '@/app/api';
import { useStore } from '@/app/store';
import { toneVars } from '@/app/tones';
import { Button, cx, useToast } from '@/components/ui';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  reply?: AiReply;
  applied?: boolean;
}

const SUGGESTIONS = [
  'Which days are short-staffed and who could cover?',
  'Summarise this month\'s coverage in three lines.',
  'Who has worked the most night shifts?',
  'Move someone to cover Night on the short days.',
];

/**
 * The Assistant: plain-language questions about the roster, answered by the
 * API's Groq model over the month the supervisor is looking at.
 *
 * The model only ever *proposes*. Any edit it suggests comes back as a list of
 * cell actions with a before/after error count, and is applied here through
 * the same paintCell path as a hand edit — so it is undoable and validated.
 */
export function AssistantTab() {
  const { settings, roster, employees, codes, leave, paintCell } = useStore();
  const toast = useToast();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  const codeById = new Map(codes.map((c) => [c.id, c]));
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.name ?? id;

  if (!cloudEnabled()) {
    return (
      <Empty title="Assistant not connected">
        This install has no API URL configured. The assistant runs on the ShiftLine server; ask your
        developer to set <code className="font-mono">VITE_API_URL</code>.
      </Empty>
    );
  }
  if (!getUser()) {
    return (
      <Empty title="Sign in to use the assistant">
        Go to <b>Setup › Cloud</b> and sign in with your supervisor account.
      </Empty>
    );
  }

  const send = async (question: string) => {
    if (!roster || !question.trim() || busy) return;
    const q = question.trim();
    setInput('');
    setTurns((t) => [...t, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const reply = await askAssistant({
        lineId: settings.activeLineId,
        year: settings.activeYear,
        month: settings.activeMonth,
        question: q,
        history: turns.slice(-6).map((t) => ({ role: t.role, content: t.content })),
        context: { roster, employees, codes, leave },
      });
      setTurns((t) => [...t, { role: 'assistant', content: reply.answer, reply }]);
    } catch (e) {
      setTurns((t) => [
        ...t,
        { role: 'assistant', content: e instanceof Error ? e.message : 'The assistant is unavailable.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const apply = (turnIndex: number, actions: AiAction[]) => {
    for (const a of actions) paintCell(a.employeeId, a.dayIndex, a.code);
    setTurns((t) => t.map((turn, i) => (i === turnIndex ? { ...turn, applied: true } : turn)));
    toast(`Applied ${actions.length} change${actions.length === 1 ? '' : 's'}. Ctrl+Z undoes them.`, 'ok');
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {turns.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[11.5px] leading-snug text-ink-3">
              Ask about the month you're looking at. The assistant can explain, summarise, and propose
              cell changes — which you review before they're applied.
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-left text-[12px] text-ink-2 hover:border-[var(--accent)] hover:text-ink transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={cx('flex flex-col gap-2', turn.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              className={cx(
                'max-w-[92%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap',
                turn.role === 'user'
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'bg-[var(--surface-2)] border border-[var(--line)] text-ink',
              )}
            >
              {turn.content}
            </div>

            {turn.reply && turn.reply.actions.length > 0 && (
              <div className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
                    Proposed changes · {turn.reply.actions.length}
                  </span>
                  {turn.reply.preview && (
                    <span className="font-mono text-[11px]">
                      errors{' '}
                      <span className="text-ink-2">{turn.reply.preview.errorsBefore}</span>
                      <span className="text-ink-3"> → </span>
                      <span
                        style={{
                          color:
                            turn.reply.preview.errorsAfter < turn.reply.preview.errorsBefore
                              ? 'var(--ok)'
                              : turn.reply.preview.errorsAfter > turn.reply.preview.errorsBefore
                              ? 'var(--danger)'
                              : 'var(--ink-2)',
                        }}
                      >
                        {turn.reply.preview.errorsAfter}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  {turn.reply.actions.map((a, j) => {
                    const tone = toneVars(codeById.get(a.code)?.tone ?? 'off');
                    return (
                      <div key={j} className="flex items-center gap-2 text-[12px]">
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold shrink-0"
                          style={{ background: tone.bg, color: tone.fg }}
                        >
                          {a.code}
                        </span>
                        <span className="truncate">
                          {nameOf(a.employeeId)} · day {a.dayIndex + 1}
                        </span>
                        {a.reason && <span className="ml-auto text-[11px] text-ink-3 truncate max-w-[45%]">{a.reason}</span>}
                      </div>
                    );
                  })}
                </div>

                {turn.reply.preview && turn.reply.preview.rejected.length > 0 && (
                  <p className="text-[11px] text-[var(--warn)]">
                    {turn.reply.preview.rejected.length} suggestion
                    {turn.reply.preview.rejected.length === 1 ? ' was' : 's were'} dropped (
                    {turn.reply.preview.rejected.map((r) => r.why).join(', ')}).
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  {turn.applied ? (
                    <span className="text-[11.5px] text-[var(--ok)]">✓ Applied</span>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => apply(i, turn.reply!.actions)}>
                      Apply to roster
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-[12px] text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="border-t border-[var(--line)] p-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this month…"
          disabled={busy}
          className="h-9 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-ink placeholder:text-ink-3 focus:border-[var(--accent)] focus:outline-none"
        />
        <Button variant="primary" size="md" type="submit" disabled={busy || !input.trim()}>
          Ask
        </Button>
      </form>
    </div>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      <p className="mt-1 text-[12px] text-ink-3 leading-relaxed">{children}</p>
    </div>
  );
}
