# Not at the repo root, so Railway keeps building the tracker itself with Railpack.
# Build and run: docs/always-on-helper.md.

FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY . .
ENV HUSKY=0
RUN npm ci \
 && npm run build -w @tracker/agent \
 && npm ci --omit=dev --ignore-scripts --workspace @tracker/agent \
 && mkdir -p apps/agent/node_modules

FROM node:22-bookworm-slim
ARG CLAUDE_CODE_VERSION=latest
# Claude Code can't update itself here: npm's global folder belongs to root.
ENV DISABLE_AUTOUPDATER=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git gosu openssh-client tini \
 && rm -rf /var/lib/apt/lists/*
RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" && npm cache clean --force

WORKDIR /opt/tracker
COPY --from=build /src/node_modules node_modules
COPY --from=build /src/apps/agent/package.json apps/agent/package.json
COPY --from=build /src/apps/agent/node_modules apps/agent/node_modules
COPY --from=build /src/apps/agent/dist apps/agent/dist
COPY docker/helper/entrypoint.sh /usr/local/bin/tracker-helper

# The config lives on the data volume but at its usual path, so the tracker MCP server that
# Claude Code starts finds the token whatever variables Claude Code passes on to it.
RUN chmod 755 apps/agent/dist/*.js /usr/local/bin/tracker-helper \
 && ln -s /opt/tracker/apps/agent/dist/cli.js /usr/local/bin/tracker \
 && mkdir -p /data/code /data/project-tracker /home/node/.config \
 && chmod 700 /data/project-tracker \
 && ln -s /data/project-tracker /home/node/.config/project-tracker \
 && chown -R node:node /data /home/node

USER node
RUN claude mcp add tracker --scope user -- node /opt/tracker/apps/agent/dist/mcp.js

# The entrypoint starts as root only to hand a fresh volume to node, then runs everything as node.
USER root
WORKDIR /data/code
ENTRYPOINT ["tini", "--", "tracker-helper"]
