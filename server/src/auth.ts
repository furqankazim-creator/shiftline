import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { config } from './config.ts';
import { User } from './models.ts';

export interface AuthUser {
  id: string;
  email: string;
  role: 'supervisor' | 'viewer';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '30d' });
}

/** Rejects requests without a valid bearer token. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in required.' });
  try {
    req.user = jwt.verify(token, config.jwtSecret) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired — sign in again.' });
  }
}

/** Viewers can read; only supervisors can change anything. */
export function requireSupervisor(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'supervisor') {
    return res.status(403).json({ error: 'Only a supervisor can make changes.' });
  }
  next();
}

export async function verifyPassword(email: string, password: string): Promise<AuthUser | null> {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { id: String(user._id), email: user.email, role: user.role as AuthUser['role'] };
}

/** Creates the first supervisor from .env when the users collection is empty. */
export async function seedAdmin(): Promise<void> {
  if (await User.countDocuments()) return;
  if (!config.adminEmail || !config.adminPassword) {
    console.warn('No users exist and ADMIN_EMAIL / ADMIN_PASSWORD are not set — nobody can sign in.');
    return;
  }
  await User.create({
    email: config.adminEmail,
    passwordHash: await bcrypt.hash(config.adminPassword, 10),
    name: 'Supervisor',
    role: 'supervisor',
  });
  console.log(`Created supervisor account ${config.adminEmail}`);
}
