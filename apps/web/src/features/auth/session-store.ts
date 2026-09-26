import { create } from 'zustand';

/** `unknown` until the boot refresh settles; protected routes wait for it (doc 05 §10). */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

/** Why an authenticated session ended, so guards can react correctly (home vs login + notice). */
export type SessionEnd = 'logout' | 'expired' | null;

interface SessionState {
  status: SessionStatus;
  /** Access token, in memory only. The refresh token is an httpOnly cookie JS never sees. */
  accessToken: string | null;
  endedBy: SessionEnd;
}

export const useSessionStore = create<SessionState>(() => ({
  status: 'unknown',
  accessToken: null,
  endedBy: null,
}));

export const useSessionStatus = () => useSessionStore((state) => state.status);
