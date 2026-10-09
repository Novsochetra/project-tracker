# Deploying to Railway

The tracker runs on [Railway](https://railway.com) as one service built from your private GitHub repo, next to a Railway Postgres database. Files go to your S3 bucket (`docs/s3-storage.md`). Every push to `main` deploys again. You open it on your phone at `https://<name>.up.railway.app`.

## How a deploy runs

`railway.json` at the repo root tells Railway everything, so the service needs no build settings in the dashboard:

| Step       | What runs                                                      | Why                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder    | Railpack (Railway's default builder), Node 22                  | Node comes from `engines` in `package.json` (`22.x`). Railpack's Debian image takes the prebuilt Linux binaries of `sharp` and `better-sqlite3`.                                                  |
| Install    | `npm ci` (Railpack's own step)                                 | Exactly the lockfile, optional packages included, so `@img/sharp-linux-x64` and `@img/sharp-libvips-linux-x64` install.                                                                           |
| Build      | `npm run build && NPM_CONFIG_PRODUCTION= npm prune --omit=dev` | Builds the web app, server and agent, then drops dev dependencies (node_modules 511 MB → 187 MB). Railpack sets `NPM_CONFIG_PRODUCTION=false`, which makes npm keep them, so the prune clears it. |
| Pre-deploy | `node apps/server/dist/db.js migrate`                          | Runs pending migrations in a separate container before the new server starts. If one fails, the deploy stops and the old server keeps serving (`docs/architecture.md` §2.1).                      |
| Start      | `node apps/server/dist/main.js`                                | Node itself, not `npm start`, so it gets Railway's SIGTERM. It serves the web app (`apps/web/dist`) and the API on Railway's `PORT`.                                                              |
| Health     | `GET /api/health` must answer 200 within 120 s                 | Only then does Railway send traffic to the new server. It needs no sign-in, and the server answers only after its database check passed.                                                          |
| Stop       | SIGTERM, then SIGKILL after 15 s (`drainingSeconds`)           | The old server takes no new connections, closes live-update streams (phones reconnect to the new one), gives requests under way 10 s, then closes the database pool.                              |
| Restart    | On failure, up to 10 times                                     |                                                                                                                                                                                                   |

On Railway (`RAILWAY_ENVIRONMENT_ID` is set) the server also:

- listens on `0.0.0.0`, trusts one proxy (`TRUST_PROXY=1`: Railway's edge sets `X-Forwarded-For` and `X-Forwarded-Proto`), and tells agents `https://<RAILWAY_PUBLIC_DOMAIN>` (`PUBLIC_URL`), unless you set those variables;
- refuses to start without `DATABASE_URL`, and without `S3_BUCKET` (or `UPLOADS_DIR` on a volume): a deployment's own disk is replaced by the next deploy, so data kept there would be lost.

Why Railpack and not a Dockerfile: the commands above are all there is, and they were run as written on a clean copy of the repo (install, build, prune, migrate, start, sign-in, upload, SIGTERM); there is no Docker on the Mac to prove a Dockerfile, and Railway keeps Railpack's base images up to date.

## Before you start

- A GitHub account and a Railway account.
- The S3 bucket and the IAM user's keys from `docs/s3-storage.md` (they are in your local `.env`).
- This repo on your Mac with all work committed on `main`.

## 1. Put the code in a private GitHub repo

1. On github.com: **New repository** → name it `project-tracker` → **Private** → no README, .gitignore or license → **Create repository**.
2. In the repo folder on your Mac:

   ```bash
   git remote add origin https://github.com/<you>/project-tracker.git
   git push -u origin main
   ```

3. Open the repo on github.com and check there is no `.env` and no `data/` folder (both are in `.gitignore`).

## 2. Create the Railway project

1. railway.com → **New Project** → PostgreSQL (under Database). Keep the service name `Postgres`.
2. In the project: **Create** → **GitHub Repo** → the first time, let Railway's GitHub app see only `project-tracker` → pick `project-tracker`. A first deploy starts; it fails until the variables are set. That is fine.
3. Keep **one replica** (the default). Sign-in limits and live updates live in the server's memory, so a second replica would not see the first one's. Leave **Serverless** (app sleeping) off.

## 3. Set the variables

Open the tracker service → **Variables** → **Raw Editor**, paste this and fill in the four AWS values from your `.env` (type them here only, never in chat or tickets):

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
HOST=0.0.0.0
TRUST_PROXY=1
S3_BUCKET=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

- `${{Postgres.DATABASE_URL}}` is the database's private address (no SSL needed). If you renamed the database service, use its name.
- `NODE_ENV`, `HOST` and `TRUST_PROXY` are set for you on Railway anyway; writing them down keeps them visible.
- Leave `MIGRATE_ON_START` unset: the pre-deploy command migrates.
- Every variable and what it means: `.env.example`.

## 4. Give it a public address

Tracker service → **Settings** → **Networking** → **Generate Domain**. You get `https://<name>.up.railway.app`. To use your own domain later, add it there and set `PUBLIC_URL=https://your.domain`.

## 5. Deploy

1. Click **Deploy** on the staged changes (or push a commit).
2. Watch **Deployments** → the new one:
   - Build logs end with `npm prune` and no errors.
   - Pre-deploy logs: `Applied 0001_initial` … `Up to date.`
   - Deploy logs: `Files in S3 bucket <your bucket> (<region>)`, `Tracker API on http://0.0.0.0:<port> (database: Postgres)`, `Agents connect at https://<name>.up.railway.app`.
3. It turns **Active** once `/api/health` answers. Open `https://<name>.up.railway.app/api/health`: `{"ok":true}`.

## 6. Set the owner password

Until then every request is refused (the log says so). With the [Railway CLI](https://docs.railway.com/cli) on your Mac (`brew install railway`):

```bash
railway login
railway link          # in the repo folder: pick the project and the tracker service
railway ssh           # a shell inside the running tracker
node apps/server/dist/owner-set.js --email you@example.com
exit
```

It asks for the password twice, hidden (at least 12 characters). Run it again later to change the email or password; that signs out every device. The log's hint `npm run owner:set` is the same command for a local checkout.

Without `railway ssh`, the same works from your Mac on the exact commit that is deployed: copy `DATABASE_PUBLIC_URL` from the Postgres service's **Variables**, then

```bash
read -rs DB    # paste the URL, it isn't shown
DATABASE_URL="$DB?sslmode=require" npm run owner:set -- --email you@example.com
```

## 7. Open it on your phone

1. Safari → `https://<name>.up.railway.app` → sign in.
2. **Share** → **Add to Home Screen**. It opens full screen like an app. HTTPS also turns on offline support and the clipboard.

## 8. Connect Claude Code agents

Agents on your Mac reach the online tracker with `TRACKER_URL=https://<name>.up.railway.app` and an API token you create in the app. **Placeholder until PT-125 lands:** its README section will have the exact MCP and CLI setup. The paths Connect Claude Code shows are the server's own (`/app/...`); use your local checkout's `apps/agent/dist/mcp.js`.

## 9. Your current data

Moving the local SQLite data and files to Postgres and S3 is PT-124 (a one-time script, run with your go-ahead).

## Backups

- **Railway:** Postgres service → **Backups** → **Create backup** before any risky change, and add a **Daily** schedule (kept 6 days). Restore from the same tab (it mounts the backup as a new volume; click **Deploy**).
- **Your own copy** (needs `brew install libpq`, whose `pg_dump` must be at least the server's version):

  ```bash
  read -rs DB    # DATABASE_PUBLIC_URL from the Postgres service
  "$(brew --prefix libpq)/bin/pg_dump" "$DB?sslmode=require" -Fc -f tracker-$(date +%F).dump
  ```

  Restore into an empty database with `pg_restore --no-owner -d "$DB?sslmode=require" tracker-<date>.dump`.

- **Files:** S3 keeps them; turn on bucket versioning if you want deleted files to be recoverable.

## Rolling back

- **A release without new migrations:** **Deployments** → an earlier deployment → **⋮** → **Redeploy**. Or `git revert` the commit and push.
- **A release that added migrations** (its pre-deploy log said `Applied …`): an older build refuses a database with migrations it doesn't know, so undo them first, with the new build:
  1. Take a Railway backup (a migration's undo drops what it added, data included).
  2. `railway ssh` into the tracker, then `node apps/server/dist/db.js rollback` (says which migration it would undo) and `node apps/server/dist/db.js rollback --yes`, once per migration that release added.
  3. Redeploy the earlier deployment.

  Between steps 2 and 3 the running server may fail requests that need what was undone.

## Limits worth knowing

- Railway ends a request after 15 minutes, and an upload must arrive within 5 minutes: live updates simply reconnect, but a 100 MB video needs an upload speed of about 3 Mbit/s or more.
- The health check runs only during a deploy; Railway doesn't watch it afterwards. **Restart on failure** brings a crashed server back.
- Pushing anything to `main` deploys. In **Settings** you can turn on **Wait for CI** so a deploy waits for GitHub Actions (`npm run verify`) to pass.

## First deploy: what to check

What could only be proved on Railway itself:

- Build logs show Node 22 and `npm ci` installing `@img/sharp-linux-x64`; the start log has no `sharp` load error.
- Pre-deploy migrated, the deploy went Active, `/api/health` answers on the public address.
- Sign in on the phone; the cookie works (it is `Secure`).
- Upload a photo to a ticket: it is stored as WebP in the bucket under `attachments/`.
- Keep a ticket open on the phone and change it from the Mac: the change shows up right away (live updates through Railway's proxy).
- Push a small commit: the old deployment's logs end without errors, and the phone reconnects to the new one.
