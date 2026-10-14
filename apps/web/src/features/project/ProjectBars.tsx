import { projectDisplayName, projectDisplayRepo, type Project } from '@tracker/shared';
import { ClipboardCheck, Folder, MessageCircle, Plus, Terminal } from 'lucide-react';
import { ASK_LABEL } from '../../app/crumbs';
import { useSheets } from '../../app/sheets/context';
import { Button, Icon } from '../../components';
import { useIsPhone } from '../../lib/media';
import { BottomBar, NavBar, NavBarButton, useNavigation } from '../../navigation';
import { ProjectOptionsButton } from '../projects/ProjectOptionsButton';
import styles from './ProjectScreen.module.css';

const projectScope = (projectKey: string) => ({ kind: 'project', projectKey }) as const;

export function ProjectNavBar({ project }: { project: Project }) {
  const sheets = useSheets();
  return (
    <NavBar
      title={projectDisplayName(project)}
      backLabel="Projects"
      right={
        <>
          <ProjectOptionsButton projectKey={project.key} placement="navbar" />
          <NavBarButton
            aria-label="New ticket"
            onClick={() => sheets.open({ type: 'newTicket', projectKey: project.key })}
          >
            <Icon icon={Plus} size={20} />
          </NavBarButton>
        </>
      }
    />
  );
}

// Its own screen, so a chat survives the sheets and the back gesture like a ticket does.
function useOpenAsk(projectKey: string): () => void {
  const { push } = useNavigation();
  return () => push({ name: 'chats', key: projectKey });
}

export function ProjectBottomBar({ projectKey }: { projectKey: string }) {
  const sheets = useSheets();
  const openAsk = useOpenAsk(projectKey);
  const scope = projectScope(projectKey);
  return (
    <BottomBar>
      <Button
        variant="secondary"
        size="bar"
        icon={MessageCircle}
        aria-label={ASK_LABEL}
        className={styles.barSquare}
        onClick={openAsk}
      />
      <Button
        variant="secondary"
        size="bar"
        icon={ClipboardCheck}
        aria-label="Paste report"
        className={styles.barSquare}
        onClick={() => sheets.open({ type: 'report', scope })}
      />
      <Button
        variant="primary"
        size="bar"
        icon={Terminal}
        aria-label="Send open tickets"
        className={styles.barSend}
        onClick={() => sheets.open({ type: 'prompt', scope })}
      >
        <span className={styles.sendLabel}>Send open tickets</span>
        <span className={styles.sendShortLabel}>Send</span>
      </Button>
    </BottomBar>
  );
}

export function ProjectToolbar({ project }: { project: Project }) {
  const sheets = useSheets();
  const openAsk = useOpenAsk(project.key);
  const isPhone = useIsPhone();
  const scope = projectScope(project.key);
  const repo = projectDisplayRepo(project);
  if (isPhone) return null;
  return (
    <div className={styles.toolbar}>
      {repo && (
        <span className={styles.repo} title={repo}>
          <Icon icon={Folder} size={14} />
          <span className={styles.repoPath}>{repo}</span>
        </span>
      )}
      <Button size="sm" icon={MessageCircle} onClick={openAsk}>
        {ASK_LABEL}
      </Button>
      <Button size="sm" icon={Terminal} onClick={() => sheets.open({ type: 'prompt', scope })}>
        Send open tickets to Claude Code
      </Button>
      <Button
        size="sm"
        icon={ClipboardCheck}
        onClick={() => sheets.open({ type: 'report', scope })}
      >
        Paste report
      </Button>
    </div>
  );
}
