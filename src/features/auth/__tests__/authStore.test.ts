import { describe, expect, it } from 'vitest';

import type { LoginNotification, SecuritySettings, UserSession } from '../types';

describe('Auth & Protected Access Logic', () => {
  const defaultSettings: SecuritySettings = {
    sharedPasscode: 'shiftline2026',
    adminPassword: 'supervisor1',
    requireName: true,
    notifyOnLogin: true,
    soundAlert: true,
    defaultSharedRole: 'collaborator',
  };

  it('validates correct shared passcode and rejects incorrect passcode', () => {
    const inputPasscode = 'shiftline2026';
    const wrongPasscode = 'invalid123';

    expect(inputPasscode.trim() === defaultSettings.sharedPasscode).toBe(true);
    expect(wrongPasscode.trim() === defaultSettings.sharedPasscode).toBe(false);
  });

  it('creates valid user session on successful login with name and device info', () => {
    const userName = 'Hasnain';
    const passcode = 'shiftline2026';

    const session: UserSession = {
      id: 'sess-123',
      name: userName,
      role: 'collaborator',
      loginTime: Date.now(),
      passcodeUsed: passcode,
      device: 'Desktop Browser',
    };

    expect(session.name).toBe('Hasnain');
    expect(session.role).toBe('collaborator');
    expect(session.passcodeUsed).toBe('shiftline2026');
  });

  it('creates a formatted login notification for the supervisor alert feed', () => {
    const userName = 'Hasnain';
    const notif: LoginNotification = {
      id: 'notif-1',
      type: 'login',
      userName,
      userRole: 'collaborator',
      timestamp: Date.now(),
      message: `${userName} logged in via shared link`,
      details: 'Access granted with passcode. Device: Desktop Browser.',
      read: false,
    };

    expect(notif.message).toContain('Hasnain logged in via shared link');
    expect(notif.read).toBe(false);
    expect(notif.type).toBe('login');
  });

  it('computes unread notification count correctly', () => {
    const notifs: LoginNotification[] = [
      { id: '1', type: 'login', userName: 'Hasnain', userRole: 'collaborator', timestamp: Date.now(), message: 'login 1', read: false },
      { id: '2', type: 'login', userName: 'Karim', userRole: 'viewer', timestamp: Date.now(), message: 'login 2', read: false },
      { id: '3', type: 'security', userName: 'System', userRole: 'supervisor', timestamp: Date.now(), message: 'alert', read: true },
    ];

    const unread = notifs.filter((n) => !n.read).length;
    expect(unread).toBe(2);
  });

  it('validates dynamic generated passcodes like shift-8255 and handles case-insensitivity', () => {
    const updatedSettings: SecuritySettings = {
      ...defaultSettings,
      sharedPasscode: 'shift-8255',
      recentPasscodes: ['shift-8255', 'shiftline2026'],
    };

    const inputLower = 'shift-8255';
    const inputUpper = 'SHIFT-8255';
    const defaultFallback = 'shiftline2026';
    const wrongCode = 'wrong-0000';

    const isValid = (code: string) => {
      const c = code.trim().toLowerCase();
      return (
        c === updatedSettings.sharedPasscode.toLowerCase() ||
        c === defaultSettings.sharedPasscode.toLowerCase() ||
        (updatedSettings.recentPasscodes || []).map((p) => p.toLowerCase()).includes(c)
      );
    };

    expect(isValid(inputLower)).toBe(true);
    expect(isValid(inputUpper)).toBe(true);
    expect(isValid(defaultFallback)).toBe(true);
    expect(isValid(wrongCode)).toBe(false);
  });

  it('creates formatted logout notification when collaborator logs out', () => {
    const userName = 'Arif';
    const notif: LoginNotification = {
      id: 'notif-logout-1',
      type: 'logout',
      userName,
      userRole: 'collaborator',
      timestamp: Date.now(),
      message: `${userName} logged out of roster`,
      details: 'Session ended (collaborator).',
      read: false,
    };

    expect(notif.type).toBe('logout');
    expect(notif.message).toBe('Arif logged out of roster');
    expect(notif.userName).toBe('Arif');
  });

  it('deduplicates active users by name so multiple tab sessions show cleanly', () => {
    const registry = [
      { id: 'sess-1', name: 'Arif', role: 'collaborator', status: 'online', lastActive: Date.now() },
      { id: 'sess-2', name: 'arif', role: 'collaborator', status: 'online', lastActive: Date.now() - 1000 },
      { id: 'sess-3', name: 'Hasnain', role: 'collaborator', status: 'online', lastActive: Date.now() },
    ];

    const seenNames = new Set<string>();
    const uniqueOnline = registry.filter((u) => {
      const norm = u.name.trim().toLowerCase();
      if (seenNames.has(norm)) return false;
      seenNames.add(norm);
      return true;
    });

    expect(uniqueOnline.length).toBe(2);
    expect(uniqueOnline.map((u) => u.name)).toEqual(['Arif', 'Hasnain']);
  });
});

