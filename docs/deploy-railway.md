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
- refuses to start, and the pre-deploy command refuses to migrate, unless `DATABASE_URL` is a `postgres://` URL (or a SQLite file on the service's volume, `RAILWAY_VOLUME_MOUNT_PATH`), and unless files go to S3 (`S3_BUCKET`) or to an `UPLOADS_DIR` on that volume: a deployment's own disk is replaced by the next deploy, so data kept there would be lost. The message never shows the value, which may hold the password.

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
PORT=4100
TRUST_PROXY=1
S3_BUCKET=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

- `${{Postgres.DATABASE_URL}}` is the database's private address (no SSL needed). Paste it as it is, without quotes. If you renamed the database service, use its name.
- `PORT=4100` fixes the port the tracker listens on, so the domain in step 4 can point at it before anything has run.
- `NODE_ENV`, `HOST` and `TRUST_PROXY` are set for you on Railway anyway; writing them down keeps them visible.
- Leave `MIGRATE_ON_START` unset: the pre-deploy command migrates.
- Every variable and what it means: `.env.example`.

## 4. Give it a public address

Tracker service → **Settings** → **Networking** → **Generate Domain**. If it asks for a target port, enter `4100` (the `PORT` from step 3). You get `https://<name>.up.railway.app`. To use your own domain later, add it there and set `PUBLIC_URL=https://your.domain`.

## 5. Deploy

1. Click **Deploy** on the staged changes (or push a commit).
2. Watch **Deployments** → the new one:
   - Build logs end with `npm prune` and no errors.
   - Pre-deploy logs: `Applied 0001_initial` … `Up to date.`
   - Deploy logs: `Files in S3 bucket <your bucket> (<region>)`, `Tracker API on http://0.0.0.0:4100 (database: Postgres railway on postgres.railway.internal:5432)`, `Agents connect at https://<name>.up.railway.app`.
3. It turns **Active** once `/api/health` answers. Open `https://<name>.up.railway.app/api/health`: `{"ok":true}`.

## 6. Set the owner password

Until then every request is refused (the log says so). With the [Railway CLI](https://docs.railway.com/cli) on your Mac (`brew install railway`):

```bash
railway login
railway link          # in the repo folder: pick the project and the tracker service
railway ssh           # a shell inside the running tracker
cd /app               # where Railpack puts the app
node apps/server/dist/db.js status      # must say "Database: Postgres railway on postgres.railway.internal:5432"
node apps/server/dist/owner-set.js --email you@example.com
exit
```

`db.js status` shows the shell has the service's variables: if it names SQLite instead, stop, since the owner would go into a throwaway file. `owner-set.js` asks for the password twice, hidden (at least 12 characters). Run it again later to change the email or password; that signs out every device. The log's hint `npm run owner:set` is the same command for a local checkout.

Without `railway ssh`, the same works from your Mac on the exact commit that is deployed: copy `DATABASE_PUBLIC_URL` from the Postgres service's **Variables**, then

```bash
read -rs DB    # paste the URL, it isn't shown
DATABASE_URL="$DB?sslmode=require" npm run owner:set -- --email you@example.com
```

## 7. Open it on your phone

1. Safari → `https://<name>.up.railway.app` → sign in.
2. **Share** → **Add to Home Screen**. It opens full screen like an app. HTTPS also turns on offline support and the clipboard.

## 8. Connect Claude Code agents

Agents on your Mac reach the online tracker with its address and an API token you create in the app. Follow README → **Connect Claude Code**, "To an online tracker", with `https://<name>.up.railway.app`:

1. In the app on the phone or the Mac: project menu (•••) → **Connect Claude Code** → **API tokens** → name it ("Claude laptop") → **Create token** → **Copy token** (shown once).
2. On the Mac, in the repo folder:

   ```bash
   npm run build -w @tracker/agent
   node apps/agent/dist/cli.js login --url https://<name>.up.railway.app   # paste the token when asked
   claude mcp add tracker -s user --env TRACKER_URL=https://<name>.up.railway.app --env TRACKER_AGENT_NAME=Claude -- node "$(pwd)/apps/agent/dist/mcp.js"
   ```

   Registered `tracker` for the local tracker before? Run `claude mcp remove tracker -s user` first.

3. Restart Claude Code and check with `node apps/agent/dist/cli.js projects`.

## 9. Your current data

A one-time command copies your local tracker (`data/tracker.db` and `data/uploads`) into Railway's Postgres and your S3 bucket: every project, status, ticket, comment, report, review and file, with the same ids, so ticket keys (PT-1…), ranks, counters and links stay as they are. Run it once, after the first deploy and setting the owner (step 6), before you use the online tracker.

- **It only reads your local data.** It backs `data/tracker.db` up to a temporary copy and migrates the copy (your local tracker may be on an older schema); the file and the folder are never changed.
- **Images are compressed** as new uploads are (`docs/architecture.md` §3), and only the compressed copy goes to S3: a screenshot `….png` becomes `….webp`, with the same id, so its tile, its place and links to it stay. Text that names a file by its old name still reads the same; the command says how many texts do. Other files are copied as they are.
- **Not copied:** sign-in (`users`, `sessions`, `api_tokens`). The online owner is the one you set in step 6; make new API tokens online for your agents (step 8).
- **Files first, rows after.** The rows go in one transaction, so a run that stops halfway (network, a refused upload) leaves no row pointing at a missing file. Run the same command again: it starts over, writing the files again under the same keys.
- **It refuses** a database that already holds projects or tickets, and says what is there (`--allow-existing` adds your data next to them), and refuses outright when your data is already there.

It runs on your Mac and reaches Railway's Postgres through its public address: the service's own `DATABASE_URL` (`postgres.railway.internal`) works only inside Railway. Your Mac needs the exact commit Railway deployed and the S3 settings in `.env`.

1. Stop your local Claude Code agents and the local tracker (Ctrl-C where `npm run dev` or `node apps/server/dist/main.js` runs), so nothing changes after the copy.
2. Take a final backup and build:

   ```bash
   git status && git log -1 --oneline      # clean, and the commit Railway's deployment shows
   mkdir -p data/backups
   sqlite3 data/tracker.db ".backup data/backups/tracker-$(date +%Y%m%d-%H%M)-before-move.db"
   cp -R data/uploads "data/backups/uploads-$(date +%Y%m%d-%H%M)"
   npm run build -w @tracker/server
   ```

3. Copy `DATABASE_PUBLIC_URL` from the Postgres service's **Variables** (if it isn't there: Postgres → **Settings** → **Networking** → **TCP Proxy**), then look first with a dry run, which changes nothing:

   ```bash
   read -rs DB    # paste the URL, it isn't shown
   DATABASE_URL="$DB?sslmode=require" node --env-file=.env apps/server/dist/data-move.js \
     --from data/tracker.db --uploads data/uploads --dry-run
   ```

   It prints where it goes (`Postgres railway on <host>:<port>; files in S3 bucket <name>`, never the password or a key), the rows per table, the files and their size, and how many images it would compress. `DATABASE_URL` on the command line wins over the one in `.env`; `.env` gives the S3 bucket, region and keys.

4. Move, with the same command without `--dry-run`:

   ```bash
   DATABASE_URL="$DB?sslmode=require" node --env-file=.env apps/server/dist/data-move.js \
     --from data/tracker.db --uploads data/uploads
   unset DB
   ```

   It ends with `Checked: the target has every row moved (…) and every attachment's file, at its size. Done.`: it counted every table's rows in Postgres by id and asked S3 for every file's size. Anything else says what is wrong and that nothing was moved, or which rows or files the check found missing.

5. Check it yourself: on the phone the project shows its tickets with the same keys, a ticket with a screenshot shows it, and a new ticket gets the next number. The S3 console lists the files under `attachments/` as `<id>.webp` (and other files as they were). From now on use only the online tracker; keep `data/` as your backup.

With exported variables, `npm run data:move -- --from data/tracker.db --uploads data/uploads` runs the same from the source.

## Backups

- **Railway:** Postgres service → **Backups** → **Create backup** before any risky change, and add a **Daily** schedule (kept 6 days). Restore from the same tab (it mounts the backup as a new volume; click **Deploy**).
- **Your own copy** (needs `brew install libpq`, whose `pg_dump` must be at least the server's version):

  ```bash
  read -rs DB    # DATABASE_PUBLIC_URL from the Postgres service
  "$(brew --prefix libpq)/bin/pg_dump" "$DB?sslmode=require" -Fc -f tracker-$(date +%F).dump
  ```

  Restore into an empty database with `"$(brew --prefix libpq)/bin/pg_restore" --no-owner -d "$DB?sslmode=require" tracker-<date>.dump` (Homebrew's libpq isn't on your `PATH`).

- **Files:** S3 keeps them; turn on bucket versioning if you want deleted files to be recoverable.

## Rolling back

- **A release without new migrations:** **Deployments** → an earlier deployment → **⋮** → **Redeploy**. Or `git revert` the commit and push.
- **A release that added migrations** (its pre-deploy log said `Applied …`): an older build refuses a database with migrations it doesn't know, so undo them first, with the new build:
  1. Take a Railway backup (a migration's undo drops what it added, data included).
  2. `railway ssh` into the tracker, `cd /app`, then `node apps/server/dist/db.js rollback` (says which migration it would undo) and `node apps/server/dist/db.js rollback --yes`, once per migration that release added.
  3. Redeploy the earlier deployment.

  Between steps 2 and 3 the running server may fail requests that need what was undone.

- **A release that migrated but never went Active** (pre-deploy said `Applied …`, then the new server failed its health check or crashed): Railway keeps the old server serving, but the database now has a migration the old build doesn't know. The old server refuses to start again if it restarts, its `db.js rollback` refuses too, and so does the pre-deploy of a revert you push. Either:
  - **Fix forward (simplest):** push a commit that fixes the new release. Its build has the migration, so its pre-deploy has nothing to do and its server starts.
  - **Or undo the migration from your Mac**, with the failed release's own code, then go back:

    ```bash
    git worktree add /tmp/tracker-undo <the failed release's commit>   # the commit its deployment shows
    cd /tmp/tracker-undo && npm ci
    read -rs DB    # DATABASE_PUBLIC_URL from the Postgres service; take a Railway backup first
    DATABASE_URL="$DB?sslmode=require" npm run db:status             # its new migration: applied
    DATABASE_URL="$DB?sslmode=require" npm run db:rollback -- --yes  # once per migration it added
    unset DB
    cd - && git worktree remove --force /tmp/tracker-undo
    ```

    The old server can then restart, and a revert of the release deploys.

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
