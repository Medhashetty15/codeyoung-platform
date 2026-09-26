import { create } from 'zustand';

/** `unknown` until the boot refresh settles; protected routes wait for it (doc 05 §10). */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

interface SessionState {
  status: SessionStatus;
  /** Access token, in memory only. The refresh token is an httpOnly cookie JS never sees. */
  accessToken: string | null;
}

export const useSessionStore = create<SessionState>(() => ({
  status: 'unknown',
  accessToken: null,
}));

export const useSessionStatus = () => useSessionStore((state) => state.status);
