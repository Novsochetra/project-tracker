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

If the tracker runs with an access token, also pass `--env TRACKER_TOKEN=<token>`.

## Slash commands

| Command                     | What the agent does                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/mcp__tracker__work MOB`   | Claims the next To do ticket, reads it fully, does the work in the current repository, comments on decisions and blockers, verifies (tests, build) and submits it for review with summary, files, next. |
| `/mcp__tracker__review MOB` | Lists tickets in Need review, checks the real changes against the ticket, rates them 1–5 and approves or requests changes with actionable feedback.                                                     |

The project key is optional: without it the agent finds the project with `list_projects` (by the repository) or asks you.

Tools: `list_projects`, `list_statuses`, `list_tickets`, `get_ticket` (with up to 4 images), `create_ticket`, `update_ticket`, `move_ticket` (by status name), `add_comment`, `claim_next_ticket`, `claim_ticket`, `submit_for_review`, `review_ticket`.

## Environment

| Variable             | Default                 | Meaning                                    |
| -------------------- | ----------------------- | ------------------------------------------ |
| `TRACKER_URL`        | `http://localhost:4100` | Tracker server                             |
| `TRACKER_TOKEN`      | none                    | Access token, when the server requires one |
| `TRACKER_AGENT_NAME` | `Claude`                | Name shown on the agent's activity         |

## CLI

The same operations for shells and agents without MCP. Flags `--url`, `--as <name>` and `--token` override the environment; `--json` prints the raw API response.

```bash
alias tracker="node $PWD/apps/agent/dist/cli.js"   # from the repo root

tracker help
tracker projects
tracker tickets MOB --status "In progress"
tracker show MOB-3
tracker claim MOB                     # or: tracker claim MOB-3
tracker comment MOB-3 Found the cause: the rotation handler runs twice
tracker submit MOB-3 --summary "Fixed the crash; added a test" --files src/profile.ts --next none
tracker review MOB-3 --verdict changes_requested --rating 3 --summary "Landscape still crashes on iPad"
tracker move MOB-3 In progress
tracker --json show MOB-3
```

Exit codes: `0` success, `1` the tracker refused or could not be reached, `2` usage error.

## Workflow: worker → reviewer → person

1. A person adds tickets (usually from their phone).
2. A **worker** agent (`/mcp__tracker__work`) claims a ticket, which moves it from To do to In progress, works on it and submits it, which stores a report and moves it to **Need review**.
3. A **reviewer** agent (`/mcp__tracker__review`) verifies the work. Approved moves it to **Reviewed**; changes requested sends it back to the top of To do for the next worker.
4. The **person** checks Reviewed tickets and moves them to **Done**. Agents can never move a ticket to Done.
