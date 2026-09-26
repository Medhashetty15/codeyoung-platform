/**
 * Public API for the session layer; safe to import from the always-loaded shell.
 * Forms (React Hook Form, zod) live behind the separate `features/auth/forms` entry so they only
 * load with the routes that show them.
 */
export { GuestOnly, RequireAuth } from './guards';
export { loginPathFor, sanitizeReturnTo, withReturnTo } from './return-to';
export { initSession, logout, refreshAccessToken, signedIn } from './session';
export { useMe, type Me } from './api';
export { useSessionStatus, useSessionStore, type SessionStatus } from './session-store';
