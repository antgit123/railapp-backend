# railbook-backend

TypeScript monorepo (Turborepo) for all RailBook backend services — [Backend Developer Agent v1.1]

## Packages

| Package | Description |
|---|---|
| `@railbook/api-client` | All Aboard GraphQL client + type-safe codegen + MSW fixtures |
| `@railbook/middleware` | `verifyJwt`, `withValidation<T>`, `formatErrorResponse` |
| `lambdas/*` | Individual Lambda handlers (added Phase 2+) |

## Quick start

```bash
npm install          # install all workspaces
npm run codegen      # generate types from All Aboard GraphQL schema
npm run build        # build all packages
npm test             # run all tests with coverage
npm run type-check   # TypeScript strict check
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ENVIRONMENT` | Yes | `dev` / `staging` / `prod` |
| `ALL_ABOARD_API_URL` | Yes | All Aboard GraphQL endpoint |
| `ALL_ABOARD_WS_URL` | No | WebSocket endpoint (defaults to wss:// of API URL) |
| `COGNITO_JWKS_URL` | Yes | Cognito JWKS endpoint (from SSM) |
| `COGNITO_CLIENT_ID` | Yes | Cognito app client ID (from SSM) |

**All secrets** (API keys, DB passwords) are stored in AWS Secrets Manager under `/railbook/{env}/` — never in environment variables.

## TypeScript config

Strict mode + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` + `isolatedModules`.
See `tsconfig.json` for full config. Rationale in `agents/backend-developer/SKILL.md` in `railbook-docs`.

## Running MSW in tests

```typescript
import { setupServer } from 'msw/node';
import { handlers } from '@railbook/api-client/src/msw/handlers';

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```
