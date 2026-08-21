# Agent Bootstrap

On session start, read and apply the global rules from the local clone:

```bash
AG="$HOME/repos/agentGuidance"; [ -d "$AG" ] || AG="$HOME/agentGuidance"; cat "$AG/agent.md"
```

If the clone is missing, continue with the fallback rules below. Do not block on
this. The source repo is private, so an unauthenticated fetch returns 404; the
public mirror is github.com/npezarro/openAgentGuidance (infrastructure-specific
guidance excluded).

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

## Testing Practices

The "CI" section above covers how the suite runs. These are the output-affecting practice rules from `agentGuidance/guidance/testing.md`, incorporated here because this repo has a real Vitest suite (`core.test.js`) around the offer filter/claim/tracking logic in `core.js`.

- **Bug fixes get a regression test.** When fixing a filtering, claim, or tracking bug, first add a test that fails without the fix and passes with it — a regression test for the *class* of bug, not just the one instance.
- **New functions with logic get a unit test** covering the happy path plus edge cases — empty/null/undefined input, boundary conditions (e.g. zero offers, malformed offer objects), and error paths. Config- or copy-only changes need no new test.
- **Mock at boundaries, not internals.** The boundaries here are the DOM, timers/`Date.now()`, and any network/storage access. Stub those rather than reaching into private state, and reset mocks between tests.
- **Test the contract, not the implementation.** Assert on the exported filter/claim/tracking behavior of `core.js`, not private variables, jsdom internals, or Vitest itself. Don't test third-party library behavior.
- **Keep the suite green before every commit.** `npm test` (single run) must pass locally; CI runs the same on push/PR.

## DOM Interaction Gotchas (Auto-Claim Clicking)

From `agentGuidance/guidance/tampermonkey.md`, incorporated here because the auto-claim
flow drives the site by clicking real controls: offer card → opt-in checkbox → "Claim
Offer" → back → next card. A click that silently does nothing means offers go unclaimed
with no error and the loop stalls short of the target, so:

- **Re-query selectors on every iteration; never reuse a node across a click.** Modern
  frameworks replace DOM nodes on each state update, so an element captured before a click
  is detached afterwards and subsequent clicks land on a node no longer in the document —
  no exception, just silence. Add a stall guard: after each click, read the state you
  expected to change (checkbox `aria-checked`, presence of the "Submitted" button, the
  remaining card count) and break or retry if it did not move, rather than assuming the
  click landed.
- **Prefer `<button>` matches over generic text matches.** A non-interactive wrapper
  `<div>` or `<span>` carrying the same text usually appears BEFORE the real `<button>` in
  the DOM, and clicking it does nothing. Query order: `button` elements first (filtered by
  innerText or aria-label), then `[aria-label*="..."]` for icon-only controls, generic text
  search last. `runAutoClaimPageLogic()` already follows this — keep new selectors on the
  same pattern instead of widening to broad `querySelectorAll('div, span')` text scans.
- **Dismiss cookie/consent banners before interacting.** Consent overlays intercept all
  pointer events, so clicks on covered elements fail silently. Dismiss them at the start of
  the flow. If a well-targeted click has no effect, check for an overlay as the first
  diagnostic, before concluding the site changed its markup.
