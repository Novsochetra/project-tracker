import { Plus } from 'lucide-react';
import { useProjects } from '../../api';
import { useSheets } from '../../app/sheets/context';
import { Button } from '../../components';
import { CaptureButton, canCapture } from '../capture';
import styles from './ProjectsHeaderActions.module.css';

// New ticket is the screen's one primary action: tickets are made every day, projects rarely.
export function ProjectsHeaderActions() {
  const sheets = useSheets();
  const capture = canCapture(useProjects().data);
  return (
    <div className={styles.actions}>
      <Button icon={Plus} onClick={() => sheets.open({ type: 'newProject' })}>
        New project
      </Button>
      {capture && (
        <CaptureButton variant="primary" onClick={() => sheets.open({ type: 'capture' })} />
      )}
    </div>
  );
}
