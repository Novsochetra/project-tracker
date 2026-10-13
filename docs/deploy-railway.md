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
- Notifications need nothing here: without `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` the tracker makes its own push keys once and keeps them in the database. To bring your own pair (from any web-push key generator, such as `npx web-push generate-vapid-keys` on your Mac), set both, and `VAPID_SUBJECT=mailto:you@example.com` if you like (default: the tracker's https address). Changing the keys later means turning notifications off and on again on each phone.
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

Until then every request is refused (the log says so). With the [Railway CLI](https://docs.railway.com/cli) on your Mac (`brew install railway`), in the repo folder: `railway link` asks for the project and the tracker service, `railway ssh` opens a shell inside the running tracker, and `/app` is where Railpack puts the app. `db.js status` must say `Database: Postgres railway on postgres.railway.internal:5432`.

```bash
railway login
railway link
railway ssh
cd /app
node apps/server/dist/db.js status
node apps/server/dist/owner-set.js --email you@example.com
exit
```

`db.js status` shows the shell has the service's variables: if it names SQLite instead, stop, since the owner would go into a throwaway file. `owner-set.js` asks for the password twice, hidden (at least 12 characters). Run it again later to change the email or password; that signs out every device. The log's hint `npm run owner:set` is the same command for a local checkout.

Without `railway ssh`, the same works from your Mac on the exact commit that is deployed: copy `DATABASE_PUBLIC_URL` from the Postgres service's **Variables**, then run these. `read -rs DB` waits for you to paste the URL and press Enter, without showing it. `PGSSLMODE=require` encrypts the connection without checking the certificate (Railway's public address has a self-signed one), whether or not the URL already has a `?…` part. If `DB` is empty (a new terminal tab, or Enter before the paste), the shell stops with `DB: is empty, run read -rs DB again` and runs nothing: with an empty `DATABASE_URL` the command would set the owner in your local `data/tracker.db` instead.

```bash
read -rs DB
DATABASE_URL="${DB:?is empty, run read -rs DB again}" PGSSLMODE=require npm run owner:set -- --email you@example.com
unset DB
```

## 7. Move your current data

A one-time command copies your local tracker (`data/tracker.db` and `data/uploads`) into Railway's Postgres and your S3 bucket: every project, status, ticket, comment, report, review and file, with the same ids, so ticket keys (PT-1…), ranks, counters and links stay as they are. Run it right after setting the owner (step 6), before you open the online tracker or add anything to it (steps 8 and 9): it refuses a database that already holds projects or tickets.

- **It only reads your local data.** It backs `data/tracker.db` up to a temporary copy and migrates the copy (your local tracker may be on an older schema); the file and the folder are never changed. The copy is deleted at the end, also when you stop it with Ctrl-C or close its terminal tab.
- **Only into Railway.** `DATABASE_URL` must be a `postgres://` URL and the files go only to the S3 bucket, never to a SQLite file or a folder on your Mac, which the online tracker could not read.
- **Images are compressed** as new uploads are (`docs/architecture.md` §3), and only the compressed copy, or one stripped of its metadata, goes to S3: a screenshot `….png` becomes `….webp`, with the same id, so its tile, its place and links to it stay. The bytes decide the type, so a JPEG once saved as `….png` goes online as what it is. Text that names a file by its old name still reads the same; the command says how many texts do. Other files are copied as they are.
- **Images that can't go online as they are** (a TIFF, or one cut off before its picture), whose metadata such as a photo's location can't be removed, stop the move before any file or row is written. The dry run lists them by attachment id, ticket key (or the comment on it that holds one), file name, size and reason. Start the local tracker again and remove each one listed with only a ticket key from that ticket's files. A file on a comment can't be removed alone: delete that comment instead (copy its text first if you want to post it again, with a copy of the image saved again). Stop the tracker, then run the dry run again. Starting it migrates `data/tracker.db` to this commit's schema if it was older (the move itself never changes the file); the backup from step 2 keeps the file and the uploads as they were.
- **Not copied:** sign-in (`users`, `sessions`, `api_tokens`). The online owner is the one you set in step 6; make new API tokens online for your agents (step 9). Nor uploads on no ticket or comment yet (files picked in a New ticket that wasn't created, or an upload cut off when the tracker stopped): only your local tracker could attach them. Nor chats with Claude Code and the files sent in them, which stay with this computer's helpers. The command says how many uploads and chat files it left out.
- **Files first, rows after.** The rows go in one transaction, so a run that stops halfway (network, a refused upload, Ctrl-C) leaves no row pointing at a missing file. Its last line says whether rows were written; when none were, run the same command again: it starts over, writing the files again under the same keys.
- **It refuses** a database that already holds projects or tickets, and says what is there (`--allow-existing` adds your data next to them); one where your data is already there; and one an older build migrated (deploy this commit first, so the online tracker and the move agree on the schema).

It runs on your Mac and reaches Railway's Postgres through its public address: the service's own `DATABASE_URL` (`postgres.railway.internal`) works only inside Railway. Your Mac needs the exact commit Railway deployed, and a `.env` with the S3 settings (`S3_BUCKET`, `AWS_REGION` and the two keys; made from `.env.example`, `docs/s3-storage.md`). Without a `.env`, node stops at once with `.env: not found`.

1. Stop your local Claude Code agents and the local tracker (Ctrl-C where `npm run dev` or `node apps/server/dist/main.js` runs), so nothing changes after the copy.
2. Take a final backup and build. `git status` should show nothing to commit, and `git log` the commit the Railway deployment shows:

   ```bash
   git status && git log -1 --oneline
   mkdir -p data/backups
   sqlite3 data/tracker.db ".backup data/backups/tracker-$(date +%Y%m%d-%H%M)-before-move.db"
   cp -R data/uploads "data/backups/uploads-$(date +%Y%m%d-%H%M)"
   npm run build -w @tracker/server
   ```

3. Copy `DATABASE_PUBLIC_URL` from the Postgres service's **Variables** (if it is not there: Postgres → **Settings** → **Networking** → **TCP Proxy**), then look first with a dry run, which changes nothing. `read -rs DB` waits for you to paste the URL and press Enter, without showing it:

   ```bash
   read -rs DB
   DATABASE_URL="${DB:?is empty, run read -rs DB again}" PGSSLMODE=require node --env-file=.env apps/server/dist/data-move.js \
     --from data/tracker.db --uploads data/uploads --dry-run
   ```

   It prints where it goes (`Postgres railway on <host>:<port>; files in S3 bucket <name>`, never the password or a key), the rows per table, the files and their size, how many images it would compress or strip, and any image that would stop the move. `PGSSLMODE=require` encrypts the connection (Railway's public address has a self-signed certificate) and works whether or not the URL already has a `?…` part. `DATABASE_URL` on the command line wins over one in `.env`. If `DB` is empty (a new terminal tab, or Enter before the paste), the shell stops with `DB: is empty, run read -rs DB again` and runs nothing (the move would refuse an empty `DATABASE_URL` too). The dry run does not contact S3: wrong keys show at the first file of the real run, before any row is written.

4. Move, in the same terminal, with the same command without `--dry-run`:

   ```bash
   DATABASE_URL="${DB:?is empty, run read -rs DB again}" PGSSLMODE=require node --env-file=.env apps/server/dist/data-move.js \
     --from data/tracker.db --uploads data/uploads
   unset DB
   ```

   It ends with `Checked: the target has every row moved (…) and every attachment's file, at its size. Done.`: it counted every table's rows in Postgres by id and asked S3 for every file's size. Anything else says what is wrong and whether rows were written.

5. Check it yourself: on the phone the project shows its tickets with the same keys, a ticket with a screenshot shows it, and a new ticket gets the next number (if the app was already open, reload it: the moved rows send no live update). The S3 console lists the files under `attachments/` as `<id>.webp` (and other files as they were). From now on use only the online tracker; keep `data/` as your backup.

With exported variables, `npm run data:move -- --from data/tracker.db --uploads data/uploads` runs the same from the source.

## 8. Open it on your phone

1. Safari → `https://<name>.up.railway.app` → sign in.
2. **Share** → **Add to Home Screen**. It opens full screen like an app. HTTPS also turns on offline support and the clipboard.
3. Open it from the Home Screen → **Account** → turn on **Notifications on this device** and allow them. The phone then tells you when Claude finishes a run, answers a chat or a ticket is ready for you. iOS offers notifications only to the app opened from the Home Screen, not in Safari.

## 9. Connect Claude Code agents

Agents on your Mac reach the online tracker with its address and an API token you create in the app. Follow README → **Connect Claude Code**, "To an online tracker", with `https://<name>.up.railway.app`:

1. In the app on the phone or the Mac: project menu (•••) → **Connect Claude Code** → **API tokens** → name it ("Claude laptop") → **Create token** → **Copy token** (shown once).
2. On the Mac, in the repo folder (`login` asks for the token: paste it):

   ```bash
   npm run build -w @tracker/agent
   node apps/agent/dist/cli.js login --url https://<name>.up.railway.app
   claude mcp add tracker -s user --env TRACKER_URL=https://<name>.up.railway.app --env TRACKER_AGENT_NAME=Claude -- node "$(pwd)/apps/agent/dist/mcp.js"
   ```

   Registered `tracker` for the local tracker before? Run `claude mcp remove tracker -s user` first.

3. Restart Claude Code and check with `node apps/agent/dist/cli.js projects`.

**Updating:** deploy the tracker first (push to `main` and wait for the deployment to go Active), then rebuild the agent (`npm run build -w @tracker/agent`) and restart `tracker watch` on each computer. A helper newer than its tracker may call routes the tracker doesn't have yet: then every step Claude asks you about is denied with "Update the tracker."

## Backups

- **Railway:** Postgres service → **Backups** → **Create backup** before any risky change, and add a **Daily** schedule (kept 6 days). Restore from the same tab (it mounts the backup as a new volume; click **Deploy**).
- **Your own copy** (needs `brew install libpq`, whose `pg_dump` must be at least the server's version). Run it in the repo folder: the dump goes to `data/backups`, which git ignores. Paste `DATABASE_PUBLIC_URL` from the Postgres service at `read -rs DB`; libpq reads `PGSSLMODE` as it reads `sslmode` in a URL, and with `DB` empty it would reach a Postgres on your Mac instead, so the shell stops as in step 6:

  ```bash
  mkdir -p data/backups
  read -rs DB
  PGSSLMODE=require "$(brew --prefix libpq)/bin/pg_dump" "${DB:?is empty, run read -rs DB again}" -Fc -f data/backups/tracker-$(date +%F).dump
  unset DB
  ```

  Restore into an empty database with `PGSSLMODE=require "$(brew --prefix libpq)/bin/pg_restore" --no-owner -d "${DB:?is empty, run read -rs DB again}" data/backups/tracker-<date>.dump` after `read -rs DB` (Homebrew's libpq isn't on your `PATH`).

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
  - **Or undo the migration from your Mac**, with the failed release's own code, then go back. Take a Railway backup first. `<commit>` is the commit the failed deployment shows; paste `DATABASE_PUBLIC_URL` at `read -rs DB` (with `DB` empty the shell stops, as in step 6, where an empty `DATABASE_URL` would roll back your local `data/tracker.db`); `db:status` should list the release's new migration as applied; run `db:rollback` once per migration it added:

    ```bash
    git worktree add /tmp/tracker-undo <commit>
    cd /tmp/tracker-undo && npm ci
    read -rs DB
    DATABASE_URL="${DB:?is empty, run read -rs DB again}" PGSSLMODE=require npm run db:status
    DATABASE_URL="${DB:?is empty, run read -rs DB again}" PGSSLMODE=require npm run db:rollback -- --yes
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
- After step 7, upload a photo to a ticket: it is stored as WebP in the bucket under `attachments/`. (Before the move, a ticket made online would make the move refuse.)
- Keep a ticket open on the phone and change it from the Mac: the change shows up right away (live updates through Railway's proxy).
- Push a small commit: the old deployment's logs end without errors, and the phone reconnects to the new one.
- Turn on notifications on the phone (step 8), lock it and start a run on a ticket: when it ends, a notification says "MOB-3: Claude finished", and tapping it opens the ticket.
