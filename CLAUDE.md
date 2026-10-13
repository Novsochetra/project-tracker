# Project Tracker

A phone-first project tracker. People capture tickets on their phone; Claude Code agents pick tickets up, work on them, move them to **Need review**, and reviewer agents verify, rate and move them to **Reviewed**. Only a person moves a ticket to **Done**.

Read `docs/architecture.md` before changing anything. The approved visual design lives in `init-design/` (`SPEC.md` + `design/*.dc.html`); match its sizes, colors, copy and motion unless `docs/architecture.md` says the product changed.

## Layout

| Path              | What                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `packages/shared` | Domain types, zod API schemas, pure logic (prompts, report parser, ranks, prefixes, formatting) |
| `packages/client` | Typed HTTP client for the API (used by web, MCP and CLI)                                        |
| `apps/server`     | Hono API, Kysely database layer (SQLite now, Postgres-ready), SSE events, uploads               |
| `apps/web`        | React + Vite PWA, mobile-first, gestures and motion                                             |
| `apps/agent`      | MCP server and CLI that let Claude Code agents use the tracker                                  |

## Commands

```bash
npm run dev          # server on :4100 + web on :5173
npm run verify       # format check, lint, typecheck, unit + integration tests
npm run test:e2e     # Playwright at 375x812 and 1280x800
npm run test:e2e:clean  # the same on a clean copy of HEAD; E2E_API_PORT/E2E_WEB_PORT let two runs share a machine
```

## Code rules

- Simplest solution that works. Small files and functions with one job each. Lint enforces size and complexity limits; split code instead of raising limits.
- No comments that say what code does. Only write a comment to explain **why** something non-obvious is done.
- Lint enforces this for `/** */` blocks in app and package source (`local/no-jsdoc-blocks` in `eslint.config.js`): write a why as a short `//` comment.
- No `TODO`/`FIXME` comments. Put follow-up work in the tracker as a ticket instead.
- Put logic in plain functions with unit tests. Components and route handlers stay thin.
- All colors, type, radii, shadows and motion come from `apps/web/src/design/tokens.css`. No raw hex values in components.
- Never install packages without asking; concurrent installs corrupt `node_modules`.

## Code Style

- Write self-explaining code. Keep comments minimal: no comments that restate what the code does, no section-banner comments, no long JSDoc on obvious functions.
- Only comment non-obvious _why_ (workarounds, protocol quirks, security reasons).

## Git & Commits

- Other Claude sessions often run in this repo at the same time. When committing, stage ONLY files you changed in this session (`git add <paths>`, never `git add -A` or `git add .`). Leave unrelated changes alone, including CLAUDE.md edits.
- Commit to the current branch. Do not push or merge to main unless I explicitly say "push" or "merge to main" in this session.
- Never touch `git stash` (no stash, pop, or drop), and never reset or checkout files you did not modify. Subagents must follow these rules too.
- Never commit build caches or generated artifacts. Check `git status` before each commit.

## Parallel Ticket Workflow (PT-*)

- Run at most 5 parallel workers. Never run more than 2 E2E/Playwright or simulator suites at once, because machine overload causes spurious failures.
- Every worker ticket gets an independent strict reviewer pass. Reviewers must specifically check: secrets or passwords in logs, unbounded memory or regex, auth bypass, data deletion scope, and EXIF/GPS stripping.
- Merge tickets into an integration branch first, then run `npm run verify` and the full test suite after merging.
- Check the bundle size limit after merging.
- If a test fails during a full run, rerun it alone before treating it as a real failure.
- Skip tickets that need a physical device and say so.
- Use the tracker MCP to move ticket status.

## Tests

- Unit tests for pure logic, integration tests for API routes and data access (SQLite and PGlite), component tests for UI behavior, Playwright for flows.
- **Bugs:** first write a failing test that reproduces the bug in `<package>/test/regression/<short-name>.test.ts`, then fix it. The test stays forever.
- Before saying work is done: run `npm run verify`, and for UI changes check both 375px and 1280px.

## Reports

When a message ends with a TICKET / STATUS / SUMMARY / FILES / NEXT template, end your reply with that block filled in.
