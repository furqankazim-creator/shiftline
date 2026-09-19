import { useState } from 'react';

import { Button, Field, Input, useToast } from '@/components/ui';

import { GROQ_MODEL, getGroqKey, setGroqKey } from '@/features/assistant/direct';

/**
 * Assistant: a Groq API key kept in this browser so the chat works without
 * the ShiftLine server. When a server is reachable the chat prefers it; the
 * key is the fallback that makes the assistant available anywhere.
 */
export function AssistantSection() {
  const toast = useToast();
  const [saved, setSaved] = useState(() => getGroqKey());
  const [draft, setDraft] = useState('');

  const save = () => {
    setGroqKey(draft);
    setSaved(draft.trim());
    setDraft('');
    toast('Groq key saved to this browser.', 'ok');
  };

  const clear = () => {
    setGroqKey('');
    setSaved('');
    toast('Groq key removed.', 'ok');
  };

  const masked = saved ? `${saved.slice(0, 7)}…${saved.slice(-4)}` : '';

  return (
    <div className="bg-[var(--surface)] px-4 py-4 flex flex-col gap-4">
      <p className="text-[12.5px] text-ink-3 leading-relaxed">
        Paste a free key from{' '}
        <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline text-ink-2">
          console.groq.com/keys
        </a>
        . The chat then calls Groq (<code className="font-mono">{GROQ_MODEL}</code>) directly from this browser,
        with the same rules and change-preview as the server. The key is stored only on this device — it is never
        sent anywhere except Groq — so use your own key, not one you share.
      </p>

      {saved && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px]">
            Key saved: <code className="font-mono text-ink-2">{masked}</code>
          </span>
          <Button size="sm" onClick={clear}>
            Remove
          </Button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end"
      >
        <Field label={saved ? 'Replace key' : 'Groq API key'}>
          <Input type="password" autoComplete="off" placeholder="gsk_…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </Field>
        <Button variant="primary" type="submit" disabled={!draft.trim()}>
          Save
        </Button>
      </form>
    </div>
  );
}
