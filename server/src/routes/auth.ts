import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireSupervisor, signToken, verifyPassword } from '../auth.ts';
import { audit } from '../audit.ts';
import { User } from '../models.ts';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Email and password are required.' });

  const user = await verifyPassword(body.data.email, body.data.password);
  if (!user) return res.status(401).json({ error: 'Wrong email or password.' });

  res.json({ token: signToken(user), user });
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

/** Supervisors can invite further users. */
authRouter.post('/users', requireAuth, requireSupervisor, async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional(),
      role: z.enum(['supervisor', 'viewer']).default('viewer'),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Valid email, a password of 8+ characters and a role are required.' });

  if (await User.findOne({ email: body.data.email.toLowerCase() })) {
    return res.status(409).json({ error: 'That email already has an account.' });
  }
  const user = await User.create({
    email: body.data.email,
    passwordHash: await bcrypt.hash(body.data.password, 10),
    name: body.data.name ?? '',
    role: body.data.role,
  });
  audit(req, 'user.create', user.email, undefined, { role: user.role });
  res.status(201).json({ id: String(user._id), email: user.email, role: user.role });
});

authRouter.get('/users', requireAuth, requireSupervisor, async (_req, res) => {
  const users = await User.find().select('email name role createdAt');
  res.json(users.map((u) => ({ id: String(u._id), email: u.email, name: u.name, role: u.role })));
});
