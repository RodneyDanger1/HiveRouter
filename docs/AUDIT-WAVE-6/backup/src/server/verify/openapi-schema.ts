/**
 * OpenAPI response-schema guard.
 *
 * Fastify route response schemas are JSON Schemas. Swagger converts them into
 * OpenAPI Response Objects. This module gives every operation at least one
 * typed 2xx and one typed 4xx response without changing route behavior.
 */

export interface OpenApiOperationLike {
  responses?: Record<string, { schema?: unknown; content?: unknown } | undefined>;
}

export interface OpenApiDocumentLike {
  openapi?: string;
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, unknown> };
}

export const JSON_SUCCESS_SCHEMA = {
  type: 'object',
  additionalProperties: true,
} as const;

export const JSON_ERROR_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    error: {
      type: 'object',
      additionalProperties: true,
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        hint: { type: 'string' },
        retryable: { type: 'boolean' },
        details: { type: 'object', additionalProperties: true },
      },
    },
  },
} as const;

/** Binary/text routes are not JSON; they still get a typed response schema. */
const TEXT_SUCCESS_SCHEMA = { type: 'string' } as const;

const SUCCESS_CODES = ['200', '201', '202'] as const;
const ERROR_CODES = ['400', '401', '403', '404', '409', '422', '500'] as const;
const OPERATION_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);

function successSchemaFor(url: string): unknown {
  if (/\/download$/.test(url)) return { type: 'string', format: 'binary' };
  if (/\/stream$/.test(url)) return TEXT_SUCCESS_SCHEMA;
  if (/\/files\/content$/.test(url)) return TEXT_SUCCESS_SCHEMA;
  return JSON_SUCCESS_SCHEMA;
}

/**
 * Mutates a Fastify route schema in place, adding the missing response codes.
 * Existing route-specific response schemas win; only absent codes are filled.
 */
export function decorateRouteResponses(route: {
  url?: string;
  schema?: Record<string, unknown>;
}): void {
  const schema = route.schema ?? (route.schema = {});
  const responses = (schema.response ?? {}) as Record<string, unknown>;
  const success = successSchemaFor(route.url ?? '');
  for (const code of SUCCESS_CODES) {
    if (!(code in responses)) responses[code] = success;
  }
  for (const code of ERROR_CODES) {
    if (!(code in responses)) responses[code] = JSON_ERROR_SCHEMA;
  }
  schema.response = responses;
}

function hasSchema(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;
  const value = response as Record<string, unknown>;
  return Boolean(value.schema ?? value.content);
}

/**
 * Add response schemas to the generated OpenAPI document only. This must never
 * mutate Fastify route schemas: a route response schema is a serializer, and an
 * object schema on an array route coerces `[]` into `{"0":...}` at runtime.
 */
function successContentFor(url: string): Record<string, unknown> {
  if (/\/download$/.test(url)) return { 'application/zip': { schema: { type: 'string', format: 'binary' } } };
  if (/\/stream$/.test(url)) return { 'text/event-stream': { schema: { type: 'string' } } };
  if (/\/files\/content$/.test(url) || /\/vault\/file$/.test(url)) return { 'text/plain': { schema: { type: 'string' } } };
  return { 'application/json': { schema: JSON_SUCCESS_SCHEMA } };
}

function errorContent(): Record<string, unknown> {
  return { 'application/json': { schema: JSON_ERROR_SCHEMA } };
}

function withContent(response: unknown, content: Record<string, unknown>): Record<string, unknown> {
  const base = response && typeof response === 'object' ? (response as Record<string, unknown>) : {};
  return { description: 'Response', ...base, content };
}

export function decorateOpenApiDocument(doc: OpenApiDocumentLike): OpenApiDocumentLike {
  const paths = doc.paths ?? {};
  for (const [pathName, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!OPERATION_METHODS.has(method.toLowerCase())) continue;
      const operation = rawOperation as OpenApiOperationLike & { responses?: Record<string, unknown> };
      const responses = (operation.responses ?? {}) as Record<string, Record<string, unknown>>;
      for (const [code, response] of Object.entries(responses)) {
        if (hasSchema(response)) continue;
        if (/^2\d\d$/.test(code)) responses[code] = withContent(response, successContentFor(pathName));
        else if (/^4\d\d$/.test(code)) responses[code] = withContent(response, errorContent());
      }
      for (const code of SUCCESS_CODES) {
        if (code in responses) continue;
        responses[code] = {
          description: code === '202' ? 'Accepted' : 'Successful response',
          content: successContentFor(pathName),
        };
      }
      for (const code of ERROR_CODES) {
        if (code in responses) continue;
        responses[code] = {
          description: 'Named refusal',
          content: errorContent(),
        };
      }
      operation.responses = responses;
    }
  }
  return doc;
}

/** Returns exact violations; empty means every operation has typed 2xx/4xx responses. */
export function openApiResponseViolations(doc: OpenApiDocumentLike): string[] {  const violations: string[] = [];
  const paths = doc.paths ?? {};
  for (const [pathName, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!OPERATION_METHODS.has(method.toLowerCase())) continue;
      const operation = rawOperation as OpenApiOperationLike;
      const responses = operation.responses ?? {};
      const codes = Object.keys(responses);
      const has2xx = codes.some((code) => /^2\d\d$/.test(code) && hasSchema(responses[code]));
      const has4xx = codes.some((code) => /^4\d\d$/.test(code) && hasSchema(responses[code]));
      if (!has2xx) violations.push(`${method.toUpperCase()} ${pathName}: missing typed 2xx response schema`);
      if (!has4xx) violations.push(`${method.toUpperCase()} ${pathName}: missing typed 4xx response schema`);
    }
  }
  return violations;
}

export function assertOpenApiResponses(doc: OpenApiDocumentLike): void {
  if (doc.openapi !== '3.1.0') {
    throw new Error(`OpenAPI document must be 3.1.0, got ${String(doc.openapi)}`);
  }
  const violations = openApiResponseViolations(doc);
  if (violations.length > 0) {
    throw new Error(`OpenAPI response-schema violations:\n${violations.join('\n')}`);
  }
}
