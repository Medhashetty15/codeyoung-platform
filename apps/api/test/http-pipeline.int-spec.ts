import { type NestExpressApplication } from '@nestjs/platform-express';
import { getDataSourceToken } from '@nestjs/typeorm';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ProblemSchema } from '@app/contracts';

import { ProbeController } from './support/probe.controller';
import { api, createTestApp } from './support/test-app';

const PROBLEM_JSON = /^application\/problem\+json/;
const UUID = /^[0-9a-f-]{36}$/;

describe('HTTP pipeline', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ProbeController] });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => api(app);

  describe('health', () => {
    it('reports liveness without touching dependencies', async () => {
      const response = await http().get('/api/v1/health/live').expect(200);

      expect(response.body).toMatchObject({ status: 'ok' });
    });

    it('reports readiness with the database up', async () => {
      const response = await http().get('/api/v1/health/ready').expect(200);

      expect(response.body).toMatchObject({ status: 'ok', info: { database: { status: 'up' } } });
    });
  });

  describe('problem details', () => {
    it('answers unknown routes with NOT_FOUND', async () => {
      const response = await http().get('/api/v1/does-not-exist').expect(404);

      expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
      expect(response.body).toEqual({
        type: 'https://errors.codeyoung.dev/not-found',
        title: 'Resource not found',
        status: 404,
        code: 'NOT_FOUND',
        traceId: response.headers['x-request-id'],
      });
    });

    it('returns documented extras for domain errors', async () => {
      const response = await http().get('/api/v1/__probe/app-error').expect(409);

      expect(ProblemSchema.parse(response.body)).toMatchObject({
        code: 'NO_MENTOR_AVAILABLE',
        detail: 'This time was just taken.',
        alternatives: [{ start: '2026-10-24T17:00:00Z', end: '2026-10-24T18:00:00Z' }],
      });
    });

    it('reports schema violations with dotted field paths', async () => {
      const response = await http()
        .post('/api/v1/__probe/validate')
        .send({ student: { firstName: '   ' }, age: 3 })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          { path: 'student.firstName', message: expect.any(String) },
          { path: 'age', message: expect.any(String) },
        ]),
      );
    });

    it('passes valid bodies through the validation pipe', async () => {
      const response = await http()
        .post('/api/v1/__probe/validate')
        .send({ student: { firstName: ' Leo ' }, age: 9 })
        .expect(201);

      expect(response.body).toEqual({ student: { firstName: 'Leo' }, age: 9 });
    });

    it('rejects malformed JSON without echoing the body', async () => {
      const response = await http()
        .post('/api/v1/__probe/validate')
        .set('Content-Type', 'application/json')
        .send('{"password": "hunter2"')
        .expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        detail: 'The request body is not valid JSON.',
        traceId: response.headers['x-request-id'],
      });
      expect(JSON.stringify(response.body)).not.toContain('hunter2');
    });

    it('rejects bodies over the size limit', async () => {
      const response = await http()
        .post('/api/v1/__probe/validate')
        .send({ padding: 'x'.repeat(200_000) })
        .expect(400);

      expect(response.body).toMatchObject({ detail: 'The request body is too large.' });
    });

    it('hides internal error details behind INTERNAL_ERROR', async () => {
      const response = await http().get('/api/v1/__probe/crash').expect(500);

      expect(response.body).toEqual({
        type: 'https://errors.codeyoung.dev/internal-error',
        title: 'Something went wrong',
        status: 500,
        code: 'INTERNAL_ERROR',
        traceId: expect.stringMatching(UUID),
      });
      expect(JSON.stringify(response.body)).not.toContain('password');
    });

    it('tells clients when to retry after TEMPORARILY_UNAVAILABLE', async () => {
      const response = await http().get('/api/v1/__probe/unavailable').expect(503);

      expect(ProblemSchema.parse(response.body)).toMatchObject({
        code: 'TEMPORARILY_UNAVAILABLE',
        retryAfterSeconds: 5,
      });
      expect(response.headers['retry-after']).toBe('5');
    });

    it('answers unknown zones with INVALID_TIMEZONE and canonicalises known ones', async () => {
      const invalid = await http()
        .post('/api/v1/__probe/zone')
        .send({ timezone: 'Mars/Olympus' })
        .expect(400);
      const legacy = await http()
        .post('/api/v1/__probe/zone')
        .send({ timezone: 'Asia/Calcutta' })
        .expect(201);

      expect(invalid.body).toMatchObject({
        code: 'INVALID_TIMEZONE',
        errors: [{ path: 'timezone', message: 'Unknown time zone' }],
      });
      expect(legacy.body).toEqual({ timezone: 'Asia/Kolkata' });
    });
  });

  describe('request ids', () => {
    it('echoes a well-formed incoming X-Request-Id and uses it as traceId', async () => {
      const response = await http()
        .get('/api/v1/nope')
        .set('X-Request-Id', 'edge-7f3a9c21')
        .expect(404);

      expect(response.headers['x-request-id']).toBe('edge-7f3a9c21');
      expect(response.body.traceId).toBe('edge-7f3a9c21');
    });

    it('replaces an unsafe incoming id', async () => {
      const response = await http()
        .get('/api/v1/health/live')
        .set('X-Request-Id', 'bad id!')
        .expect(200);

      expect(response.headers['x-request-id']).toMatch(UUID);
    });
  });

  describe('security headers and CORS', () => {
    it('sets Helmet headers', async () => {
      const response = await http().get('/api/v1/health/live').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers).not.toHaveProperty('x-powered-by');
    });

    it('allows the web origin with credentials and the custom headers', async () => {
      const response = await http()
        .options('/api/v1/health/live')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'idempotency-key,x-requested-with,authorization')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-headers']).toContain('Idempotency-Key');
    });

    it('does not allow other origins', async () => {
      const response = await http()
        .options('/api/v1/health/live')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers).not.toHaveProperty('access-control-allow-origin');
    });
  });

  it('serves the OpenAPI document outside production', async () => {
    const response = await http().get('/api/docs-json').expect(200);

    expect(response.body).toMatchObject({ openapi: expect.any(String), info: { version: '1' } });
    expect(Object.keys(response.body.paths as Record<string, unknown>)).toContain(
      '/api/v1/health/ready',
    );
  });

  it('documents a success body and the problem responses of every API operation', async () => {
    const { paths } = (await http().get('/api/docs-json').expect(200)).body as {
      paths: Record<string, Record<string, { responses: Record<string, { content?: object }> }>>;
    };
    const operations = Object.entries(paths)
      .filter(([path]) => !path.startsWith('/api/v1/health/') && !path.includes('__probe'))
      .flatMap(([path, methods]) =>
        Object.entries(methods).map(([method, operation]) => ({ path, method, operation })),
      );
    expect(operations.length).toBeGreaterThanOrEqual(23);

    for (const { path, method, operation } of operations) {
      const statuses = Object.keys(operation.responses);
      const success = statuses.find((status) => status.startsWith('2'));
      const where = `${method.toUpperCase()} ${path}`;
      expect(success, where).toBeDefined();
      if (success !== '204' && success !== '202') {
        expect(operation.responses[success ?? '']?.content, where).toBeDefined();
      }
      expect(statuses, where).toEqual(expect.arrayContaining(['400', '429', 'default']));
    }
  });
});

describe('rate limiting', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    // 120/min scaled down to 3/min.
    app = await createTestApp({
      env: { RATE_LIMIT_MULTIPLIER: '0.025' },
      controllers: [ProbeController],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns RATE_LIMITED with Retry-After once the limit is spent', async () => {
    const http = api(app);
    for (let i = 0; i < 3; i += 1) await http.get('/api/v1/__probe/app-error').expect(409);

    const response = await http.get('/api/v1/__probe/app-error').expect(429);

    expect(ProblemSchema.parse(response.body)).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.body.retryAfterSeconds).toBe(Number(response.headers['retry-after']));
  });

  it('never throttles health probes', async () => {
    const http = api(app);
    for (let i = 0; i < 5; i += 1) await http.get('/api/v1/health/live').expect(200);
  });
});

describe('production mode', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({
      env: { NODE_ENV: 'production', SMTP_URL: 'smtp://mail.example.com:587' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not expose the OpenAPI document', async () => {
    const response = await api(app).get('/api/docs-json').expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('readiness without a database', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await app.get<DataSource>(getDataSourceToken()).destroy();
  });

  afterAll(async () => {
    await app.close();
  });

  it('fails readiness with TEMPORARILY_UNAVAILABLE but stays live', async () => {
    const http = api(app);

    const ready = await http.get('/api/v1/health/ready').expect(503);
    await http.get('/api/v1/health/live').expect(200);

    expect(ready.body).toMatchObject({ code: 'TEMPORARILY_UNAVAILABLE' });
    expect(ready.headers['retry-after']).toBe('5');
  });
});
