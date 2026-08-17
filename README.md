# MailCraft AI

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20PostgreSQL-3FCF8E?style=flat&logo=supabase&logoColor=white)
![Paymob](https://img.shields.io/badge/Paymob-Checkout-00B5B8?style=flat&logo=paymob&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployment-000000?style=flat&logo=vercel&logoColor=white)

MailCraft is an Arabic-English client communication assistant for freelancers and small agencies. It creates grounded proposals, follow-ups, project updates, payment reminders, revision replies, and complaint responses using the facts supplied by the user.

The product is designed around a simple outcome: help freelancers win clients, get paid, and keep projects moving with professional messages that sound natural in Arabic or English.

## Current capabilities

- Workflow-specific client communication generation.
- English, Arabic, and Arabic-English conversion with RTL support.
- Natural Modern Standard Arabic and idiomatic English generation.
- Server-side AI generation through an OpenAI-compatible provider.
- Fact-grounding validation to reduce invented claims.
- Saved freelancer profile and writing preferences.
- Client and project context attached to generated drafts.
- Searchable history with favorites, duplication, revisions, workflow filters, and message statuses.
- Reusable snippets.
- Copy, TXT, PDF, and DOCX export.
- Supabase authentication, PostgreSQL, row-level security, quotas, and rate limiting.
- Paymob hosted checkout and HMAC-verified payment webhook.
- English/Arabic landing, generator, pricing, and core application localization.

## Supported workflows

| Workflow | Use case |
| --- | --- |
| Client proposal | Present a service and approach to win a project |
| Proposal follow-up | Follow up without sounding desperate |
| Project update | Explain current status and the next milestone |
| Payment reminder | Request an outstanding payment professionally |
| Revision request | Respond constructively to requested changes |
| Client complaint | Acknowledge a concern and propose a next step |
| Custom | Write another client-focused message |

## Routes

| Path | Description |
| --- | --- |
| `/` | Bilingual landing page, public demo, features, and pricing |
| `/login` | Supabase email/password login |
| `/signup` | Account creation |
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset completion |
| `/pricing` | Free, Pro, and Business plans with Paymob checkout |
| `/app` | Protected client-message generator |
| `/app/history` | Saved messages, workflow filters, statuses, favorites, and duplication |
| `/app/snippets` | Reusable text snippets |
| `/app/account` | Freelancer profile, services, payment terms, language, and writing preferences |

## Plans

The plan catalog is stored in the Supabase `plans` table and can be changed without rebuilding the frontend.

| Plan | Current quota | Intended user |
| --- | ---: | --- |
| Free | 10 messages/month | Trial users |
| Pro | 300 messages/month | Individual freelancers |
| Business | 1,000 messages/month | Small agencies and collaborative teams |

Current paid prices are configured in the database, with Pro at 199 EGP/month and Business at 499 EGP/month.

Paymob currently handles one-time checkout for a monthly access period. Automatic recurring billing requires a separate Paymob Subscription Module implementation.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, TypeScript, React Router |
| Styling | Tailwind CSS, shadcn/ui, Radix UI, Framer Motion |
| Forms and UI | React Hook Form, Zod, Sonner, Lucide |
| Backend | Supabase Auth, PostgreSQL, RLS, Edge Functions, Deno |
| AI | OpenAI-compatible chat-completions provider |
| Payments | Paymob Intention API, Unified Checkout, HMAC webhook |
| Export | TXT, jsPDF, DOCX |
| Deployment | Vercel and Supabase |
| Testing | Vitest + Testing Library (frontend), Deno tests (Edge Functions) |
| CI | GitHub Actions: lint, typecheck, Vitest, Deno Edge Function tests, deploy |

## AI generation flow

```text
User workflow + client facts
        ↓
Input sanitization and profile merge
        ↓
Source-language detection
        ↓
Arabic/English target-language generation or semantic translation
        ↓
Quality cleanup and structured JSON normalization
        ↓
Fact-grounding audit
        ↓
Regeneration when unsupported claims are detected
        ↓
Conservative deterministic fallback when the provider is unavailable
```

The AI is instructed to preserve names, companies, URLs, dates, amounts, currencies, project details, and explicit user facts. It must not invent experience, metrics, clients, deadlines, results, or promises.

## Project structure

```text
src/
├── App.tsx
├── components/          # Application shell, route protection, language toggle, UI primitives
├── config/              # Frontend environment validation
├── contexts/            # Authentication and language providers
├── i18n/                # English and Arabic translations
├── pages/               # Landing, auth, generator, history, snippets, account, pricing
├── services/supabase/   # Supabase client and database types
└── test/                # Vitest setup and tests

supabase/
├── functions/
│   ├── _shared/         # AI provider, prompts, validation, HTTP helpers
│   ├── generate-email/  # Authenticated generation and history persistence
│   ├── ai-content/      # AI content helper endpoint
│   ├── create-payment/  # Paymob intention and checkout creation
│   ├── paymob-webhook/  # HMAC-verified subscription updates
│   └── verify-share-password/
└── migrations/          # Schema, quotas, plans, workflows, and client context
```

## Environment variables

Copy the template:

```powershell
Copy-Item .env.example .env
```

Frontend variables are required in `.env` and in Vercel:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
VITE_SITE_URL=https://your-production-domain.com
```

Supabase Edge Function secrets are stored in Supabase, never exposed as `VITE_` variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AI_API_KEY=your-ai-provider-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_FALLBACK_MODELS=
AI_STRICT_JSON=false

PAYMOB_SECRET_KEY=your-paymob-secret-key
PAYMOB_PUBLIC_KEY=your-paymob-public-key
PAYMOB_INTEGRATION_IDS=123456
PAYMOB_HMAC_SECRET=your-paymob-hmac-secret
SITE_URL=https://your-production-domain.com

# Optional error monitoring (Sentry). Leave unset to disable.
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=mailcraft@1.0.0
```

## Local development

Requirements: Node.js 20 or newer.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Run checks:

```powershell
npx tsc --noEmit -p tsconfig.app.json
npm test -- --run
npm run build
```

## CI and quality

Pull requests and pushes to `main` run `.github/workflows/ci.yml`:

- `verify` — `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm test` (Vitest).
- `deno` — Deno tests for the Edge Functions in `supabase/functions` (`deno test supabase/functions`), covering payment URL/integration-ID handling, the AI timeout, and the generation fallback.
- `deploy` — runs only on push to `main` after the above pass, and deploys all five Edge Functions.

Local checks mirror CI:

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test -- --run
deno test supabase/functions
```

## Supabase deployment

The configured project reference is stored in `supabase/config.toml`.

```powershell
npx supabase@latest login
npx supabase@latest link --project-ref uwvschgthdsyevfhdtey
npx supabase@latest db push --linked --yes
npx supabase@latest secrets set --project-ref uwvschgthdsyevfhdtey --env-file .env
```

Deploy all Edge Functions explicitly (or use `npm run deploy:functions` which deploys the same five):

```powershell
npx supabase@latest functions deploy generate-email --project-ref uwvschgthdsyevfhdtey --no-verify-jwt
npx supabase@latest functions deploy ai-content --project-ref uwvschgthdsyevfhdtey --no-verify-jwt
npx supabase@latest functions deploy verify-share-password --project-ref uwvschgthdsyevfhdtey --no-verify-jwt
npx supabase@latest functions deploy create-payment --project-ref uwvschgthdsyevfhdtey --no-verify-jwt
npx supabase@latest functions deploy paymob-webhook --project-ref uwvschgthdsyevfhdtey --no-verify-jwt
```

## Paymob setup

1. Create or activate the Paymob merchant account.
2. Obtain the secret key, public key, integration ID, and HMAC secret.
3. Configure the Supabase secrets listed above.
4. Set this webhook in Paymob:

```text
https://uwvschgthdsyevfhdtey.supabase.co/functions/v1/paymob-webhook
```

5. Test checkout using Paymob test credentials.
6. Confirm that a successful webhook changes the matching `subscriptions` row to `active`.
7. Replace test credentials with live credentials only after the full payment flow succeeds.

Payment status is trusted only from the verified webhook. The browser redirect is used for user experience and does not activate a subscription by itself.

## Deployment

The frontend is configured for Vercel through `vercel.json`:

```powershell
npm run build
```

Set the three `VITE_` variables in Vercel, deploy the repository, and configure the production URL in Supabase Authentication → URL Configuration. Add both the production URL and the local development URL as allowed redirect URLs.

## Security notes

- Never expose Supabase service-role, Paymob secret, HMAC, or AI keys in frontend code.
- Generation, quota, payment, and webhook logic run server-side.
- User-owned data is protected with Supabase RLS policies.
- Paymob callbacks are verified with HMAC before subscription status changes.
- User-provided content is treated as untrusted input by the AI prompt.

## Future expansion

The next product expansions are Gmail/Outlook integration, one-click inbox replies, follow-up reminders, shared agency workspaces, team roles, and reply/outcome analytics.

## Author

**Kareem Hossny** — Full Stack Developer
