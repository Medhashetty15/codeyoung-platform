import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const commaSeparated = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )
  .pipe(z.array(z.url({ protocol: /^https?$/ })));

/** Environment variables read at boot (docs/03-backend-design.md §11). */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    WEB_BASE_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:5173'),
    CORS_ORIGINS: commaSeparated.optional(),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    LOG_PRETTY: z.stringbool().optional(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    RATE_LIMIT_MULTIPLIER: z.coerce.number().positive().max(1000).default(1),
    /** HS256 key for access tokens; at least 32 bytes. */
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SEC: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    SESSION_MAX_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    REFRESH_REUSE_GRACE_SEC: z.coerce.number().int().min(0).max(120).default(20),
    PASSWORD_RESET_TTL_MIN: z.coerce.number().int().min(5).max(1440).default(30),
    LOGIN_LOCK_THRESHOLD: z.coerce.number().int().min(3).max(100).default(10),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    /** Secure flag on the refresh cookie; false only for local http (WebKit drops it). */
    COOKIE_SECURE: z.stringbool().default(true),
    /** Password of the seeded demo parent (`db:seed`); never used in production. */
    SEED_DEMO_PASSWORD: z.string().min(8).max(128).optional(),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.RATE_LIMIT_MULTIPLIER <= 1, {
    path: ['RATE_LIMIT_MULTIPLIER'],
    message: 'must not relax rate limits (> 1) in production',
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.COOKIE_SECURE, {
    path: ['COOKIE_SECURE'],
    message: 'must be true in production',
  })
  .refine((env) => env.REFRESH_TTL_DAYS <= env.SESSION_MAX_DAYS, {
    path: ['REFRESH_TTL_DAYS'],
    message: 'must not exceed SESSION_MAX_DAYS',
  });

export type Env = z.infer<typeof envSchema>;
export type LogLevel = (typeof LOG_LEVELS)[number];

export class ConfigValidationError extends Error {
  override readonly name = 'ConfigValidationError';
}

/**
 * Typed, validated configuration. Registered as a global provider so it can be
 * injected by class. Values are never logged raw (DATABASE_URL holds a password).
 */
export class AppConfig {
  readonly nodeEnv: Env['NODE_ENV'];
  readonly port: number;
  readonly databaseUrl: string;
  readonly webBaseUrl: string;
  /** Origins allowed by CORS; defaults to the web app origin. */
  readonly corsOrigins: readonly string[];
  readonly logLevel: LogLevel;
  readonly logPretty: boolean;
  readonly trustProxyHops: number;
  readonly rateLimitMultiplier: number;
  readonly seedDemoPassword: string | undefined;
  readonly auth: {
    readonly accessSecret: string;
    readonly accessTtlSeconds: number;
    readonly refreshTtlDays: number;
    readonly sessionMaxDays: number;
    readonly refreshReuseGraceSeconds: number;
    readonly passwordResetTtlMinutes: number;
    readonly loginLockThreshold: number;
    readonly loginLockMinutes: number;
    readonly cookieSecure: boolean;
  };

  private constructor(env: Env) {
    this.nodeEnv = env.NODE_ENV;
    this.port = env.PORT;
    this.databaseUrl = env.DATABASE_URL;
    this.webBaseUrl = env.WEB_BASE_URL.replace(/\/+$/, '');
    this.corsOrigins = env.CORS_ORIGINS ?? [new URL(env.WEB_BASE_URL).origin];
    this.logLevel = env.LOG_LEVEL;
    this.logPretty = env.LOG_PRETTY ?? env.NODE_ENV === 'development';
    this.trustProxyHops = env.TRUST_PROXY_HOPS;
    this.rateLimitMultiplier = env.RATE_LIMIT_MULTIPLIER;
    this.seedDemoPassword = env.SEED_DEMO_PASSWORD;
    this.auth = {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtlSeconds: env.JWT_ACCESS_TTL_SEC,
      refreshTtlDays: env.REFRESH_TTL_DAYS,
      sessionMaxDays: env.SESSION_MAX_DAYS,
      refreshReuseGraceSeconds: env.REFRESH_REUSE_GRACE_SEC,
      passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MIN,
      loginLockThreshold: env.LOGIN_LOCK_THRESHOLD,
      loginLockMinutes: env.LOGIN_LOCK_MINUTES,
      cookieSecure: env.COOKIE_SECURE,
    };
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  /** Parses raw environment variables; throws a readable error listing every invalid key. */
  static fromEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>): AppConfig {
    const result = envSchema.safeParse(source);
    if (!result.success) {
      const lines = result.error.issues.map(
        (issue) => `  - ${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`,
      );
      throw new ConfigValidationError(`Invalid environment configuration:\n${lines.join('\n')}`);
    }
    return new AppConfig(result.data);
  }

  /** Scales a documented rate limit by RATE_LIMIT_MULTIPLIER (relaxed in e2e runs). */
  scaledLimit(limit: number): number {
    return Math.max(1, Math.round(limit * this.rateLimitMultiplier));
  }

  /** Non-secret summary, safe to print or log. */
  describe(): Record<string, string | number | boolean | readonly string[]> {
    const db = new URL(this.databaseUrl);
    return {
      nodeEnv: this.nodeEnv,
      port: this.port,
      database: `${db.protocol}//${db.hostname}:${db.port || '5432'}${db.pathname}`,
      webBaseUrl: this.webBaseUrl,
      corsOrigins: this.corsOrigins,
      logLevel: this.logLevel,
      trustProxyHops: this.trustProxyHops,
      rateLimitMultiplier: this.rateLimitMultiplier,
      accessTokenTtlSeconds: this.auth.accessTtlSeconds,
      cookieSecure: this.auth.cookieSecure,
    };
  }
}
