import { useEffect, useState } from 'react';

import { Button, Input, Modal, useToast } from '@/components/ui';

import { useAuth } from './authStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShareSecurityModal({ open, onClose }: Props) {
  const { session, securitySettings, updateSecuritySettings } = useAuth();
  const toast = useToast();

  const [passcode, setPasscode] = useState(securitySettings.sharedPasscode);
  const [notifyOnLogin, setNotifyOnLogin] = useState(securitySettings.notifyOnLogin);
  const [soundAlert, setSoundAlert] = useState(securitySettings.soundAlert);
  const [requireName, setRequireName] = useState(securitySettings.requireName);

  if (session?.role !== 'supervisor') {
    return null;
  }

  // Sync local input with store when changed externally
  useEffect(() => {
    setPasscode(securitySettings.sharedPasscode);
  }, [securitySettings.sharedPasscode]);

  const shareUrlWithCode = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?code=${encodeURIComponent(passcode.trim() || 'shiftline2026')}#/app`
    : `https://shiftline.app/?code=${encodeURIComponent(passcode.trim() || 'shiftline2026')}#/app`;

  const handleCopyLinkOnly = async () => {
    const cleanCode = passcode.trim() || 'shiftline2026';
    updateSecuritySettings({ sharedPasscode: cleanCode });
    try {
      await navigator.clipboard.writeText(shareUrlWithCode);
      toast('Protected roster link copied to clipboard!', 'ok');
    } catch {
      toast('Could not copy link to clipboard.', 'error');
    }
  };

  const handleCopyFullInvite = async () => {
    const cleanCode = passcode.trim() || 'shiftline2026';
    updateSecuritySettings({ sharedPasscode: cleanCode });
    const inviteText = `ShiftLine Protected Roster:
Link: ${shareUrlWithCode}
Access Passcode: ${cleanCode}
(Enter your name and this passcode to open the schedule)`;

    try {
      await navigator.clipboard.writeText(inviteText);
      toast('Full invite (Link + Passcode) copied to clipboard!', 'ok');
    } catch {
      toast('Could not copy to clipboard.', 'error');
    }
  };

  const handleGenerateNew = () => {
    const newCode = `shift-${Math.floor(1000 + Math.random() * 9000)}`;
    setPasscode(newCode);
    updateSecuritySettings({ sharedPasscode: newCode });
    toast(`Generated & activated new passcode: ${newCode}`, 'ok');
  };

  const handlePasscodeChange = (newVal: string) => {
    setPasscode(newVal);
    const clean = newVal.trim();
    if (clean) {
      updateSecuritySettings({ sharedPasscode: clean });
    }
  };

  const handleSaveSettings = () => {
    const cleanPasscode = passcode.trim() || 'shiftline2026';
    updateSecuritySettings({
      sharedPasscode: cleanPasscode,
      notifyOnLogin,
      soundAlert,
      requireName,
    });
    toast('Security and passcode settings saved!', 'ok');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share Link & Access Security"
      description="Manage password-protected link access, customize team passcodes, and configure instant login alerts."
      width={560}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveSettings}>
            Save Security Settings
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-ink text-xs">
        {/* Protected Link Card */}
        <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink-2 uppercase tracking-wider text-[11px]">
              🔒 Protected Roster Link
            </span>
            <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-500/15 text-emerald-400">
              Password-Protected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="text"
              readOnly
              value={shareUrlWithCode}
              className="bg-[var(--surface-3)] font-mono text-xs select-all text-ink-2"
            />
            <Button variant="outline" size="sm" onClick={handleCopyLinkOnly} className="shrink-0">
              Copy Link
            </Button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-ink-3">
              Recipients cannot open this link without your passcode.
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCopyFullInvite}
              className="text-xs h-7 px-2.5 font-bold"
            >
              📋 Copy Link + Passcode Invite
            </Button>
          </div>
        </div>

        {/* Access Passcode Configuration */}
        <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-ink text-xs block">Shared Access Passcode</span>
              <span className="text-[11px] text-ink-3 block">
                Give this password to staff, Hasnain, or clients so they can open the roster.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={passcode}
              onChange={(e) => handlePasscodeChange(e.target.value)}
              placeholder="Enter passcode, e.g. shiftline2026"
              className="bg-[var(--surface-3)] font-mono font-bold text-xs"
            />
            <button
              type="button"
              onClick={handleGenerateNew}
              className="shrink-0 px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-3)] text-ink-2 hover:text-ink text-[11px] transition-colors"
            >
              Generate New
            </button>
          </div>
        </div>

        {/* Login Notification & Security Policies */}
        <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 space-y-3">
          <span className="font-semibold text-ink text-xs block">
            Login Alerts &amp; Notification Rules
          </span>

          <div className="space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnLogin}
                onChange={(e) => setNotifyOnLogin(e.target.checked)}
                className="mt-0.5 rounded border-[var(--line)] text-[var(--accent)]"
              />
              <div>
                <span className="font-medium text-ink block text-[11.5px]">
                  Send live notification when someone logs in
                </span>
                <span className="text-[10.5px] text-ink-3 block">
                  Dispatches an instant alert with the person&apos;s name when they open your link.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={soundAlert}
                onChange={(e) => setSoundAlert(e.target.checked)}
                className="mt-0.5 rounded border-[var(--line)] text-[var(--accent)]"
              />
              <div>
                <span className="font-medium text-ink block text-[11.5px]">
                  Play audio chime alert on login
                </span>
                <span className="text-[10.5px] text-ink-3 block">
                  Plays a subtle bell tone whenever a team member or client unlocks the roster.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={requireName}
                onChange={(e) => setRequireName(e.target.checked)}
                className="mt-0.5 rounded border-[var(--line)] text-[var(--accent)]"
              />
              <div>
                <span className="font-medium text-ink block text-[11.5px]">
                  Require name before unlocking
                </span>
                <span className="text-[10.5px] text-ink-3 block">
                  Ensures you always know exactly who opened the shared link.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
