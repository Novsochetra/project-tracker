# @tracker/agent

An MCP server and a CLI that let any AI agent (and shells) use the project tracker: read tickets, claim work, comment, submit work for review and review it. Both talk to the tracker server over HTTP with `@tracker/client`, as an agent.

```bash
npm run build -w @tracker/agent   # builds dist/mcp.js and dist/cli.js
```

## Register with an agent

Any agent that takes MCP servers runs this one as `node /absolute/path/to/project-tracker/apps/agent/dist/mcp.js`, with `TRACKER_URL` (and `TRACKER_AGENT_NAME`, the name its activity shows) in its environment; add it in the agent's own MCP settings. With Claude Code, for example:

```bash
claude mcp add tracker --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node /absolute/path/to/project-tracker/apps/agent/dist/mcp.js
```

That registers the server for the current project. Add `-s user` to use it in all your projects:

```bash
claude mcp add tracker -s user --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node /absolute/path/to/project-tracker/apps/agent/dist/mcp.js
```

## API tokens

A tracker with an owner account (always the case online) lets agents in with an API token, sent as `Authorization: Bearer trk_…`. The owner makes one in the app: **Connect an agent** → **API tokens** → **Create token**, shown once. Then, on the computer the agents run on:

```bash
node apps/agent/dist/cli.js login --url https://your-tracker.up.railway.app
```

`login` asks for the token without echoing it (or reads the first line of a pipe: `pbpaste | tracker login --url …`), checks it with the tracker (`GET /api/session`) and saves it in `~/.config/project-tracker/config.json` (`$XDG_CONFIG_HOME/project-tracker/`, or the path in `TRACKER_CONFIG`). The file is written with mode `0600` in a `0700` folder, and each save tightens a `project-tracker` folder that others could open. It keeps one token per tracker URL and the last tracker logged in to as the default, and a saved token is only ever sent to the tracker it was saved for. The MCP server and the CLI both read it, so the agent needs no token in its settings and the token stays out of shell history. `tracker logout [--url URL]` forgets the saved token; revoking it in the app is what stops it working.

A token only travels over https, or plain http to a tracker on this computer (`localhost`, `127.0.0.1`, `[::1]`). `login` refuses an `http://` address of another computer before it asks for the token, and the CLI and MCP server refuse to send a token there, since anyone on the network could read it. Use the tracker's `https://` address (Railway's is), or reach a tracker without https through an SSH tunnel to `localhost`.

Revoke a token in **Connect an agent** → **API tokens** → **Revoke**. The next request with it gets `401`, and the CLI and MCP tools say which token was refused and where a new one goes.

## Prompts

The MCP server has two prompts, `work` and `review`, which take an optional project key. Claude Code, for example, offers them as slash commands:

| Command                     | What the agent does                                                                                                                                                                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/mcp__tracker__work MOB`   | Claims the next To do ticket, reads it fully, does the work in the current repository, comments on decisions and blockers, verifies (tests and build for code, else against the ticket and the project's instructions) and submits it for review with summary, files, output, next. |
| `/mcp__tracker__review MOB` | Lists tickets in Need review, checks the real changes against the ticket (and the project's instructions), rates them 1–5 and approves or requests changes with actionable feedback.                                                                                                |

The project key is optional: without it the agent finds the project with `list_projects` (by the repository) or asks you.

`get_ticket`, `claim_ticket`, `claim_next_ticket` and `tracker show` print the project's instructions (set in the project's Edit sheet on the phone) under the ticket's header, when it has any, then the instructions of each of the ticket's labels that has some (set in the project's **Manage labels** sheet).

**Labels** are the project's own (a person makes them on the phone). `create_ticket` and `update_ticket` take `labels`, a list of up to 10 names in any case (`update_ticket` sets the whole list; `[]` removes them all), and `list_tickets` takes one `label` to filter by. An unknown name fails before anything is sent, listing the project's labels. Lists and `get_ticket` show a ticket's labels. CLI: `tracker create MOB --title "Crash" --label "Bug, UI"`, `tracker update MOB-3 --label ""` and `tracker tickets MOB --label Bug`.

Tools: `list_projects`, `list_statuses`, `list_tickets`, `get_ticket` (with up to 4 images), `create_ticket`, `update_ticket`, `move_ticket` (by status name; `reopen: true` takes a ticket out of Done, only when the person told the agent to), `add_comment`, `attach_file`, `claim_next_ticket`, `claim_ticket`, `submit_for_review`, `review_ticket`, `ask_person` (asks the person a question on a ticket and waits up to 30 minutes for the answer from their phone; with no answer it tells the agent to go on with its best judgment).

`attach_file { ticket, paths, comment? }` (CLI: `tracker attach KEY FILE… [--comment TEXT]`) uploads local files to a ticket, or with a comment to a new comment on it, so results that aren't code (a draft, a CSV, a PDF, an image) can be read on the phone. It takes the tracker's types and sizes, and only files in the current folder or a temp folder (`tmpdir()`, `/tmp`), by their real path: a symlink or `..` leading out, to `~/.ssh` for example, is refused, and so is a file in a dot-folder (`.ssh`, `.aws`, `.config`, …), and anything from a current folder that is your home folder or above it, or inside one of its dot-folders (`~/.claude`, `~/.aws`, …). The name and type come from the real file, not a symlink's name. Every file is checked and opened before any is sent, and the upload reads what was checked. Reports list them under `OUTPUT:` (`submit_for_review`'s `output`, `tracker submit --output`), which the app shows as **Output**.

## Environment

| Variable             | Default                                                | Meaning                                                                        |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `TRACKER_URL`        | the tracker logged in to, else `http://localhost:4100` | Tracker server                                                                 |
| `TRACKER_API_TOKEN`  | the token `tracker login` saved for that URL           | API token; wins over the saved one. `TRACKER_TOKEN`, its old name, still works |
| `TRACKER_AGENT_NAME` | `Agent`                                                | Name shown on the agent's activity                                             |
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
tracker tickets MOB --label Bug
tracker create MOB --title "Crash on launch" --label Bug
tracker show MOB-3
tracker claim MOB                     # or: tracker claim MOB-3
tracker comment MOB-3 Found the cause: the rotation handler runs twice
tracker attach MOB-3 plan.md budget.csv --comment "The plan and its budget"
tracker submit MOB-3 --summary "Fixed the crash; added a test" --files src/profile.ts --next none
tracker review MOB-3 --verdict changes_requested --rating 3 --summary "Landscape still crashes on iPad"
tracker move MOB-3 In progress
tracker move MOB-3 To do --reopen     # out of Done, only when the person said so
tracker --json show MOB-3
```

Exit codes: `0` success, `1` the tracker refused or could not be reached, `2` usage error.

## A project that isn't code

For a folder with Notion, Gmail or Drive connected rather than code, see [docs/workspaces.md](../../docs/workspaces.md).

## Workflow: worker → reviewer → person

1. A person adds tickets (usually from their phone).
2. A **worker** agent (`/mcp__tracker__work`) claims a ticket, which moves it from To do to In progress, works on it and submits it, which stores a report and moves it to **Need review**.
3. A **reviewer** agent (`/mcp__tracker__review`) verifies the work. Approved moves it to **Reviewed**; changes requested sends it back to the top of To do for the next worker.
4. The **person** checks Reviewed tickets and moves them to **Done**. Agents can never move a ticket to Done.
