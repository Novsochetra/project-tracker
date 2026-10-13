import { GroupedCard } from '../../components';
import { CommandRow } from './CommandRow';
import {
  BUILD_COMMAND,
  isLocalTracker,
  loginCommand,
  mcpAddCommand,
  type ConnectInfo,
} from './connectCommand';
import styles from './ConnectSheet.module.css';
import { Section } from './Section';
import type { CopyHandler } from './useCopyCommand';

export interface SetupCommandsProps {
  info: ConnectInfo;
  repoRoot: string;
  authRequired: boolean;
  onCopy: CopyHandler;
}

// A tracker elsewhere (Railway) can't know where the code is on this computer, so its commands
// run in the person's own checkout.
const whereToRun = (local: boolean, repoRoot: string) =>
  local ? (
    <>
      in <code className={styles.inlineCode}>{repoRoot}</code>
    </>
  ) : (
    'in your project-tracker folder'
  );

export function SetupCommands({ info, repoRoot, authRequired, onCopy }: SetupCommandsProps) {
  const local = isLocalTracker(info.serverUrl);
  return (
    <Section title="Add the tracker to Claude Code">
      <p className={styles.help}>
        Run these once in a terminal, in order, {whereToRun(local, repoRoot)}. Claude Code then has
        the tracker in all your projects.
      </p>
      <GroupedCard>
        <ol className={styles.rows}>
          <CommandRow
            step={1}
            command={BUILD_COMMAND}
            description="Builds the tracker’s MCP server and CLI."
            copyLabel="Copy build command"
            onCopy={onCopy}
          />
          {authRequired && (
            <CommandRow
              step={2}
              command={loginCommand(info)}
              description="Asks for an API token, checks it and saves it where the MCP server and the CLI find it."
              copyLabel="Copy login command"
              onCopy={onCopy}
            />
          )}
          <CommandRow
            step={authRequired ? 3 : 2}
            command={mcpAddCommand(info)}
            description="Adds the tracker’s MCP server to Claude Code."
            copyLabel="Copy MCP command"
            onCopy={onCopy}
          />
        </ol>
      </GroupedCard>
    </Section>
  );
}
