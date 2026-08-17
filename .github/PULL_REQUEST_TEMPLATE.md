# Pull Request

## What does this PR do?

-

## Related issue

-

## Checklist

- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit -p tsconfig.app.json` passes
- [ ] `npm test` (Vitest) passes
- [ ] Edge Function changes include `deno test supabase/functions` (or CI is green)
- [ ] No secrets committed; `.env` and `*.local` remain gitignored
- [ ] Migrations / Supabase secrets updated if schema or config changed
- [ ] Deploy steps documented in the PR description if behavior changed
