import { GroupedCard } from '../../components';
import { CommandRow } from './CommandRow';
import { projectKeyNote, slashCommand } from './connectCommand';
import styles from './ConnectSheet.module.css';
import { Section } from './Section';
import type { CopyHandler } from './useCopyCommand';

export interface SlashCommandsProps {
  projectKey: string | null;
  onCopy: CopyHandler;
}

export function SlashCommands({ projectKey, onCopy }: SlashCommandsProps) {
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
