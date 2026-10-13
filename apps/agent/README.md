# @tracker/agent

An MCP server and a CLI that let Claude Code agents (and shells) use the project tracker: read tickets, claim work, comment, submit work for review and review it. Both talk to the tracker server over HTTP with `@tracker/client`, as an agent.

```bash
npm run build -w @tracker/agent   # builds dist/mcp.js and dist/cli.js
```

## Register with Claude Code

```bash
claude mcp add tracker --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node /absolute/path/to/project-tracker/apps/agent/dist/mcp.js
```

That registers the server for the current project. Add `-s user` to use it in all your projects:

```bash
claude mcp add tracker -s user --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node /absolute/path/to/project-tracker/apps/agent/dist/mcp.js
```

## API tokens

A tracker with an owner account (always the case online) lets agents in with an API token, sent as `Authorization: Bearer trk_…`. The owner makes one in the app: **Connect Claude Code** → **API tokens** → **Create token**, shown once. Then, on the computer the agents run on:

```bash
node apps/agent/dist/cli.js login --url https://your-tracker.up.railway.app
```

`login` asks for the token without echoing it (or reads the first line of a pipe: `pbpaste | tracker login --url …`), checks it with the tracker (`GET /api/session`) and saves it in `~/.config/project-tracker/config.json` (`$XDG_CONFIG_HOME/project-tracker/`, or the path in `TRACKER_CONFIG`). The file is written with mode `0600` in a `0700` folder, and each save tightens a `project-tracker` folder that others could open. It keeps one token per tracker URL and the last tracker logged in to as the default, and a saved token is only ever sent to the tracker it was saved for. The MCP server and the CLI both read it, so Claude Code needs no token in its settings and the token stays out of shell history. `tracker logout [--url URL]` forgets the saved token; revoking it in the app is what stops it working.

A token only travels over https, or plain http to a tracker on this computer (`localhost`, `127.0.0.1`, `[::1]`). `login` refuses an `http://` address of another computer before it asks for the token, and the CLI and MCP server refuse to send a token there, since anyone on the network could read it. Use the tracker's `https://` address (Railway's is), or reach a tracker without https through an SSH tunnel to `localhost`.

Revoke a token in **Connect Claude Code** → **API tokens** → **Revoke**. The next request with it gets `401`, and the CLI and MCP tools say which token was refused and where a new one goes.

## Slash commands

| Command                     | What the agent does                                                                                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/mcp__tracker__work MOB`   | Claims the next To do ticket, reads it fully, does the work in the current repository, comments on decisions and blockers, verifies (tests and build for code, else against the ticket and the project's instructions) and submits it for review with summary, files, next. |
| `/mcp__tracker__review MOB` | Lists tickets in Need review, checks the real changes against the ticket (and the project's instructions), rates them 1–5 and approves or requests changes with actionable feedback.                                                                                        |

The project key is optional: without it the agent finds the project with `list_projects` (by the repository) or asks you.

`get_ticket`, `claim_ticket`, `claim_next_ticket` and `tracker show` print the project's instructions (set in the project's Edit sheet on the phone) under the ticket's header, when it has any.

Tools: `list_projects`, `list_statuses`, `list_tickets`, `get_ticket` (with up to 4 images), `create_ticket`, `update_ticket`, `move_ticket` (by status name), `add_comment`, `attach_file`, `claim_next_ticket`, `claim_ticket`, `submit_for_review`, `review_ticket`, `ask_person` (asks the person a question on a ticket and waits up to 30 minutes for the answer from their phone; with no answer it tells Claude to go on with its best judgment).

`attach_file { ticket, paths, comment? }` (CLI: `tracker attach KEY FILE… [--comment TEXT]`) uploads local files to a ticket, or with a comment to a new comment on it, so results that aren't code (a draft, a CSV, a PDF, an image) can be read on the phone. It takes the tracker's types and sizes, and only files in the current folder or a temp folder (`tmpdir()`, `/tmp`), by their real path: a symlink or `..` leading out, to `~/.ssh` for example, is refused. Every file is checked before any is sent. Reports list them under `OUTPUT:`, which the app shows as **Output**.

## Environment

| Variable             | Default                                                | Meaning                                                                        |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `TRACKER_URL`        | the tracker logged in to, else `http://localhost:4100` | Tracker server                                                                 |
| `TRACKER_API_TOKEN`  | the token `tracker login` saved for that URL           | API token; wins over the saved one. `TRACKER_TOKEN`, its old name, still works |
| `TRACKER_AGENT_NAME` | `Claude`                                               | Name shown on the agent's activity                                             |
| `TRACKER_CONFIG`     | `~/.config/project-tracker/config.json`                | Where `tracker login` saves tokens                                             |

Errors say what to do: a `401` names the tracker and whether the token was missing or which one (`--token`, `TRACKER_API_TOKEN`, `TRACKER_TOKEN` or the saved one) it refused; an answer that isn't the tracker's (a `403`, `404` or `5xx` from a proxy, or a web page), a `429` and a network failure name the URL. The token itself is never printed.

## CLI

The same operations for shells and agents without MCP. Flags `--url` (one-off: another tracker), `--as <name>` and `--token` override the environment; `--json` prints the raw API response. A `--token` stays in shell history, so prefer `tracker login`.

```bash
alias tracker="node $PWD/apps/agent/dist/cli.js"   # from the repo root

tracker help
tracker login --url https://your-tracker.up.railway.app   # paste the API token
tracker projects
tracker projects --url http://localhost:4100              # one-off: another tracker
tracker tickets MOB --status "In progress"
tracker show MOB-3
tracker claim MOB                     # or: tracker claim MOB-3
tracker comment MOB-3 Found the cause: the rotation handler runs twice
tracker attach MOB-3 plan.md budget.csv --comment "The plan and its budget"
tracker submit MOB-3 --summary "Fixed the crash; added a test" --files src/profile.ts --next none
tracker review MOB-3 --verdict changes_requested --rating 3 --summary "Landscape still crashes on iPad"
tracker move MOB-3 In progress
tracker --json show MOB-3
```

Exit codes: `0` success, `1` the tracker refused or could not be reached, `2` usage error.

## Run Claude Code from your phone

`tracker watch` is a helper that waits for **Run in Claude Code** from the app and starts `claude -p` on this computer. Run it in the project's code folder and leave it open:

```bash
cd ~/code/mobile
tracker login --url https://your-tracker.up.railway.app   # once
tracker watch MOB --name "Dara's MacBook"
```

- `PROJECT` can be left out when exactly one project has this folder as its repo. One helper per folder: a second one there is refused.
- The app shows it under your Mac's name (System Settings → General → Sharing), or `--name`. Its id is made once per tracker and folder and kept in `~/.config/project-tracker/config.json`.
- It only calls out to the tracker over https (or to `localhost`), so it works behind a home router with no open port. It waits for the tracker when it can't reach it, reconnects by itself after a drop, a deploy or sleep, and checks for runs every 20 s besides.
- It also answers questions from **Ask Claude** in the app. One run of each kind at a time: a ticket run or an Edit question in one lane, an Ask or Plan question in the other, so a question is answered while a ticket run works, but two Claudes never change this folder at once. The prompt goes to `claude -p` on stdin, in this folder. The tracker never sends it a command, folder or flag.
- Photos and files sent with a question are downloaded with your token into a new temp folder of that run's own (`tracker-ask-…`), named safely, and given to Claude with `--add-dir`; the prompt lists their paths. An Ask or Plan question can read them but still change nothing. The folder is removed when the run ends, also when it fails or is stopped.
- The app shows Claude's steps while it works ("Read src/a.ts", "Run npm test"), never a file's contents.
- A ticket in **Need review** goes to a reviewer run instead: Claude reviews it and records the review with `review_ticket`. If the ticket is still in review when Claude finishes, the run ends with "Claude didn't record a review."
- In a ticket run or an Edit question, a step that needs your OK, or a question Claude asks you, shows on the phone with **Allow** and **Deny** (or the choices), and Claude waits for your answer, up to 30 minutes. Ask and Plan questions are read-only and never ask.
- `claude` must be installed and logged in here, with the tracker's MCP tools added (above), so Claude can claim, comment and submit. Your Claude Code settings decide what a ticket run may do; `--permission-mode` (for example `acceptEdits`) is passed on to `claude` for ticket runs and Edit questions. Without it, an Edit question gets `default`, so it asks on the phone before each step outside your allow rules.
- `--approvals` makes ticket runs ask the same way: a command your allow rules don't cover waits for **Allow** or **Deny** on the phone, and no answer within 30 minutes is a no. Rather than `--permission-mode bypassPermissions` (which never asks, so it is refused with `--approvals`), use `tracker watch MOB --approvals --permission-mode acceptEdits`: file edits in this folder go ahead, and commands outside your allow rules ask you.
- Runs may use the tracker tools their prompt names without asking: `ask_person`, `get_ticket`, `add_comment` and `attach_file`, plus `submit_for_review` in a work run and `review_ticket` in a review run.
- On macOS it keeps the Mac from idle sleep while it runs (`caffeinate -i`; the screen can still turn off). `--no-keep-awake` turns that off. A closed laptop lid still sleeps unless it is on power with a display.
- Ctrl-C (or closing the terminal) stops it, and a run in progress is reported as cancelled. If the tracker can't be reached then, it keeps trying to report; a second Ctrl-C quits at once.

### Start it by itself (macOS)

```bash
cd ~/code/mobile
tracker watch MOB --install     # starts now, at every login, and again after a crash
tracker watch --check           # installed? running? online at the tracker?
tracker watch --uninstall
```

`--install` checks everything a normal start does, then writes a LaunchAgent (`~/Library/LaunchAgents/com.project-tracker.watch.<id>.plist`) that runs `tracker watch` in this folder with the same choices; logs go to `~/Library/Logs/com.project-tracker.watch.<id>.log` (`--check` shows the path). Things to know:

- The token stays in the config file, never in the plist: log in with `tracker login` first (a token from an environment variable is refused).
- The job gets only `PATH` and the config file's location, so `claude` must be logged in itself (`claude`, then `/login`), not through `ANTHROPIC_API_KEY` or other variables.
- If the code or the project-tracker checkout (the CLI) is in Documents, Desktop or Downloads, macOS asks for permission for node to use that folder, and asks again after a node upgrade. Folders like `~/code` avoid that.
- To change `--name` or another choice, run `--install` again with the new ones; it replaces the installed helper.
- A LaunchAgent runs only while you are logged in: after a restart with FileVault on, the Mac waits for your password. "Start up automatically after a power failure" (System Settings → Energy) helps a Mac at home.
- When the Mac is off, asleep or offline, a run waits 30 minutes and then fails with "Your computer didn't take the run."

### Start it by itself (Linux)

The same three commands write a systemd user unit (`~/.config/systemd/user/com.project-tracker.watch.<id>.service`), enable it and start it. It restarts two minutes after a crash and logs to the journal (`journalctl --user -u com.project-tracker.watch.<id>.service -f`). To start at boot rather than at login, `--install` turns on lingering (`loginctl enable-linger`), or says to run it with `sudo` when that is refused. As on macOS, log in with `tracker login` and log `claude` in itself: the unit gets only `PATH` and the config file's location.

### A helper that's always on

To start runs while your Mac is off, run the helper on a server or in Docker (`docker/helper/Dockerfile`): see [docs/always-on-helper.md](../../docs/always-on-helper.md).

## Workflow: worker → reviewer → person

1. A person adds tickets (usually from their phone).
2. A **worker** agent (`/mcp__tracker__work`) claims a ticket, which moves it from To do to In progress, works on it and submits it, which stores a report and moves it to **Need review**.
3. A **reviewer** agent (`/mcp__tracker__review`) verifies the work. Approved moves it to **Reviewed**; changes requested sends it back to the top of To do for the next worker.
4. The **person** checks Reviewed tickets and moves them to **Done**. Agents can never move a ticket to Done.
