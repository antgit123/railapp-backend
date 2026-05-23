// packages/middleware/src/auth.ts
// Backend Agent — Week 1 Deliverable
// Ticket: RAIL-007

import 'server-only';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const JWKS_CACHE: Map<string, ReturnType<typeof createRemoteJWKSet>> = new Map();

function getJwks(jwksUrl: string) {
  if (!JWKS_CACHE.has(jwksUrl)) {
    JWKS_CACHE.set(jwksUrl, createRemoteJWKSet(new URL(jwksUrl)));
  }
  return JWKS_CACHE.get(jwksUrl)!;
}

export interface AuthenticatedUser {
  sub: string;          // Cognito user ID
  email: string;
  'cognito:groups'?: string[];
}

/**
 * Verifies a Cognito JWT from the Authorization header.
 * Throws a typed error with statusCode if invalid.
 * useUnknownInCatchVariables: always narrow errors in catch blocks.
 */
export async function verifyJwt(event: APIGatewayProxyEventV2): Promise<AuthenticatedUser> {
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing or malformed Authorization header'), { statusCode: 401 });
  }

  const token = authHeader.slice(7);
  const jwksUrl = process.env.COGNITO_JWKS_URL;

  if (!jwksUrl) throw new Error('COGNITO_JWKS_URL environment variable is not set');

  try {
    const { payload } = await jwtVerify(token, getJwks(jwksUrl), {
      issuer: jwksUrl.replace('/.well-known/jwks.json', ''),
      audience: process.env.COGNITO_CLIENT_ID,
    });

    return payload as JWTPayload & AuthenticatedUser;
  } catch (e) {
    // e is unknown — narrow before accessing properties (useUnknownInCatchVariables)
    const message = e instanceof Error ? e.message : 'Token verification failed';
    throw Object.assign(new Error(message), { statusCode: 401 });
  }
}


// packages/middleware/src/validate.ts
import { z } from 'zod';
import type { APIGatewayProxyHandlerV2, APIGatewayProxyEventV2 } from 'aws-lambda';

type ValidatedHandler<TInput> = (
  input: TInput,
  event: APIGatewayProxyEventV2
) => Promise<{ statusCode: number; body: string }>;

/**
 * Generic request validation wrapper.
 * Parses and validates the request body against a Zod schema.
 * Returns 422 with flattened errors if validation fails.
 * The handler receives typed input — no any/unknown in handler body.
 */
export function withValidation<TSchema extends z.ZodType>(
  schema: TSchema,
  handler: ValidatedHandler<z.infer<TSchema>>
): APIGatewayProxyHandlerV2 {
  return async (event) => {
    let rawBody: unknown;

    try {
      rawBody = event.body ? JSON.parse(event.body) : {};
    } catch {
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } }),
      };
    }

    const result = schema.safeParse(rawBody);

    if (!result.success) {
      return {
        statusCode: 422,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: result.error.flatten(),
          },
        }),
      };
    }

    return handler(result.data, event);
  };
}

/**
 * Validates query string parameters against a Zod schema.
 */
export function validateQuery<TSchema extends z.ZodType>(
  schema: TSchema,
  params: Record<string, string | undefined> | null | undefined
): z.infer<TSchema> {
  const result = schema.safeParse(params ?? {});
  if (!result.success) {
    throw Object.assign(
      new Error('Invalid query parameters'),
      { statusCode: 422, details: result.error.flatten() }
    );
  }
  return result.data;
}


// packages/middleware/src/errors.ts
export type AllAboardErrorCode =
  | 'OFFER_NOT_AVAILABLE'
  | 'BOOKING_EXPIRED'
  | 'PASSENGER_REQUIREMENTS_NOT_MET'
  | 'PAYMENT_FAILED'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

const HTTP_STATUS: Record<AllAboardErrorCode, number> = {
  OFFER_NOT_AVAILABLE: 409,
  BOOKING_EXPIRED: 410,
  PASSENGER_REQUIREMENTS_NOT_MET: 422,
  PAYMENT_FAILED: 402,
  RATE_LIMITED: 429,
  UNKNOWN: 500,
};

// TS 5.5+ inferred type predicate
export const isAllAboardError = (e: unknown): e is { code: AllAboardErrorCode; message: string } =>
  typeof e === 'object' &&
  e !== null &&
  'code' in e &&
  typeof (e as Record<string, unknown>).code === 'string';

export function formatErrorResponse(e: unknown): { statusCode: number; body: string } {
  if (isAllAboardError(e)) {
    const statusCode = HTTP_STATUS[e.code] ?? 500;
    return {
      statusCode,
      body: JSON.stringify({ error: { code: e.code, message: e.message } }),
    };
  }

  // Typed error with explicit statusCode (from verifyJwt, validateQuery)
  if (
    e instanceof Error &&
    'statusCode' in e &&
    typeof (e as Record<string, unknown>).statusCode === 'number'
  ) {
    return {
      statusCode: (e as Error & { statusCode: number }).statusCode,
      body: JSON.stringify({ error: { code: 'REQUEST_ERROR', message: e.message } }),
    };
  }

  // Unknown error — don't leak internals
  const message = e instanceof Error ? 'An unexpected error occurred' : 'An unexpected error occurred';
  return {
    statusCode: 500,
    body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message } }),
  };
}
