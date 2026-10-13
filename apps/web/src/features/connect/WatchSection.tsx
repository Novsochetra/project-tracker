import { GroupedCard } from '../../components';
import { CommandRow } from './CommandRow';
import { isLocalTracker, watchCommand, type ConnectInfo } from './connectCommand';
import styles from './ConnectSheet.module.css';
import { HelperList } from './HelperList';
import { ALWAYS_ON, WATCH_LIMITS } from './helperText';
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
            description="Waits for your runs and works on one ticket at a time, in this folder. Add --install to start it by itself: at login on a Mac, at boot on Linux."
            copyLabel="Copy watch command"
            onCopy={onCopy}
          />
        </ul>
      </GroupedCard>
      <p className={styles.note}>{WATCH_LIMITS}</p>
      <p className={styles.note}>{ALWAYS_ON}</p>
      <HelperList />
    </Section>
  );
}
