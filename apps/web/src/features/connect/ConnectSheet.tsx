import type { ServerMeta } from '@tracker/shared';
import { Copy } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { errorMessage, useMeta, type TrackerQuery } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { Button, GroupedCard, Spinner } from '../../components';
import { Sheet, SheetTextButton } from '../../overlays';
import { CommandRow } from './CommandRow';
import {
  BUILD_COMMAND,
  COMMAND_COPY_BLOCKED,
  REVIEW_COMMAND,
  TOKEN_PLACEHOLDER,
  WORK_COMMAND,
  cliHelpCommand,
  mcpAddCommand,
} from './connectCommand';
import styles from './ConnectSheet.module.css';
import { ConnectSteps } from './ConnectSteps';
import { useCopyCommand } from './useCopyCommand';

export function ConnectSheet({ open, onClose }: SheetProps) {
  const meta = useMeta();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Connect Claude Code"
      title="Connect Claude Code"
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
    >
      <div className={styles.body}>
        <p className={styles.help}>
          Claude Code agents can pick up your tickets, do the work and hand it back for review.
        </p>
        <ConnectSteps />
        {meta.data ? <Setup meta={meta.data} /> : <MetaState query={meta} />}
      </div>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Setup({ meta }: { meta: ServerMeta }) {
  const { copy, blocked } = useCopyCommand();
  const command = mcpAddCommand({
    origin: window.location.origin,
    mcpEntry: meta.mcpEntry,
    authRequired: meta.authRequired,
  });
  return (
    <>
      <Section title="Add the tracker to Claude Code">
        <p className={styles.help}>Run this once in a terminal. It works in all your projects.</p>
        <pre className={styles.command}>
          <code>{command}</code>
        </pre>
        <Button size="sm" icon={Copy} className={styles.copy} onClick={() => copy(command)}>
          Copy command
        </Button>
        {meta.authRequired && (
          <p className={styles.note}>
            Replace <code className={styles.inlineCode}>{TOKEN_PLACEHOLDER}</code> with this
            tracker’s access token.
          </p>
        )}
        <p className={styles.note}>
          It runs the tracker’s MCP server, which you build once with{' '}
          <code className={`${styles.inlineCode} ${styles.nowrap}`}>{BUILD_COMMAND}</code> in{' '}
          <code className={styles.inlineCode}>{meta.repoRoot}</code>.
        </p>
      </Section>
      <Section title="Then, in Claude Code">
        <GroupedCard>
          <ul className={styles.rows}>
            <CommandRow
              command={WORK_COMMAND}
              description="Claims the next To do ticket, does the work and submits it for review."
              copyLabel="Copy work command"
              onCopy={copy}
            />
            <CommandRow
              command={REVIEW_COMMAND}
              description="Checks tickets in Need review, rates them and approves them or sends them back."
              copyLabel="Copy review command"
              onCopy={copy}
            />
          </ul>
        </GroupedCard>
        <p className={styles.note}>
          Use the project’s key, like MOB. Leave it out and the agent finds the project by its
          repository.
        </p>
      </Section>
      <Section title="Without MCP">
        <GroupedCard>
          <ul className={styles.rows}>
            <CommandRow
              command={cliHelpCommand(meta.cliEntry)}
              description="The same tools as a command line, for shells and agents without MCP."
              copyLabel="Copy CLI command"
              onCopy={copy}
            />
          </ul>
        </GroupedCard>
      </Section>
      {blocked && (
        <p role="alert" className={`${styles.error} fade-in`}>
          {COMMAND_COPY_BLOCKED}
        </p>
      )}
    </>
  );
}

function MetaState({ query }: { query: TrackerQuery<ServerMeta> }) {
  if (!query.isError) {
    return (
      <div className={styles.loading}>
        <Spinner label="Loading the setup commands" />
      </div>
    );
  }
  return (
    <>
      <p role="alert" className={styles.error}>
        {errorMessage(query.error)}
      </p>
      <Button size="sm" className={styles.retry} onClick={() => void query.refetch()}>
        Try again
      </Button>
    </>
  );
}
