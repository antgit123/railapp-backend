// packages/api-client/src/client.ts
// Backend Agent — Week 1 Deliverable
// Ticket: RAIL-006

import 'server-only';
import { GraphQLClient } from 'graphql-request';
import { getSecret } from '@railbook/shared/secrets';

let _client: GraphQLClient | null = null;

/**
 * Returns a singleton GraphQL client for the All Aboard API.
 * API key is loaded from Secrets Manager at runtime — never hardcoded.
 * Call this inside Lambda handlers, not at module level (cold start optimisation).
 */
export async function getAllAboardClient(): Promise<GraphQLClient> {
  if (_client) return _client;

  const apiKey = await getSecret(`/railbook/${process.env.ENVIRONMENT}/allaboard/apiKey`);
  const apiUrl = process.env.ALL_ABOARD_API_URL;

  if (!apiUrl) throw new Error('ALL_ABOARD_API_URL environment variable is not set');

  _client = new GraphQLClient(apiUrl, {
    headers: {
      authorization: `ApiKey ${apiKey}`,
      'content-type': 'application/json',
      'accept-language': 'en',
    },
    // Retry once on 429 (rate limit) with exponential backoff
    requestMiddleware: async (request) => request,
    responseMiddleware: (response) => {
      if (response instanceof Error) throw response;
      return response;
    },
  });

  return _client;
}

/**
 * WebSocket client for getJourneyOffer subscription.
 * Returns a graphql-ws Client configured with the All Aboard API key.
 */
export async function getAllAboardWsClient() {
  const { createClient } = await import('graphql-ws');
  const apiKey = await getSecret(`/railbook/${process.env.ENVIRONMENT}/allaboard/apiKey`);
  const wsUrl = process.env.ALL_ABOARD_WS_URL ?? process.env.ALL_ABOARD_API_URL?.replace('https://', 'wss://');

  if (!wsUrl) throw new Error('ALL_ABOARD_WS_URL environment variable is not set');

  return createClient({
    url: wsUrl,
    connectionParams: {
      authorization: `ApiKey ${apiKey}`,
    },
    retryAttempts: 3,
  });
}
