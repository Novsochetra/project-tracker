# Tracker

A phone-first project tracker made for working with any AI agent: Claude Code, Codex, Cursor, Gemini CLI, Copilot or another one with MCP or a shell.

- Capture an idea on your phone in a few taps.
- Agents pick up tickets, work on them, and move them to **Need review**.
- Reviewer agents check the work against the ticket, rate it 1–5, and move it to **Reviewed** — or send it back with feedback.
- You move it to **Done**.

```
To do ──claim──▶ In progress ──submit──▶ Need review ──approve──▶ Reviewed ──you──▶ Done
   ▲                                          │
   └──────────────── request changes ─────────┘
```

## Quick start

```bash
npm install
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:4100
- Sample data (optional, while `npm run dev` runs): `npm run seed`
  - It works against a local tracker with no owner yet. Once there is an owner, `TRACKER_TOKEN` doesn't help: a token acts as an agent and only a person can create projects, so the seed gets 403.

Production-style single process (serves the built web app and the API on one port):

```bash
npm run build
npm start
```

Data lives in `data/` (SQLite database and uploaded images).

## Use it on your phone

The server listens on `127.0.0.1` by default. To reach it from your phone:

1. Set up the owner account once (see Sign-in below), then start it on all interfaces:

   ```bash
   npm run owner:set -- --email you@example.com
   HOST=0.0.0.0 npm start
   ```

2. Open `http://<your-computer's-LAN-IP>:4100` on the phone and sign in. Over plain http, Connect an agent gives the agent commands for `http://localhost:4100`, to run on this computer: agents send their token over http only to their own computer.
3. Add it to the home screen (Safari: Share → Add to Home Screen). It opens full screen like an app.

## Sign-in

The owner account signs in with an email and password. There is no open sign-up: the owner invites other people (below). Set the owner up, or change its email or password, with:

```bash
npm run owner:set -- --email you@example.com   # asks for the password twice, hidden
```

The password is typed (or piped in as the first line of standard input), never put in env vars or arguments; the database keeps only a scrypt hash. It uses the server's database: the local SQLite file, or `DATABASE_URL` (a Postgres database must be migrated first). In a built deploy the same command is `node apps/server/dist/owner-set.js --email you@example.com`. Running it again signs out every device; API tokens keep working.

**More people.** The owner makes an invite link in the app (Account, Invite someone). It works once, for 7 days; the person opens it, picks a name, email and password, and is signed in. Every account sees only the projects it made, the owner's included, and its own API tokens; anyone else asking for one of them gets 404. Projects made before an owner existed go to the owner when owner-set creates it. Anyone signed in changes their own password in Account (Change password), which signs out their other devices; API tokens keep working. For a forgotten or leaked password the owner makes a reset link for that person (Account, People); it works once, for 24 hours, and signs them out everywhere. Accounts can't be removed yet.

Without an owner, a server on `127.0.0.1` (not behind a proxy, and without `TRACKER_TOKEN` set) answers requests made on this machine only, as local use always did; other devices, including a phone using `npm run dev` over the LAN, must sign in. Anywhere else it refuses every request until the owner is set. A proxy or tunnel on this machine (`ssh -R`, `socat`, a bare nginx) makes the requests it passes on look local, so set the owner before using one. Agents use API tokens the owner creates in the app (`Authorization: Bearer trk_…`, saved with `tracker login` or set as `TRACKER_API_TOKEN`; see Connect an agent below). Details: `docs/architecture.md` §3.1.

For HTTPS (needed for offline support and the clipboard API), the easiest route is [Tailscale](https://tailscale.com): `tailscale serve --bg 4100`, then open the `https://…ts.net` address on your phone. Start the server with `PUBLIC_URL=https://<your-machine>.ts.net` so Connect an agent shows that address.

## Database

SQLite by default (`data/tracker.db`), migrated when the server starts. For Postgres (Railway), set `DATABASE_URL=postgres://…` and migrate before the server starts; it refuses a database that isn't at its migrations.

```bash
npm run db:status              # each migration: applied, pending, or from a newer build
npm run db:migrate             # run the pending ones, all in one transaction
npm run db:rollback -- --yes   # undo the last one (without --yes it only says which)
```

A deploy runs `node apps/server/dist/db.js migrate` before starting the new server. Postgres settings: `sslmode` in the URL or `PGSSLMODE` (`require` for an address with a self-signed certificate), `DATABASE_POOL_MAX` (10), `DATABASE_STATEMENT_TIMEOUT_MS` (30000), `MIGRATE_ON_START=1` to migrate on start instead. How it works and the rules for a new migration: `docs/architecture.md` §2.1.

## Deploy to Railway

To use the tracker from anywhere, deploy it to [Railway](https://railway.com) from a private GitHub repo; each push to `main` deploys again once CI has passed on it. `.railway/railway.ts` holds the build (`npm run build`, then dev dependencies pruned), the pre-deploy migration, the start command, the health check (`/api/health`) and the wait for CI; `railway config apply` sends it to the service. In short:

1. Push the repo to a private GitHub repo.
2. In Railway: a new project with PostgreSQL, then add the GitHub repo as a service (one replica).
3. Set the service's variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `NODE_ENV=production`, `HOST=0.0.0.0`, `TRUST_PROXY=1`, and the S3 bucket and keys (`docs/s3-storage.md`). Every variable: `.env.example`.
4. Generate a domain, send the settings (`railway link`, `railway config plan`, `railway config apply`), deploy, then set the owner once inside the service: `railway ssh`, `node apps/server/dist/owner-set.js --email you@example.com`.
5. Once, right after setting the owner and before using it: build the server on the commit Railway deployed (`npm run build -w @tracker/server`; an older build lacks the move's checks), then move your local tracker in with `DATABASE_URL="$DB" PGSSLMODE=require node --env-file=.env apps/server/dist/data-move.js --from data/tracker.db --uploads data/uploads`, where `DB` holds the Postgres service's public URL (try `--dry-run` first; `docs/deploy-railway.md` step 7).
6. Open the address on your phone and add it to the home screen.

Step by step, with backups and rollback: `docs/deploy-railway.md`.

## Connect an agent

The app's project menu (•••) → **Connect an agent** shows this tracker's address, its API tokens and these commands with copy buttons. Run them once on your computer, in your project-tracker folder.

The tracker's MCP server (`node apps/agent/dist/mcp.js`, with `TRACKER_URL`) works with any agent that takes MCP servers, and the `tracker` CLI with any agent that runs shell commands. The commands below use Claude Code as the example; for another agent, add the same MCP server in its own settings.

On this computer, with the tracker open (no owner yet), build the agent tools and register the MCP server with Claude Code (user scope makes it available in every project):

```bash
npm run build -w @tracker/agent
claude mcp add tracker -s user --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node "$(pwd)/apps/agent/dist/mcp.js"
```

`TRACKER_AGENT_NAME` (or the CLI's `--as`) is the name the activity shows, "Agent" when it is not set. "You" and "User" are refused: they are the person's.

To an online tracker (Railway), or any tracker with an owner, agents need an API token:

1. In the app, open **Connect an agent** → **API tokens**, name a token (like "Work laptop") and **Create token**. **Copy token**: it is shown only once.
2. On your computer, in your project-tracker folder (the last command is Claude Code's):

   ```bash
   npm run build -w @tracker/agent
   node apps/agent/dist/cli.js login --url https://your-tracker.up.railway.app   # paste the token when asked
   claude mcp add tracker -s user --env TRACKER_URL=https://your-tracker.up.railway.app --env TRACKER_AGENT_NAME=Claude -- node "$(pwd)/apps/agent/dist/mcp.js"
   ```

   `login` checks the token with the tracker and saves it in `~/.config/project-tracker/config.json`, which only you can read; the MCP server and the CLI both read it, so the token stays out of your shell history and your agent's settings. Instead you can set `TRACKER_API_TOKEN` (and `TRACKER_URL`) in the environment, which wins over the saved file. Registered `tracker` before? Run `claude mcp remove tracker -s user` first.

3. Restart your agent (in Claude Code, `/mcp` does it too) and check with `node apps/agent/dist/cli.js projects`.

To revoke: **Connect an agent** → **API tokens** → **Revoke** next to the token. Agents using it get "refused the token … it was revoked" at once. `node apps/agent/dist/cli.js logout --url …` removes the saved copy from your computer.

In any repository, the agent then has the tracker tools and two prompts, `work` and `review`. In Claude Code they are slash commands:

- `/mcp__tracker__work` — claim the next ticket in a project, do the work, submit it for review.
- `/mcp__tracker__review` — review tickets in **Need review**, rate them, approve or request changes.

Agents never move tickets to **Done**. See `apps/agent/README.md` for the tools and the `tracker` CLI.

## Development

```bash
npm run verify     # format, lint, typecheck, unit + integration tests
npm run test:e2e   # Playwright: iPhone-sized WebKit, desktop Chromium, and an iPad (WebKit) for the tap shields
```

- Architecture and product decisions: `docs/architecture.md`
- Code rules: `CLAUDE.md`
- Original design hand-off: `init-design/`

Configuration (environment variables): `PORT` (4100), `HOST` (127.0.0.1), `DATABASE_URL` (SQLite file path, `:memory:`, or `postgres://…`), `UPLOADS_DIR`, `S3_BUCKET` with `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and an optional `S3_ENDPOINT` (files in S3 instead of `UPLOADS_DIR`: `docs/s3-storage.md`), `WEB_DIST`, `PUBLIC_URL` (the address agents should use, shown in Connect an agent; defaults to the address the request reached), `TRUST_PROXY` (how many proxies in front add to `X-Forwarded-For`, `1` on Railway: sign-in limits then count the client's address, and `X-Forwarded-Proto: https` makes the session cookie Secure), `NODE_ENV=production` (session cookie always Secure). The server no longer reads `TRACKER_TOKEN`; agents use it for their API token.
