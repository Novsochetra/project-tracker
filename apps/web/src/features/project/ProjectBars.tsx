import { projectDisplayName, projectDisplayRepo, type Project } from '@tracker/shared';
import { Folder, Plus } from 'lucide-react';
import { useSheets } from '../../app/sheets/context';
import { Button, Icon } from '../../components';
import { useIsPhone } from '../../lib/media';
import { BottomBar, NavBar } from '../../navigation';
import { ProjectOptionsButton } from '../projects/ProjectOptionsButton';
import styles from './ProjectScreen.module.css';

// New ticket is the bottom bar's, so the nav bar keeps only the project's options (PT-215: one
// New ticket a screen).
export function ProjectNavBar({ project }: { project: Project }) {
  return (
    <NavBar
      title={projectDisplayName(project)}
      backLabel="Projects"
      right={<ProjectOptionsButton projectKey={project.key} placement="navbar" />}
    />
  );
}

export function ProjectBottomBar({ projectKey }: { projectKey: string }) {
  const sheets = useSheets();

  return (
    <BottomBar>
      <Button
        variant="primary"
        size="bar"
        icon={Plus}
        fullWidth
        onClick={() => sheets.open({ type: 'newTicket', projectKey })}
      >
        New ticket
      </Button>
    </BottomBar>
  );
}

export function ProjectToolbar({ project }: { project: Project }) {
  const isPhone = useIsPhone();
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
    </div>
  );
}
