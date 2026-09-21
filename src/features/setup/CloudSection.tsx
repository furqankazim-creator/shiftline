import { useState } from 'react';

import { API_URL, cloudEnabled, getUser, pullAll, pushAll, signIn, signOut } from '@/app/api';
import { Button, Field, Input, Modal, useToast } from '@/components/ui';
import { exportBackup, importBackup } from '@/data/db';

/**
 * Cloud: sign in to the ShiftLine server and move the whole dataset up or down.
 *
 * Push/pull of the full backup is deliberately simple — it gives the client
 * cross-device sharing today without changing how the app stores data.
 */
export function CloudSection() {
  const toast = useToast();
  const [user, setUser] = useState(getUser());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'in' | 'push' | 'pull' | null>(null);
  const [confirmPull, setConfirmPull] = useState(false);

  if (!cloudEnabled()) {
    return (
      <div className="bg-[var(--surface)] px-4 py-4 text-[12.5px] text-ink-3 leading-relaxed">
        This copy of the app has no server address, so it runs entirely in this browser — no sharing, no
        assistant. To connect one: run the API (<code className="font-mono">cd server &amp;&amp; npm run dev</code>)
        and start the app with <code className="font-mono">VITE_API_URL</code> pointing at it — for local work that is
        already set in <code className="font-mono">.env.development</code>; on Vercel add it under Environment Variables.
      </div>
    );
  }

  const doSignIn = async () => {
    setBusy('in');
    try {
      const u = await signIn(email, password);
      setUser(u);
      setPassword('');
      toast(`Signed in as ${u.email}.`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sign-in failed.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const doPush = async () => {
    setBusy('push');
    try {
      const r = await pushAll(await exportBackup());
      toast(`Pushed ${r.employees} people and ${r.rosters} months to the server.`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Push failed.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const doPull = async () => {
    setBusy('pull');
    try {
      const data = await pullAll();
      await importBackup(JSON.stringify(data));
      toast('Pulled the server copy. Reloading…', 'ok');
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Pull failed.', 'error');
      setBusy(null);
    }
  };

  return (
    <div className="bg-[var(--surface)] px-4 py-4 flex flex-col gap-4">
      <p className="text-[11.5px] text-ink-3">
        Server: <code className="font-mono text-ink-2">{API_URL}</code>
      </p>

      {!user ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doSignIn();
          }}
          className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end"
        >
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Button variant="primary" type="submit" disabled={busy === 'in' || !email || !password}>
            {busy === 'in' ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px]">
              Signed in as <b>{user.email}</b>{' '}
              <span className="rounded bg-[var(--surface-3)] px-1.5 py-px text-[10px] uppercase tracking-wide text-ink-3">
                {user.role}
              </span>
            </span>
            <Button
              size="sm"
              onClick={() => {
                signOut();
                setUser(null);
              }}
            >
              Sign out
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={doPush} disabled={busy !== null || user.role !== 'supervisor'}>
              {busy === 'push' ? 'Pushing…' : 'Push this browser → server'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmPull(true)} disabled={busy !== null}>
              {busy === 'pull' ? 'Pulling…' : 'Pull server → this browser'}
            </Button>
          </div>

          <div className="rounded-lg bg-[var(--surface-2)] p-3 text-[12px] text-ink-3 leading-relaxed border border-[var(--line)]">
            <p className="font-semibold text-ink-2 mb-1">How sharing works</p>
            <p>
              <b>Push</b> copies everything in this browser to the server. <b>Pull</b> replaces what is in this
              browser with the server copy. Push after you finish a month; pull when you sit down at another
              computer. Viewers can pull but not push.
            </p>
          </div>
        </>
      )}

      <Modal
        open={confirmPull}
        onClose={() => setConfirmPull(false)}
        title="Replace this browser's data with the server copy?"
        description="Anything here that has not been pushed will be lost."
        width={420}
        footer={
          <>
            <Button onClick={() => setConfirmPull(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmPull(false);
                void doPull();
              }}
            >
              Pull
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] text-ink-2">Press Push first if you have changes here you want to keep.</p>
      </Modal>
    </div>
  );
}
