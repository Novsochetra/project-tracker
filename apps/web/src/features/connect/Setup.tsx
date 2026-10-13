import type { ServerMeta } from '@tracker/shared';
import type { ReactNode } from 'react';
import { GroupedCard } from '../../components';
import { VersionNote } from '../version/VersionNote';
import { Columns } from './Columns';
import { CommandRow } from './CommandRow';
import { addressNote, agentAddress } from './agentAddress';
import { cliHelpCommand, trackerAddress, type ConnectInfo } from './connectCommand';
import styles from './ConnectSheet.module.css';
import { Section } from './Section';
import { SetupCommands } from './SetupCommands';
import { SlashCommands } from './SlashCommands';
import { ADDRESS_COPY } from './tokenText';
import { OpenTrackerNote, TokensSection } from './TokensSection';
import { useCopyCommand, type CopyHandler } from './useCopyCommand';
import { WatchSection } from './WatchSection';

export interface SetupProps {
  meta: ServerMeta;
  projectKey: string | null;
  intro: ReactNode;
}

interface TrackerAddressProps {
  address: string;
  serverUrl: string;
  onCopy: CopyHandler;
}

// The address sits in the narrow column and has no spaces, so it wraps rather than hiding most of
// itself behind the sideways scroll.
function TrackerAddress({ address, serverUrl, onCopy }: TrackerAddressProps) {
  return (
    <Section title="This tracker">
      <GroupedCard>
        <ul className={styles.rows}>
          <CommandRow
            command={serverUrl}
            description={addressNote(address, serverUrl)}
            wraps
            copyLabel="Copy address"
            onCopy={(command) => onCopy(command, ADDRESS_COPY)}
          />
        </ul>
      </GroupedCard>
    </Section>
  );
}

function WithoutMcp({ info, onCopy }: { info: ConnectInfo; onCopy: CopyHandler }) {
  return (
    <Section title="Without MCP">
      <GroupedCard>
        <ul className={styles.rows}>
          <CommandRow
            command={cliHelpCommand(info)}
            description="The same tools as a command line, for shells and agents without MCP."
            copyLabel="Copy CLI command"
            onCopy={onCopy}
          />
        </ul>
      </GroupedCard>
    </Section>
  );
}

// The overview, address and tokens sit beside the commands on a wide screen, so the long
// commands get the wider column and the sheet needs less scrolling.
export function Setup({ meta, projectKey, intro }: SetupProps) {
  const { copy, blocked } = useCopyCommand();
  const address = trackerAddress(meta.serverUrl, window.location.origin);
  const info: ConnectInfo = { ...meta, serverUrl: agentAddress(address) };
  const aside = (
    <>
      {intro}
      <TrackerAddress address={address} serverUrl={info.serverUrl} onCopy={copy} />
      {meta.authRequired ? <TokensSection /> : <OpenTrackerNote />}
    </>
  );
  const main = (
    <>
      <SetupCommands
        info={info}
        repoRoot={meta.repoRoot}
        authRequired={meta.authRequired}
        onCopy={copy}
      />
      <SlashCommands projectKey={projectKey} onCopy={copy} />
      <WatchSection info={info} projectKey={projectKey} onCopy={copy} />
      <WithoutMcp info={info} onCopy={copy} />
      {blocked && (
        <p role="alert" className={`${styles.error} fade-in`}>
          {blocked}
        </p>
      )}
      <VersionNote />
    </>
  );
  return <Columns aside={aside} main={main} />;
}
