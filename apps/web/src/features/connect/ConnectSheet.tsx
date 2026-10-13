import type { ServerMeta } from '@tracker/shared';
import { errorMessage, type TrackerQuery } from '../../api';
import { useMeta } from '../../api/hooks/meta';
import type { SheetProps } from '../../app/sheets/types';
import { Button, GroupedCard, Spinner } from '../../components';
import { useOptionalNavigation } from '../../navigation/useNavigation';
import { Sheet, SheetTextButton } from '../../overlays';
import { VersionNote } from '../version/VersionNote';
import { CommandRow } from './CommandRow';
import { addressNote, agentAddress } from './agentAddress';
import {
  cliHelpCommand,
  projectKeyNote,
  routeProjectKey,
  slashCommand,
  trackerAddress,
  type ConnectInfo,
} from './connectCommand';
import styles from './ConnectSheet.module.css';
import { ConnectSteps } from './ConnectSteps';
import { Section } from './Section';
import { SetupCommands } from './SetupCommands';
import { ADDRESS_COPY } from './tokenText';
import { OpenTrackerNote, TokensSection } from './TokensSection';
import { useCopyCommand, type CopyHandler } from './useCopyCommand';
import { WatchSection } from './WatchSection';

export function ConnectSheet({ open, onClose }: SheetProps) {
  const meta = useMeta();
  const projectKey = routeProjectKey(useOptionalNavigation()?.route);
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
        {meta.data ? (
          <Setup meta={meta.data} projectKey={projectKey} />
        ) : (
          <MetaState query={meta} />
        )}
      </div>
    </Sheet>
  );
}

function Setup({ meta, projectKey }: { meta: ServerMeta; projectKey: string | null }) {
  const { copy, blocked } = useCopyCommand();
  const address = trackerAddress(meta.serverUrl, window.location.origin);
  const info: ConnectInfo = { ...meta, serverUrl: agentAddress(address) };
  return (
    <>
      <Section title="This tracker">
        <GroupedCard>
          <ul className={styles.rows}>
            <CommandRow
              command={info.serverUrl}
              description={addressNote(address, info.serverUrl)}
              copyLabel="Copy address"
              onCopy={(address) => copy(address, ADDRESS_COPY)}
            />
          </ul>
        </GroupedCard>
      </Section>
      {meta.authRequired ? <TokensSection /> : <OpenTrackerNote />}
      <SetupCommands
        info={info}
        repoRoot={meta.repoRoot}
        authRequired={meta.authRequired}
        onCopy={copy}
      />
      <SlashCommands projectKey={projectKey} onCopy={copy} />
      <WatchSection info={info} projectKey={projectKey} onCopy={copy} />
      <Section title="Without MCP">
        <GroupedCard>
          <ul className={styles.rows}>
            <CommandRow
              command={cliHelpCommand(info)}
              description="The same tools as a command line, for shells and agents without MCP."
              copyLabel="Copy CLI command"
              onCopy={copy}
            />
          </ul>
        </GroupedCard>
      </Section>
      {blocked && (
        <p role="alert" className={`${styles.error} fade-in`}>
          {blocked}
        </p>
      )}
      <VersionNote />
    </>
  );
}

interface SlashCommandsProps {
  projectKey: string | null;
  onCopy: CopyHandler;
}

function SlashCommands({ projectKey, onCopy }: SlashCommandsProps) {
  return (
    <Section title="Then, in Claude Code">
      <GroupedCard>
        <ul className={styles.rows}>
          <CommandRow
            command={slashCommand('work', projectKey)}
            description="Claims the next To do ticket, does the work and submits it for review."
            copyLabel="Copy work command"
            onCopy={onCopy}
          />
          <CommandRow
            command={slashCommand('review', projectKey)}
            description="Checks tickets in Need review, rates them and approves them or sends them back."
            copyLabel="Copy review command"
            onCopy={onCopy}
          />
        </ul>
      </GroupedCard>
      <p className={styles.note}>{projectKeyNote(projectKey)}</p>
    </Section>
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
