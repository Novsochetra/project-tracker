import { Plus } from 'lucide-react';
import { Button } from '../components';
import { ProjectOptionsButton } from '../features/projects/ProjectOptionsButton';
import { useProjectSummary } from '../features/projects/useProjectSummary';
import { useNavigation, type Route } from '../navigation';
import { Breadcrumb } from './Breadcrumb';
import { breadcrumbFor, projectKeyOf } from './crumbs';
import styles from './DesktopHeader.module.css';
import { useSheets } from './sheets/context';

function HeaderActions({ route, projectKey }: { route: Route; projectKey: string }) {
  const sheets = useSheets();
  switch (route.name) {
    case 'projects':
      return (
        <Button variant="primary" icon={Plus} onClick={() => sheets.open({ type: 'newProject' })}>
          New project
        </Button>
      );
    case 'project':
      return (
        <div className={styles.actions}>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => sheets.open({ type: 'newTicket', projectKey })}
          >
            New ticket
          </Button>
          <ProjectOptionsButton projectKey={projectKey} placement="header" />
        </div>
      );
    case 'ticket':
      return null;
  }
}

export function DesktopHeader() {
  const { route } = useNavigation();
  const routeKey = projectKeyOf(route) ?? '';
  const project = useProjectSummary(routeKey);
  return (
    <header className={styles.header}>
      <Breadcrumb crumbs={breadcrumbFor(route, project)} />
      <HeaderActions route={route} projectKey={project?.key ?? routeKey} />
    </header>
  );
}
