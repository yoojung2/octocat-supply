import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './index';

const originalEnv = { ...process.env };

function appWithEnv(env: NodeJS.ProcessEnv = {}) {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    API_KEYS: 'admin:test-api-key:admin,reader:read-api-key:read',
    API_CORS_ORIGINS: 'https://supply.example.com',
    JSON_BODY_LIMIT: '1kb',
    ...env,
  };
  return createApp();
}

describe('API security middleware', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects unauthenticated CRUD requests', async () => {
    const response = await request(appWithEnv()).post('/api/orders').send({});

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('forbids read-only keys from modifying resources', async () => {
    const response = await request(appWithEnv())
      .delete('/api/orders/1')
      .set('X-API-Key', 'read-api-key');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid request bodies before route handlers run', async () => {
    const response = await request(appWithEnv())
      .post('/api/orders')
      .set('X-API-Key', 'test-api-key')
      .send({ branchId: '1', status: 'not-valid', unexpected: true });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects oversized JSON bodies', async () => {
    const response = await request(appWithEnv({ JSON_BODY_LIMIT: '10b' }))
      .post('/api/orders')
      .set('X-API-Key', 'test-api-key')
      .send({ branchId: 1, orderDate: '2026-08-13', status: 'pending' });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('allows only explicitly configured CORS origins without credentials by default', async () => {
    const allowed = await request(appWithEnv())
      .options('/api/orders')
      .set('Origin', 'https://supply.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(allowed.headers['access-control-allow-origin']).toBe('https://supply.example.com');
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();

    const denied = await request(appWithEnv())
      .options('/api/orders')
      .set('Origin', 'https://evil.app.github.dev')
      .set('Access-Control-Request-Method', 'POST');

    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not expose Swagger in production unless explicitly enabled', async () => {
    const response = await request(appWithEnv({ NODE_ENV: 'production', ENABLE_SWAGGER: 'false' }))
      .get('/api-docs.json')
      .set('X-API-Key', 'test-api-key');

    expect(response.status).toBe(404);
  });
});
