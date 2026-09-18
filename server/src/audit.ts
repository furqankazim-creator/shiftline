import type { Request } from 'express';

import { Audit } from './models.ts';

/** Fire-and-forget audit entry; never blocks the response. */
export function audit(req: Request, action: string, target: string, before?: unknown, after?: unknown) {
  void Audit.create({
    userId: req.user?.id,
    userEmail: req.user?.email,
    action,
    target,
    before,
    after,
  }).catch((e) => console.error('audit write failed', e));
}
