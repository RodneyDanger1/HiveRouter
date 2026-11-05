import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { config } from '../../src/server/config';
import { openApiResponseViolations } from '../../src/server/verify/openapi-schema';

describe('OpenAPI response schemas', () => {
  const appPromise = buildApp();

  afterAll(async () => {
    const app = await appPromise;
    await app.close();
  });

  it('gives every operation a typed 2xx and 4xx response schema', async () => {
    const app = await appPromise;
    const response = await app.inject({
      method: 'GET',
      url: '/openapi.json',
      headers: { host: `127.0.0.1:${config.port}` },
    });
    expect(response.statusCode).toBe(200);
    const doc = response.json() as {
      openapi?: string;
      paths?: Record<string, Record<string, unknown>>;
      components?: { schemas?: Record<string, unknown> };
    };
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths ?? {}).length).toBeGreaterThanOrEqual(40);
    expect(Object.keys(doc.components?.schemas ?? {}).length).toBeGreaterThanOrEqual(3);
    expect(openApiResponseViolations(doc)).toEqual([]);
  });

  it('detects a missing 2xx or 4xx response schema', () => {
    expect(
      openApiResponseViolations({
        openapi: '3.1.0',
        paths: {
          '/x': {
            get: { responses: { '200': { description: 'no schema' } } },
            post: {
              responses: {
                '202': { schema: { type: 'object' } },
                '409': { schema: { type: 'object' } },
              },
            },
          },
        },
      }),
    ).toEqual([
      'GET /x: missing typed 2xx response schema',
      'GET /x: missing typed 4xx response schema',
    ]);
  });
});
