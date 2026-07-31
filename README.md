# MailCraft AI — Bilingual AI Email Generation Platform

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Radix-000000?style=flat&logo=shadcnui&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20PostgreSQL-3FCF8E?style=flat&logo=supabase&logoColor=white)
![Edge Functions](https://img.shields.io/badge/Edge_Functions-Deno-000000?style=flat&logo=deno&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-Compatible%20API-412991?style=flat&logo=openai&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat&logo=vercel&logoColor=white)

React Vite TypeScript Tailwind CSS Supabase Edge Functions Vercel

Production-ready SaaS for generating professional, fact-grounded business emails in English and Arabic. Built with React, Vite, TypeScript, Tailwind CSS, and shadcn/ui on the frontend, with Supabase Auth, PostgreSQL, and Edge Functions on the backend. AI generation runs server-side through an OpenAI-compatible provider with hallucination validation and deterministic fallbacks.

## Project Structure

```text
src/
├── App.tsx            → Root component with routes and providers
├── main.tsx           → Entry point (createRoot + StrictMode)
├── index.css          → Tailwind, shadcn/ui tokens, global styles
├── assets/            → Static images and visual assets
├── components/
│   ├── ui/            → shadcn/ui primitives (49 components — Radix-based)
│   ├── AppLayout.tsx  → Authenticated app shell (sidebar + header)
│   ├── LanguageToggle.tsx → English / Arabic switcher
│   └── ProtectedRoute.tsx → Auth-gated route wrapper
├── config/            → Runtime env validation (env.ts)
├── contexts/          → AuthProvider, LanguageProvider
├── hooks/             → use-mobile, use-toast
├── i18n/              → English + Arabic translation dictionary (RTL/LTR)
├── lib/               → cn() utility, clsx + tailwind-merge
├── pages/             → Route-level screens (Landing, Generate, History, etc.)
├── services/
│   └── supabase/      → Supabase client + generated types
└── test/              → Vitest setup and tests
supabase/
├── functions/
│   ├── _shared/       → AI provider, prompts, validation service
│   ├── generate-email/        → Protected generation endpoint
│   ├── ai-content/            → AI helper endpoint
│   └── verify-share-password/ → Protected share verification
└── migrations/        → 12 SQL migrations (profiles, history, quotas, plans)
```

## Routes

| Path | Page | Description |
| --- | --- | --- |
| `/` | Landing | Hero, features, how it works, pricing section, FAQ |
| `/login` | Login | Sign in with Supabase Auth |
| `/signup` | Signup | Create an account |
| `/forgot-password` | ForgotPassword | Password reset request |
| `/reset-password` | ResetPassword | Set a new password |
| `/pricing` | Pricing | Free / Pro / Business plan comparison |
| `/app` | Generate | AI email generator (protected) |
| `/app/history` | History | Saved drafts, search, favorites, revisions (protected) |
| `/app/snippets` | Snippets | Reusable text snippets (protected) |
| `/app/account` | Account | Writing profile and preferences (protected) |
| `*` | 404 | Fallback — not found |

## Tech Stack

| Category | Tools |
| --- | --- |
| Framework | React 18 |
| Build | Vite 5 |
| Language | TypeScript 5.8 |
| Routing | React Router 6 |
| Styling | Tailwind CSS 3.4, tailwindcss-animate |
| UI Library | shadcn/ui (49 Radix-based components), Lucide React, Framer Motion |
| Data Fetching | TanStack Query |
| Forms / Validation | React Hook Form, Zod |
| Toasts | Sonner |
| Export | jsPDF, docx, html2canvas |
| Backend | Supabase Auth, Supabase PostgreSQL, Supabase Edge Functions (Deno) |
| AI | OpenAI-compatible chat completions API |
| Linting / Testing | ESLint 9, Vitest + Testing Library |
| Deployment | Vercel |

## AI Generation Flow

```text
User Input → Sanitize → Merge verified profile facts → Generate email JSON
→ Clean clichés/typos → Grounding / fact validation → Regenerate if unsupported
→ Deterministic fallback if still unsafe → Return subject lines, email, scores
```

The AI layer prioritizes trustworthiness over persuasive but unsupported claims, with post-generation validation rather than prompt-only instructions.

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Start dev server
npm run dev

# 4. Open in browser
open http://localhost:8080
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run build:dev` | Build in development mode |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint across the project |
| `npm run test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run deploy:db` | Push Supabase migrations |
| `npm run deploy:functions` | Deploy Edge Functions |
| `npm run deploy:secrets` | Set Edge Function secrets |
| `npm run deploy:supabase` | Deploy database, secrets, and functions |

## Environment Variables

### Frontend (Vercel / local `.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon / publishable key |

### Supabase Edge Function secrets (never store in Vercel)

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (privileged, server-side only) |
| `AI_API_KEY` | AI provider API key |
| `AI_BASE_URL` | AI provider base URL |
| `AI_MODEL` | Primary model (e.g. gpt-4o-mini) |
| `AI_FALLBACK_MODELS` | Comma-separated fallback models |
| `AI_APP_URL` | App URL for context |
| `AI_APP_NAME` | App name for context |

## Deployment (Vercel)

1. Push the repository to GitHub
2. Import the project in Vercel
3. Set framework preset to **Vite** (build: `npm run build`, output: `dist`)
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Deploy

`vercel.json` includes an SPA rewrite, so client-side routes (`/pricing`, `/app/history`, `/app/account`, etc.) will not 404 on refresh.

Backend is deployed separately to Supabase:

```bash
npx supabase@latest link --project-ref your-project-ref
npm run deploy:supabase
```

## Design

- **Localization:** English + Arabic with RTL/LTR layout switching
- **UI:** shadcn/ui components, dark-mode capable, responsive desktop/mobile
- **Animations:** Framer Motion transitions
- **Typography & palette:** Tailwind defaults, custom utility classes via `cn()`
- **Exports:** Copy, TXT, PDF (jsPDF), and DOCX (docx) email export

## 👨‍💻 Author

**Kareem Hossny** — Full Stack Developer
Open to freelance and junior full-stack opportunities.
