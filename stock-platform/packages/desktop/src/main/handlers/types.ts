/**
 * Shared types and utilities for split IPC handler modules.
 */

import type Database from 'better-sqlite3';
import type { SyncManager } from '../sync-manager.js';

/** Context passed to every handler registration function */
export interface HandlerContext {
  db: Database.Database;
  safeHandle: SafeHandleFn;
  addToOutbox: AddToOutboxFn;
  uuidv7: () => string;
  validateAmount: (value: unknown, field: string) => void;
  validatePositive: (value: unknown, field: string) => void;
  validateDate: (value: unknown, field: string) => void;
  validateString: (value: unknown, field: string) => void;
  validateStringLength: (value: string, field: string, max?: number) => void;
  escapeLike: (s: string) => string;
}

/** Extended context for auth handlers that need session + audit access */
export interface AuthHandlerContext extends HandlerContext {
  validatePassword: (pwd: string) => void;
  auditLog: (action: string, detail?: string) => void;
  loginAttempts: Map<string, { count: number; lastAttempt: number }>;
  MAX_LOGIN_ATTEMPTS: number;
  LOGIN_LOCKOUT_MS: number;
  ALL_PAGES: string[];
  getCurrentSession: () => { userId: string; username: string; role: string; permissions: string[]; lastActivity: number } | null;
  setSession: (session: { userId: string; username: string; role: string; permissions: string[]; lastActivity: number } | null) => void;
  refreshSessionActivity: () => void;
  clearSession: () => void;
}

/** Extended context for sync handlers */
export interface SyncHandlerContext extends HandlerContext {
  syncManager?: SyncManager | null;
}

export type SafeHandleFn = (
  channel: string,
  handler: (...args: unknown[]) => unknown,
  opts?: { requireAdmin?: boolean; skipAuth?: boolean },
) => void;

export type AddToOutboxFn = (
  db: Database.Database,
  entityType: string,
  entityId: string,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  payload: Record<string, unknown>,
) => void;
