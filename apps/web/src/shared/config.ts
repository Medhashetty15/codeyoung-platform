/** Build-time settings from VITE_* variables (see apps/web/.env.example). */
export const config = {
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL ?? 'support@codeyoung.dev',
  /** Serve API calls from MSW handlers instead of the real API (dev only, doc 06 M7). */
  apiMocks: import.meta.env.DEV && import.meta.env.VITE_API_MOCKS === '1',
} as const;
