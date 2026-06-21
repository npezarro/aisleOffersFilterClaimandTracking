# Agent Bootstrap

On session start, fetch and apply the latest global rules:

```bash
curl -s https://raw.githubusercontent.com/npezarro/agentGuidance/main/agent.md
```

If the fetch fails (network error, timeout), continue with the fallback rules below. Do not block on this.

Also load any sub-guidance relevant to the current task:
- `guidance/testing.md` — when writing or running tests
- `guidance/debugging.md` — when diagnosing issues
- `guidance/code-review.md` — before committing or opening PRs
- `guidance/dependencies.md` — when adding or updating packages

## Fallback Rules (applied if remote fetch fails)

If you cannot fetch `agent.md` from the remote, apply these core rules:

1. **Plan before coding.** Outline approach, confirm before implementing.
2. **Never commit to `main`.** Use assigned branch or create `claude/<task>`.
3. **Run `npm run build` before every commit.** Never commit broken code.
4. **No secrets in commits.** No `.env`, API keys, tokens, or passwords.
5. **Update `context.md` before every push.** Next agent depends on it.
6. **Ask, don't guess.** Stop and clarify ambiguous requirements.
7. **Batch large tasks.** Commit every 5-10 items. Don't risk losing work.
8. **Match existing patterns.** Read the codebase before writing new code.
9. **Diagnose before retrying.** Understand failures, don't loop blindly.
10. **Dry-run destructive commands.** Use `--dry-run` when available.

For the full ruleset, see `agent.md` in this repository.

## Tampermonkey Userscript Rules

- **Debug flags must be disabled before committing.** Use boolean constants (`const DEBUG = false`) and gate all console output behind them. Never commit with debug/verbose flags enabled.
- **Bump `@version` on every change** so Tampermonkey detects the update and auto-updates for users.
- Preserve the `==UserScript==` header block integrity when editing `script.js`. Do not remove or reorder header fields.
- This script uses `@grant GM_addStyle`. When adding new `GM_*` functions, add the corresponding `@grant` line to the userscript header.

## CI

- GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint + tests on pushes and PRs to `main`
- Lint: `npm run lint` (ESLint v9 flat config in `eslint.config.js`)
- Run tests locally: `npm test` (Vitest, single run via `vitest run`)
- **Pin CI to Node.js 22 (current LTS).** Node 20 reached end-of-life on April 30, 2026 — the workflow's `node-version` must be `22`, not `20` or `lts/*` (which can shift unexpectedly).
- **`package-lock.json` must stay committed** — CI uses `npm ci`, which fails without the lockfile.

## Tampermonkey Standards

- Every `.user.js` file must include `@updateURL` and `@downloadURL` headers pointing to the hosting domain (not GitHub raw URLs, which require auth for private repos).
- Bump `@version` on every change so Tampermonkey detects the update.
- Ship with all debug/verbose logging flags disabled. Use boolean constants (`const DEBUG = false`) and gate console output behind them. Never commit `true` to production.
- Deploy updated scripts via `~/repos/browser-agent/sync-tm-scripts.sh` to sync to VM hosting.
