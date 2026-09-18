/**
 * Thin client for the ShiftLine API (server/).
 *
 * The web app stays local-first: nothing here is required for it to work.
 * When VITE_API_URL is set and the supervisor has signed in, the app can push
 * and pull its whole dataset to the shared database and ask the assistant.
 */

const TOKEN_KEY = 'shiftline.token';
const USER_KEY = 'shiftline.user';

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const cloudEnabled = () => API_URL.length > 0;

export interface CloudUser {
  id: string;
  email: string;
  role: 'supervisor' | 'viewer';
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUser(): CloudUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as CloudUser) : null;
  } catch {
    return null;
  }
}

export function signOut() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!cloudEnabled()) throw new Error('No API URL configured (VITE_API_URL).');
  const token = getToken();
  const res = await fetch(API_URL + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export async function signIn(email: string, password: string): Promise<CloudUser> {
  const { token, user } = await call<{ token: string; user: CloudUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

/** Server capabilities, so the chat can skip sign-in when the server allows it. */
export const health = () =>
  fetch(API_URL + '/health').then((r) => r.json() as Promise<{ ok: boolean; ai: boolean; aiPublic: boolean }>);

export const pushAll = (backupJson: string) =>
  call<{ ok: true; employees: number; rosters: number }>('/sync', { method: 'POST', body: backupJson });

export const pullAll = () => call<Record<string, unknown>>('/sync');

export interface AiAction {
  employeeId: string;
  dayIndex: number;
  code: string;
  reason?: string;
}

export interface AiReply {
  answer: string;
  actions: AiAction[];
  preview: {
    errorsBefore: number;
    errorsAfter: number;
    warningsBefore: number;
    warningsAfter: number;
    rejected: { action: AiAction; why: string }[];
  } | null;
}

export const askAssistant = (payload: {
  lineId: string;
  year: number;
  month: number;
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  context: unknown;
}) => call<AiReply>('/ai/ask', { method: 'POST', body: JSON.stringify(payload) });
