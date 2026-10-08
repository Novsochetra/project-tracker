import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '../../components';
import { NavBarButton } from '../../navigation';
import { ActionSheet, type ActionSheetAction } from '../../overlays';
import { deleteSheetCaption } from './projectOptions';
import styles from './ProjectOptionsSheet.module.css';
import { useProjectOptions, type ProjectOptions } from './useProjectOptions';

interface SheetActions {
  close: () => void;
  confirm: () => void;
}

// The action sheet hands focus back to its trigger after it closes; opening the next sheet in a
// later task lets that sheet take focus and return it there too.
const afterClose =
  (close: () => void, action: () => void): (() => void) =>
  () => {
    close();
    window.setTimeout(action, 0);
  };

function menuActions(options: ProjectOptions, { close, confirm }: SheetActions) {
  const actions: ActionSheetAction[] = [
    { label: 'Edit project', onSelect: afterClose(close, options.edit) },
    { label: 'Manage statuses', onSelect: afterClose(close, options.manageStatuses) },
    { label: 'Connect Claude Code', onSelect: afterClose(close, options.connect) },
    { label: 'Delete project', tone: 'danger', onSelect: confirm },
  ];
  return actions;
}

export function ProjectOptionsSheet({ projectKey }: { projectKey: string }) {
  const options = useProjectOptions(projectKey);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = () => setOpen(false);
  const show = () => {
    setConfirming(false);
    options.resetDelete();
    setOpen(true);
  };
  const deleteAction: ActionSheetAction = {
    label: 'Delete project',
    tone: 'danger',
    bold: true,
    onSelect: () => options.deleteProject(close),
  };
  const caption = confirming ? (
    <span role="alert" className={styles.confirm}>
      {options.error ?? deleteSheetCaption(options.name, options.ticketCount)}
    </span>
  ) : (
    options.name
  );
  return (
    <>
      <NavBarButton aria-label="Project options" onClick={show}>
        <Icon icon={Ellipsis} size={20} />
      </NavBarButton>
      <ActionSheet
        open={open}
        onClose={close}
        label="Project options"
        caption={caption}
        actions={
          confirming
            ? [deleteAction]
            : menuActions(options, { close, confirm: () => setConfirming(true) })
        }
      />
    </>
  );
}
