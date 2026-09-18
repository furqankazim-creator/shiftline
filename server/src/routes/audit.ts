import { Router } from 'express';

import { requireAuth } from '../auth.ts';
import { Audit } from '../models.ts';

export const auditRouter = Router();
auditRouter.use(requireAuth);

auditRouter.get('/', async (req, res) => {
  const limit = Math.min(500, Number(req.query.limit ?? 100));
  const rows = await Audit.find().sort({ createdAt: -1 }).limit(limit).lean();
  res.json(rows.map((r) => ({
    at: r.createdAt, by: r.userEmail, action: r.action, target: r.target, before: r.before, after: r.after,
  })));
});
