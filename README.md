# MailCraft AI

MailCraft AI is a bilingual business email assistant for composing, replying to, refining, saving, and reusing professional emails. The app supports English and Arabic, authenticated user workspaces, usage quotas, email history, snippets, account settings, and configurable AI generation.

## Chosen Stack

- Frontend: React 18, Vite, TypeScript, React Router
- Styling/UI: Tailwind CSS, Radix UI, shadcn-style components
- Data/auth/runtime services: Supabase client against PostgreSQL, Auth, and Edge Functions
- Server-side AI: Supabase Edge Functions with an OpenAI-compatible provider interface
- State/data fetching: TanStack Query plus localized component state
- Testing/build tooling: Vitest, ESLint, npm

This stack fits the current product because it is a client-heavy SaaS workflow with authenticated dashboards, database-backed history, and lightweight server-side AI endpoints. Vite keeps the UI fast and portable, Supabase maps cleanly to the existing PostgreSQL schema and auth flow, and the AI layer is now provider-configurable through environment variables instead of being tied to any builder platform.

## Project Structure

```text
.
├── public/                  Static browser assets
├── src/
│   ├── assets/              App images and visual assets
│   ├── components/          Shared application and UI components
│   ├── config/              Runtime environment configuration
│   ├── contexts/            Auth and language providers
│   ├── hooks/               Shared React hooks
│   ├── i18n/                Translation strings
│   ├── lib/                 Shared framework utilities
│   ├── pages/               Route-level screens
│   ├── services/            External service clients
│   └── test/                Test setup and examples
├── supabase/
│   ├── functions/           Edge functions for AI and protected server logic
│   └── migrations/          PostgreSQL schema migrations
├── .env.example             Required environment variable template
├── package.json             npm scripts and dependencies
└── vite.config.ts           Vite application config
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Fill in the Supabase and AI provider values in `.env`.

4. Apply the database migrations, including profile, intelligence-history, and rate-limit fields:

```bash
npx supabase@latest link --project-ref uwvschgthdsyevfhdtey
npm run deploy:db
```

5. Set Edge Function secrets and deploy the protected generation endpoint:

```bash
npx supabase@latest secrets set --project-ref uwvschgthdsyevfhdtey --env-file .env
npm run deploy:functions
```

6. Start the development server:

```bash
npm run dev
```

7. Build for production:

```bash
npm run build
```

8. Run tests:

```bash
npm run test
```

## Vercel Deployment

The frontend is ready to deploy as a Vite app on Vercel.

Required Vercel project settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Required Vercel environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel. Service-role and AI provider secrets belong only in Supabase Edge Function secrets.

`vercel.json` includes a SPA rewrite so refreshed React Router routes such as `/pricing`, `/login`, and `/app` resolve to `index.html`.

## Edge Function Configuration

The AI functions use an OpenAI-compatible chat completions API:

- `AI_API_KEY`: required provider API key
- `AI_BASE_URL`: optional provider base URL, defaults to `https://api.openai.com/v1`
- `AI_MODEL`: optional model name, defaults to `gpt-4o-mini`
- `AI_FALLBACK_MODELS`: optional comma-separated fallback models for transient provider failures
- `AI_STRICT_JSON`: optional boolean that asks compatible providers to enforce JSON output
- `AI_APP_URL` and `AI_APP_NAME`: optional provider attribution headers

This allows the server code to run against OpenAI or any compatible provider without changing application code.

The `generate-email` function authenticates callers, validates and bounds inputs, uses an atomic per-user rate limit (6 requests per minute), applies the monthly plan quota, and stores structured generation results. The service-role key belongs only in Supabase Edge Function secrets, never in the frontend environment.
