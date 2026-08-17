# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.
Contact the maintainer via the email listed in the repository, or use GitHub
private vulnerability reporting if enabled.

Do not include secrets, credentials, or customer data in public issues.

## Secrets handling

- All Supabase, Paymob, and AI credentials are stored as Supabase Edge Function
  secrets or Vercel environment variables. They are never committed and never
  exposed through `VITE_` variables.
- `.env` and `*.local` are gitignored. Only `.env.example` (placeholders) is tracked.
- Payment status is only trusted from the HMAC-verified Paymob webhook. The
  browser redirect is treated as untrusted for entitlement changes.

## Supported versions

Security fixes are applied to the latest `main` branch.
