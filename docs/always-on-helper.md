# A helper that's always on

**Run in Claude Code** needs a helper (`tracker watch`) that is online. On your Mac that means the Mac is on, awake and logged in. To start runs from your phone while the laptop is closed, run the helper on a computer that never sleeps: a VPS, a home server, or a Railway service.

Two ways:

- **Docker** (any Linux host, or Railway): the image in `docker/helper/` has Node 22, git, Claude Code and the tracker CLI.
- **Linux without Docker**: install Node 22 and Claude Code, then `tracker watch --install` sets it up as a systemd user service.

## Security first

The helper runs whatever Claude decides to run, in its project folder, with the permissions you give it. So:

- Give it a machine or a container of its own, not one that holds other secrets.
- Make it an API token of its own in **Connect Claude Code** → **API tokens**, so you can revoke it alone.
- Give it git credentials only if it should push. A read-only deploy key or a fine-grained token with read-only access to the one repo is enough to pull. Without push access, its work stays on that machine until you fetch it from there.
- Its Claude Code login (`ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN`) is in its environment, so Claude's own commands can read it. Use a key you can revoke on its own.
- Don't start the container with `docker run --user`. The entrypoint then can't take the API token out of the environment of the container's first process, which runs as the same user as Claude, so Claude's commands could read it.

## Docker

Build the image from the repo root. The Dockerfile is in `docker/helper/`, not at the root, so Railway keeps building the tracker itself the way it does now.

```bash
docker build -f docker/helper/Dockerfile -t tracker-helper .
```

`--build-arg CLAUDE_CODE_VERSION=2.1.296` pins Claude Code; the default is the latest.

Run it with one volume at `/data`. The project lives in `/data/code` and the tracker config (the saved token, the helper's id and its folder lock) in `/data/project-tracker`, so both survive a restart and a new image.

```bash
docker run -d --name tracker-helper --restart unless-stopped \
  -v tracker-helper:/data \
  -e TRACKER_URL=https://your-tracker.up.railway.app \
  -e TRACKER_API_TOKEN=trk_… \
  -e CLAUDE_CODE_OAUTH_TOKEN=… \
  -e TRACKER_PROJECT=MOB \
  -e TRACKER_HELPER_NAME="Home server" \
  -e PROJECT_GIT_URL=https://github.com/you/mobile.git \
  -e GIT_AUTHOR_NAME="Claude (home server)" -e GIT_AUTHOR_EMAIL=you@example.com \
  -e GIT_COMMITTER_NAME="Claude (home server)" -e GIT_COMMITTER_EMAIL=you@example.com \
  tracker-helper
```

Arguments after the image name go to `tracker watch` too, so `tracker-helper MOB --permission-mode acceptEdits` works as well.

| Variable                                         | What it does                                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRACKER_URL`                                    | The tracker's https address. Required.                                                                                                                                            |
| `TRACKER_API_TOKEN`                              | An API token. At each start it is checked with the tracker and saved in `/data/project-tracker` (as `tracker login` does), then taken out of the environment.                     |
| `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` | Claude Code's login. Make the OAuth token on any computer with `claude setup-token` (uses your Claude subscription); an API key bills the Anthropic API.                          |
| `TRACKER_PROJECT`                                | The project's key, like `MOB`. Needed here: the project's repository path is your Mac's, so the helper can't find the project by its folder.                                      |
| `TRACKER_HELPER_NAME`                            | The name the app lists it under (`--name`). Without it, the container's host name.                                                                                                |
| `TRACKER_PERMISSION_MODE`                        | Passed on as `--permission-mode`, for example `acceptEdits`.                                                                                                                      |
| `PROJECT_GIT_URL`                                | Cloned into `/data/code` at the first start, while that folder has no `.git`. A token in an https URL stays in `.git/config` and is what lets it push; leave it out to pull only. |
| `GIT_AUTHOR_*`, `GIT_COMMITTER_*`                | Who its commits are by.                                                                                                                                                           |

- The helper's id lives in the volume, so a new container with the same volume is the same helper in the app.
- The image registers the tracker MCP server for Claude Code (`claude mcp add tracker --scope user`), so the check `tracker watch` runs before it starts passes and Claude can claim, comment and submit.
- It runs as the `node` user (uid 1000): Claude Code refuses to skip permissions as root. The entrypoint starts as root only to hand a new, root-owned volume to `node`. To use a folder of the host instead of the volume (`-v /srv/mobile:/data/code`), make it owned by uid 1000.
- `TRACKER_PERMISSION_MODE`: without one, a ticket run asks on your phone before each step outside the project's allow rules and waits up to 30 minutes. In a container of its own, `acceptEdits` or `bypassPermissions` lets it work alone.
- Logs: `docker logs -f tracker-helper`. A shell: `docker exec -it -u node tracker-helper bash`.
- Stop it with `docker stop tracker-helper`. `--restart unless-stopped` brings it back after a crash and after the host reboots.
- To clone by hand instead, or with an SSH key: `docker exec -it -u node tracker-helper bash`, then `git clone … /data/code` while the folder is empty, and restart the container.

### On Railway

The repo's root `railway.json` builds and runs the tracker, and Railway applies it to every service from this repo unless the service names another config file. The helper has its own: `docker/helper/railway.json` (the Dockerfile builder, restart always, no pre-deploy command, start command or health check).

1. In the tracker's Railway project, **New** → **GitHub Repo** → this repo, as a second service.
2. In its **Settings** → **Config-as-code**, set the config file path to `/docker/helper/railway.json`. Check the next deploy's build logs: they must show the Dockerfile build, not Railpack and `npm run build`.
3. Add a **Volume** mounted at `/data`.
4. Add the variables above, `TRACKER_PROJECT` and `TRACKER_HELPER_NAME` included. It needs no public domain.

## Linux without Docker (systemd)

Install Node 22, git and Claude Code (`npm install -g @anthropic-ai/claude-code`, then `claude` and `/login`: the service doesn't get your shell's variables, so `ANTHROPIC_API_KEY` won't reach it), clone the tracker and build its CLI (`npm ci && npm run build -w @tracker/agent`), register the MCP server (see `apps/agent/README.md`), and clone your project. Then, in the project folder:

```bash
tracker login --url https://your-tracker.up.railway.app
tracker watch MOB --install
tracker watch --check
tracker watch --uninstall
```

`--install` checks everything a normal start does, then writes a systemd user unit, `~/.config/systemd/user/com.project-tracker.watch.<id>.service`, enables it and starts it. It restarts two minutes after a crash (not after a clean stop) and logs to the journal: `journalctl --user -u com.project-tracker.watch.<id>.service -f`.

User services start at boot only with lingering on. `--install` turns it on with `loginctl enable-linger <you>`; where that needs root, it says so, and until you run `sudo loginctl enable-linger <you>` the helper starts only once you log in. `--check` shows whether it is on.

As on the Mac, the token comes from `tracker login`, not from an environment variable, and the unit gets only `PATH` and the config file's location.
