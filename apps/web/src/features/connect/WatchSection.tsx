import { GroupedCard } from '../../components';
import { CommandRow } from './CommandRow';
import { isLocalTracker, watchCommand, type ConnectInfo } from './connectCommand';
import styles from './ConnectSheet.module.css';
import { HelperList } from './HelperList';
import { Section } from './Section';
import type { CopyHandler } from './useCopyCommand';

export interface WatchSectionProps {
  info: ConnectInfo;
  projectKey: string | null;
  onCopy: CopyHandler;
}

export function WatchSection({ info, projectKey, onCopy }: WatchSectionProps) {
  return (
    <Section title="Run Claude Code from your phone">
      <p className={styles.help}>
        Run this in the project’s code folder and leave it open. Run in Claude Code on a ticket then
        starts Claude Code there.
        {!isLocalTracker(info.serverUrl) && ' Put your project-tracker folder’s path in it first.'}
      </p>
      <GroupedCard>
        <ul className={styles.rows}>
          <CommandRow
            command={watchCommand(info, projectKey)}
            description="Waits for your runs and works on one ticket at a time, in this folder. Add --install to start it by itself when you log in to your Mac."
            copyLabel="Copy watch command"
            onCopy={onCopy}
          />
        </ul>
      </GroupedCard>
      <HelperList />
    </Section>
  );
}
