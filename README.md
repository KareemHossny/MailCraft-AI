# MailCraft AI — Bilingual AI Email Generation Platform

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Radix-000000?style=flat&logo=shadcnui&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20PostgreSQL-3FCF8E?style=flat&logo=supabase&logoColor=white)
![Edge Functions](https://img.shields.io/badge/Edge_Functions-Deno-000000?style=flat&logo=deno&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-Compatible%20API-412991?style=flat&logo=openai&logoColor=white)
![Paymob](https://img.shields.io/badge/Paymob-Payments-00B5B8?style=flat&logo=paymob&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat&logo=vercel&logoColor=white)

React Vite TypeScript Tailwind CSS Supabase Edge Functions Paymob Vercel

Production-ready **SaaS** for generating professional, fact-grounded business emails in English and Arabic. Built with React, Vite, TypeScript, Tailwind CSS, and shadcn/ui on the frontend, with Supabase Auth, PostgreSQL, and Edge Functions on the backend. AI generation runs server-side through an OpenAI-compatible provider with hallucination validation and deterministic fallbacks, monetized through a subscription model with working **Paymob** payment integration (Free / Pro / Business plans).

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
| `/pricing` | Pricing | Free / Pro / Business plans with working Paymob checkout |
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
| Payments | Paymob (EGP checkout, subscription plans) |
| Linting / Testing | ESLint 9, Vitest + Testing Library |
| Deployment | Vercel |

## AI Generation Flow

```text
User Input → Sanitize → Merge verified profile facts → Generate email JSON
→ Clean clichés/typos → Grounding / fact validation → Regenerate if unsupported
→ Deterministic fallback if still unsafe → Return subject lines, email, scores
```

The AI layer prioritizes trustworthiness over persuasive but unsupported claims, with post-generation validation rather than prompt-only instructions.

## SaaS Subscription & Payments

- **Plan catalog** — Free (15 emails/mo), Pro (500/mo), Business (3000/mo) with EGP pricing
- **Paymob checkout** — Working payment integration; `plans.paymob_amount_cents` drives the amount
- **Subscriptions** — Server-side written rows (`subscriptions.paymob_order_id`), one active plan per user
- **Quotas & rate limiting** — Monthly usage counters per user + 6 generations/min rate limit, enforced server-side

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Start dev server
npm run dev
```

7. Build for production:

```bash
npm run build
```

8. Run tests:

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
