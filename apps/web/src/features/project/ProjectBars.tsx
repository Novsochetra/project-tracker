import type { Project } from '@tracker/shared';
import { ClipboardCheck, Folder, Plus, Terminal } from 'lucide-react';
import { useSheets } from '../../app/sheets/context';
import { Button, Icon } from '../../components';
import { useIsPhone } from '../../lib/media';
import { BottomBar, NavBar, NavBarButton } from '../../navigation';
import { ProjectOptionsButton } from '../projects/ProjectOptionsButton';
import styles from './ProjectScreen.module.css';

const projectScope = (projectKey: string) => ({ kind: 'project', projectKey }) as const;

export function ProjectNavBar({ project }: { project: Project }) {
  const sheets = useSheets();
  return (
    <NavBar
      title={project.name}
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

export function ProjectBottomBar({ projectKey }: { projectKey: string }) {
  const sheets = useSheets();
  const scope = projectScope(projectKey);
  return (
    <BottomBar>
      <Button
        variant="secondary"
        size="bar"
        icon={ClipboardCheck}
        className={styles.barReport}
        onClick={() => sheets.open({ type: 'report', scope })}
      >
        Paste report
      </Button>
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
  const isPhone = useIsPhone();
  const scope = projectScope(project.key);
  if (isPhone) return null;
  return (
    <div className={styles.toolbar}>
      {project.repo && (
        <span className={styles.repo} title={project.repo}>
          <Icon icon={Folder} size={14} />
          <span className={styles.repoPath}>{project.repo}</span>
        </span>
      )}
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
