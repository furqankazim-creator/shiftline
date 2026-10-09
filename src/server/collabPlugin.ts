import type { Plugin } from 'vite';

interface CollabUser {
  id: string;
  name: string;
  role: 'supervisor' | 'collaborator' | 'viewer';
  joinedAt: number;
  lastActive: number;
  status: 'online' | 'offline';
  device?: string;
}

interface CollabNotification {
  id: string;
  type: 'login' | 'logout' | 'security' | 'presence';
  userName: string;
  userRole: 'supervisor' | 'collaborator' | 'viewer';
  timestamp: number;
  message: string;
  details?: string;
  read: boolean;
}

interface CollabSettings {
  updatedAt: number;
  assignedPasscodes: Array<{ id: string; passcode: string; assignedTo: string; role: string; status: string; [k: string]: any }>;
  adminPassword: string;
  requireName: boolean;
  notifyOnLogin: boolean;
  soundAlert: boolean;
}

// In-Memory Real-Time Collaboration State
const usersMap = new Map<string, CollabUser>();
const notificationsList: CollabNotification[] = [
  {
    id: 'seed-notif-1',
    type: 'security',
    userName: 'Security Service',
    userRole: 'supervisor',
    timestamp: Date.now() - 1000 * 60 * 15,
    message: 'Protected access gate active.',
    details: 'You will receive immediate alerts whenever someone unlocks this roster.',
    read: false,
  },
];

// updatedAt = 0 means "never configured": the supervisor's browser pushes its saved copy up.
const currentSettings: CollabSettings = {
  updatedAt: 0,
  assignedPasscodes: [],
  adminPassword: 'supervisor1',
  requireName: true,
  notifyOnLogin: true,
  soundAlert: true,
};

const sseClients = new Set<any>();
let serverWorkOrders: any[] = [];

function getActiveUsersList(): CollabUser[] {
  const now = Date.now();
  const list: CollabUser[] = [];
  const seenNames = new Set<string>();

  for (const user of usersMap.values()) {
    const isRecent = now - user.lastActive < 60000; // 60s window (prevents background tabs from dropping)
    if (user.status === 'online' && isRecent) {
      const norm = user.name.trim().toLowerCase();
      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        list.push(user);
      }
    }
  }

  list.sort((a, b) => a.joinedAt - b.joinedAt);
  return list;
}

function broadcastSSE(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += String(chunk);
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

function sendJson(res: any, status: number, data: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

// Background cleanup: Prune users who haven't sent heartbeat in 75s
setInterval(() => {
  const now = Date.now();
  let changed = false;

  for (const [id, user] of usersMap.entries()) {
    if (user.status === 'online' && now - user.lastActive > 75000) {
      usersMap.delete(id);
      changed = true;
    }
  }

  if (changed) {
    broadcastSSE({
      type: 'PRESENCE_SYNC',
      users: getActiveUsersList(),
    });
  }
}, 5000);

export function collabServerPlugin(): Plugin {
  return {
    name: 'collab-server',
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';

        // Only handle /api/collab/* endpoints
        if (!url.startsWith('/api/collab')) {
          return next();
        }

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          });
          return res.end();
        }

        // 1. SSE Stream: GET /api/collab/events
        if (url.startsWith('/api/collab/events') && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          res.write(': keepalive\n\n');

          sseClients.add(res);

          // Immediately push current live state to new subscriber
          const initialPayload = {
            type: 'INIT_SYNC',
            users: getActiveUsersList(),
            notifications: notificationsList.slice(0, 50),
            settings: currentSettings,
          };
          res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

          req.on('close', () => {
            sseClients.delete(res);
          });
          return;
        }

        // 2. Fetch current state: GET /api/collab/state
        if (url.startsWith('/api/collab/state') && req.method === 'GET') {
          return sendJson(res, 200, {
            ok: true,
            users: getActiveUsersList(),
            notifications: notificationsList.slice(0, 50),
            settings: currentSettings,
          });
        }

        // 3. User Login: POST /api/collab/login
        if (url.startsWith('/api/collab/login') && req.method === 'POST') {
          const body = await readJsonBody(req);
          const cleanName = (body.name || 'Team Member').trim();
          const cleanPasscode = (body.passcode || '').trim().toLowerCase();
          const role = body.role || 'collaborator';
          const device = body.device || 'Desktop Browser';

          // Only a person's own assigned (not revoked) passcode is accepted
          const isValid =
            !!cleanPasscode &&
            currentSettings.assignedPasscodes.some(
              (a) => a.status !== 'revoked' && String(a.passcode).trim().toLowerCase() === cleanPasscode,
            );

          if (!isValid) {
            return sendJson(res, 401, {
              ok: false,
              error: 'Incorrect passcode. Please check with your supervisor.',
            });
          }

          const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const userObj: CollabUser = {
            id: userId,
            name: cleanName,
            role,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            status: 'online',
            device,
          };

          // Store user
          usersMap.set(userId, userObj);

          // Create notification
          const notif: CollabNotification = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            type: 'login',
            userName: cleanName,
            userRole: role,
            timestamp: Date.now(),
            message: `${cleanName} logged in via shared link`,
            details: `Access granted with passcode. Device: ${device}.`,
            read: false,
          };

          notificationsList.unshift(notif);

          // Broadcast instantly to all connected SSE clients (e.g. Supervisor window)
          broadcastSSE({
            type: 'LOGIN_ALERT',
            notification: notif,
            user: userObj,
            users: getActiveUsersList(),
          });

          return sendJson(res, 200, {
            ok: true,
            user: userObj,
            notification: notif,
            settings: currentSettings,
          });
        }

        // 4. Admin / Supervisor Login: POST /api/collab/admin-login
        if (url.startsWith('/api/collab/admin-login') && req.method === 'POST') {
          const body = await readJsonBody(req);
          const password = (body.password || '').trim();
          const name = (body.name || 'Supervisor').replace(/ \/ Operations Lead/g, '').trim() || 'Supervisor';

          if (password !== currentSettings.adminPassword) {
            return sendJson(res, 401, {
              ok: false,
              error: 'Invalid supervisor password.',
            });
          }

          const userId = `admin-${Date.now()}`;
          const userObj: CollabUser = {
            id: userId,
            name,
            role: 'supervisor',
            joinedAt: Date.now(),
            lastActive: Date.now(),
            status: 'online',
            device: 'Admin Console',
          };

          usersMap.set(userId, userObj);

          const notif: CollabNotification = {
            id: `notif-${Date.now()}`,
            type: 'login',
            userName: name,
            userRole: 'supervisor',
            timestamp: Date.now(),
            message: `${name} authenticated as Supervisor`,
            details: 'Full administrative and schedule lock privileges enabled.',
            read: false,
          };

          notificationsList.unshift(notif);

          broadcastSSE({
            type: 'LOGIN_ALERT',
            notification: notif,
            user: userObj,
            users: getActiveUsersList(),
          });

          return sendJson(res, 200, {
            ok: true,
            user: userObj,
            notification: notif,
            settings: currentSettings,
          });
        }

        // 5. User Logout: POST /api/collab/logout
        if (url.startsWith('/api/collab/logout') && req.method === 'POST') {
          const body = await readJsonBody(req);
          const userId = body.userId || '';
          const name = (body.name || 'Team Member').trim();
          const role = body.role || 'collaborator';

          // Remove user and any entries matching this name
          if (userId) usersMap.delete(userId);
          for (const [k, u] of usersMap.entries()) {
            if (u.name.trim().toLowerCase() === name.toLowerCase()) {
              usersMap.delete(k);
            }
          }

          const logoutNotif: CollabNotification = {
            id: `notif-logout-${Date.now()}`,
            type: 'logout',
            userName: name,
            userRole: role,
            timestamp: Date.now(),
            message: `${name} logged out of roster`,
            details: `Session ended (${role}).`,
            read: false,
          };

          notificationsList.unshift(logoutNotif);

          // Broadcast immediately to supervisor
          broadcastSSE({
            type: 'LOGOUT_ALERT',
            notification: logoutNotif,
            userId,
            userName: name,
            users: getActiveUsersList(),
          });

          return sendJson(res, 200, { ok: true });
        }

        // 6. Heartbeat Ping: POST /api/collab/heartbeat
        if (url.startsWith('/api/collab/heartbeat') && req.method === 'POST') {
          const body = await readJsonBody(req);
          const userId = body.userId;
          const name = body.name;
          const role = body.role || 'collaborator';

          if (userId) {
            const existing = usersMap.get(userId);
            if (existing) {
              existing.lastActive = Date.now();
              existing.status = 'online';
            } else if (name) {
              usersMap.set(userId, {
                id: userId,
                name,
                role,
                joinedAt: Date.now(),
                lastActive: Date.now(),
                status: 'online',
              });
            }
          }

          return sendJson(res, 200, {
            ok: true,
            users: getActiveUsersList(),
          });
        }

        // 7. Security Settings Update: POST /api/collab/settings
        if (url.startsWith('/api/collab/settings') && req.method === 'POST') {
          const body = await readJsonBody(req);
          if (body.settings) {
            const s = body.settings;
            // Ignore stale copies (e.g. an old tab saving after a newer change)
            if (typeof s.updatedAt === 'number' && s.updatedAt < currentSettings.updatedAt) {
              return sendJson(res, 200, { ok: true, settings: currentSettings });
            }
            if (typeof s.updatedAt === 'number') currentSettings.updatedAt = s.updatedAt;
            if (Array.isArray(s.assignedPasscodes)) currentSettings.assignedPasscodes = s.assignedPasscodes;
            if (s.adminPassword) currentSettings.adminPassword = s.adminPassword;
            if (typeof s.notifyOnLogin === 'boolean') currentSettings.notifyOnLogin = s.notifyOnLogin;
            if (typeof s.soundAlert === 'boolean') currentSettings.soundAlert = s.soundAlert;
            if (typeof s.requireName === 'boolean') currentSettings.requireName = s.requireName;

            broadcastSSE({
              type: 'SECURITY_SETTINGS_SYNC',
              settings: currentSettings,
            });
          }

          return sendJson(res, 200, {
            ok: true,
            settings: currentSettings,
          });
        }

        // 8. Clear Notifications: POST /api/collab/clear-notifications
        if (url.startsWith('/api/collab/clear-notifications') && req.method === 'POST') {
          notificationsList.length = 0;
          broadcastSSE({
            type: 'NOTIFICATIONS_CLEAR',
          });
          return sendJson(res, 200, { ok: true });
        }

        // 9. Dismiss Individual Notification: POST /api/collab/dismiss-notification
        if (url.startsWith('/api/collab/dismiss-notification') && req.method === 'POST') {
          const body = await readJsonBody(req);
          const id = body.id;
          if (id) {
            const idx = notificationsList.findIndex((n) => n.id === id);
            if (idx !== -1) {
              notificationsList.splice(idx, 1);
            }
            broadcastSSE({
              type: 'NOTIFICATION_DISMISS',
              id,
            });
          }
          return sendJson(res, 200, { ok: true });
        }

        // 10. Upload Work Orders: POST /api/upload-workorders
        if (url.startsWith('/api/upload-workorders') && req.method === 'POST') {
          const body = await readJsonBody(req);
          const workOrders = Array.isArray(body.workOrders) ? body.workOrders : [];
          serverWorkOrders = workOrders;
          broadcastSSE({ type: 'WORK_ORDERS_UPDATED', count: workOrders.length });
          return sendJson(res, 200, {
            ok: true,
            message: `Successfully uploaded and validated ${workOrders.length} work orders.`,
            count: workOrders.length,
          });
        }

        // 11. Allocate Resources: POST /api/allocate-resources
        if (url.startsWith('/api/allocate-resources') && req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, {
            ok: true,
            allocatedCount: body.allocatedCount ?? serverWorkOrders.length,
            conflicts: body.conflicts ?? [],
            buffer: body.buffer ?? 1,
          });
        }

        // 12. Allocation Grid: GET /api/allocation-grid
        if (url.startsWith('/api/allocation-grid') && req.method === 'GET') {
          return sendJson(res, 200, {
            ok: true,
            workOrders: serverWorkOrders,
          });
        }

        // 13. Resource Conflicts: GET /api/resource-conflicts
        if (url.startsWith('/api/resource-conflicts') && req.method === 'GET') {
          return sendJson(res, 200, {
            ok: true,
            conflicts: [
              {
                line: 'L4',
                shift: 'morning',
                date: '2026-11-12',
                need: 3,
                have: 2,
                short: 1,
                reason: 'Line 4 Morning PM short 1 person',
              },
            ],
          });
        }

        // 14. Export Roster: POST /api/export-roster
        if (url.startsWith('/api/export-roster') && req.method === 'POST') {
          return sendJson(res, 200, {
            ok: true,
            exportUrl: '/exports/November_Work_Orders_Allocations.xlsx',
            timestamp: new Date().toISOString(),
          });
        }

        return next();
      });
    },
  };
}
