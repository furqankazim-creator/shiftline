export type UserRole = 'supervisor' | 'collaborator' | 'viewer';

export interface UserSession {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  loginTime: number;
  passcodeUsed: string;
  device?: string;
}

export interface LoginNotification {
  id: string;
  type: 'login' | 'logout' | 'presence' | 'edit' | 'security';
  userName: string;
  userRole: UserRole;
  timestamp: number;
  message: string;
  details?: string;
  read: boolean;
}

export interface PresenceUser {
  id: string;
  name: string;
  role: UserRole;
  joinedAt: number;
  lastActive: number;
  isSelf?: boolean;
  status?: 'online' | 'offline';
}

export interface AssignedPasscode {
  id: string;
  passcode: string;
  assignedTo: string;
  role: UserRole;
  createdAt: number;
  lastUsedAt?: number;
  status: 'active' | 'revoked';
  notes?: string;
}

export interface SecuritySettings {
  /** The shared link passcode given to team members/clients (default: "shiftline2026") */
  sharedPasscode: string;
  /** Recent allowed passcodes so newly generated passcodes work immediately across all sessions */
  recentPasscodes?: string[];
  /** Detailed list of individual passcodes and assigned links */
  assignedPasscodes?: AssignedPasscode[];
  /** Admin master password for supervisors */
  adminPassword: string;
  /** Whether entering a name is required when unlocking via shared passcode */
  requireName: boolean;
  /** Whether to trigger an alert when someone logs in via the shared link */
  notifyOnLogin: boolean;
  /** Audio chime sound when a login notification arrives */
  soundAlert: boolean;
  /** Default role assigned to shared passcode users */
  defaultSharedRole: UserRole;
}

export type CollabBroadcastMessage =
  | {
      type: 'LOGIN_ALERT';
      notification: LoginNotification;
      user: PresenceUser;
    }
  | {
      type: 'PRESENCE_PING';
      user: PresenceUser;
    }
  | {
      type: 'PRESENCE_PONG';
      user: PresenceUser;
    }
  | {
      type: 'PRESENCE_LEAVE';
      userId: string;
    }
  | {
      type: 'LOGOUT_ALERT';
      notification: LoginNotification;
      userId: string;
    }
  | {
      type: 'SECURITY_SETTINGS_SYNC';
      settings: SecuritySettings;
    }
  | {
      type: 'NOTIFICATIONS_CLEAR';
    }
  | {
      type: 'NOTIFICATION_DISMISS';
      id: string;
    }
  | {
      type: 'ROSTER_CELL_UPDATE';
      employeeId: string;
      dayIndex: number;
      code: string;
      updatedBy: string;
      timestamp: number;
    }
  | {
      type: 'ROSTER_SYNC_REQUEST';
      fromUserId: string;
    };

