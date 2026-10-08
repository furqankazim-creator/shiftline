import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { Button, Input, cx } from '@/components/ui';

import { useAuth } from './authStore';

interface Props {
  onBackToHome?: () => void;
}

export function LoginGate({ onBackToHome }: Props) {
  const { loginWithPasscode, loginAsAdmin, securitySettings } = useAuth();

  const [mode, setMode] = useState<'passcode' | 'admin'>('passcode');
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPasscode = passcode.trim();
    const cleanName = name.trim();

    if (!cleanPasscode) {
      setError('Please enter the access passcode provided by your supervisor.');
      return;
    }

    if (securitySettings.requireName && !cleanName) {
      setError('Please enter your name so the supervisor knows who opened the roster.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const ok = loginWithPasscode(cleanName || 'Team Member', cleanPasscode);
      setIsSubmitting(false);
      if (!ok) {
        setError('Incorrect passcode. Please check with your supervisor.');
      }
    }, 250);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!adminPassword.trim()) {
      setError('Please enter the supervisor master password.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const ok = loginAsAdmin(adminPassword.trim());
      setIsSubmitting(false);
      if (!ok) {
        setError('Invalid supervisor password.');
      }
    }, 250);
  };

  // Auto-detect passcode and assigned recipient name from URL param if opened via link
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      let codeFromUrl = urlParams.get('code') || urlParams.get('passcode') || urlParams.get('p');
      let nameFromUrl = urlParams.get('user') || urlParams.get('name') || urlParams.get('u');
      if ((!codeFromUrl || !nameFromUrl) && window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1];
        if (hashQuery) {
          const hashParams = new URLSearchParams(hashQuery);
          if (!codeFromUrl) {
            codeFromUrl = hashParams.get('code') || hashParams.get('passcode') || hashParams.get('p');
          }
          if (!nameFromUrl) {
            nameFromUrl = hashParams.get('user') || hashParams.get('name') || hashParams.get('u');
          }
        }
      }
      if (codeFromUrl) {
        const clean = decodeURIComponent(codeFromUrl).trim();
        if (clean) {
          setPasscode(clean);
        }
      }
      if (nameFromUrl) {
        const cleanName = decodeURIComponent(nameFromUrl).trim();
        if (cleanName) {
          setName(cleanName);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);


  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[var(--canvas)] overflow-hidden select-none font-sans">
      {/* Background ambient aurora and geometric patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-indigo-500/12 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[420px] h-[320px] bg-blue-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-10 left-10 w-[380px] h-[280px] bg-emerald-500/8 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative w-full max-w-[440px] rounded-3xl border border-[var(--line-strong)] bg-[var(--surface)]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl space-y-6"
      >
        {/* Brand & Security Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-[var(--surface-3)] to-blue-500/20 border border-[var(--line-strong)] shadow-inner mb-0.5">
            <span className="text-2xl" role="img" aria-label="Shield">
              🛡️
            </span>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--surface-3)] border border-[var(--line)] text-[11px] font-semibold text-ink-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ShiftLine Protected Roster</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
              Protected Workspace
            </h1>
          </div>

          <p className="text-xs text-ink-3 max-w-xs mx-auto leading-relaxed">
            Access to this scheduling link requires verification. Sign in as a team member or supervisor to unlock.
          </p>
        </div>

        {/* Tab switcher: Team Member vs Supervisor Login */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('passcode');
              setError(null);
            }}
            className={cx(
              'py-2 px-3 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5',
              mode === 'passcode'
                ? 'bg-[var(--surface)] text-ink shadow-sm font-bold border border-[var(--line)]'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            <span className="flex items-center gap-1.5 text-xs">
              <span>👥</span> Team Member
            </span>
            <span className="text-[10px] font-normal text-ink-3">Collaborator / Staff</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('admin');
              setError(null);
            }}
            className={cx(
              'py-2 px-3 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5',
              mode === 'admin'
                ? 'bg-[var(--surface)] text-ink shadow-sm font-bold border border-[var(--line)]'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            <span className="flex items-center gap-1.5 text-xs">
              <span>🛡️</span> Supervisor
            </span>
            <span className="text-[10px] font-normal text-ink-3">Admin &amp; Sharing</span>
          </button>
        </div>

        {/* Error message banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5"
          >
            <span className="text-sm">⚠️</span>
            <span className="font-medium">{error}</span>
          </motion.div>
        )}

        {/* Mode: Shared Passcode Access */}
        {mode === 'passcode' ? (
          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-2 flex items-center justify-between">
                <span>Your Full Name / Call-Sign</span>
                <span className="text-[10.5px] text-rose-400 font-normal">Required</span>
              </label>
              <div className="relative">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Arif"
                  required={securitySettings.requireName}
                  autoFocus
                  className="bg-[var(--surface-2)] text-xs h-10 px-3 pl-8 rounded-xl font-medium"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50">👤</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10.5px] text-ink-3 pt-0.5">
                <span className="text-emerald-400">🔔</span>
                <span>The supervisor receives an instant alert: &ldquo;{name.trim() || 'Team Member'} logged in&rdquo;.</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-ink-2">
                    Roster Passcode
                  </label>
                  {passcode && (
                    <span className="text-[10px] text-emerald-400 font-semibold px-1 rounded bg-emerald-500/10">
                      ✓ Ready
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-[var(--accent)] hover:underline font-medium"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter shared passcode"
                  required
                  className="bg-[var(--surface-2)] text-xs h-10 px-3 pl-8 rounded-xl font-mono tracking-wide"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50">🔒</span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full py-2.5 h-11 text-xs font-bold rounded-xl mt-3 shadow-lg shadow-indigo-500/20"
            >
              {isSubmitting ? 'Verifying Credentials…' : 'Unlock & Open Roster →'}
            </Button>
          </form>
        ) : (
          /* Mode: Supervisor Sign In */
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink-2">
                  Supervisor Master Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-[var(--accent)] hover:underline font-medium"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter supervisor password"
                  required
                  autoFocus
                  className="bg-[var(--surface-2)] text-xs h-10 px-3 pl-8 rounded-xl font-mono tracking-wide"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50">🔑</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10.5px] text-ink-3 pt-0.5">
                <span className="text-amber-400">🛡️</span>
                <span>Unlocks Link Sharing, Login Alerts Drawer &amp; Active Member Monitor.</span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full py-2.5 h-11 text-xs font-bold rounded-xl mt-3 shadow-lg shadow-amber-500/15"
            >
              {isSubmitting ? 'Authenticating Supervisor…' : 'Sign In as Supervisor →'}
            </Button>
          </form>
        )}


        {/* Footer info & Navigation */}
        <div className="flex items-center justify-between text-[11px] text-ink-3 pt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Multi-User Sync Active</span>
          </span>
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="text-ink-2 hover:text-ink hover:underline font-medium"
            >
              ← Back to Overview
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

