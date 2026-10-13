import { CircleDot, Ellipsis, PenLine, Plug, Tag, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { IconButton, MenuConfirm, MenuItem, Popover } from '../../components';
import styles from './ProjectOptionsMenu.module.css';
import { deleteMenuMessage } from './projectOptions';
import { ProjectUsageNote } from './ProjectUsageNote';
import { useProjectOptions } from './useProjectOptions';

export function ProjectOptionsMenu({ projectKey }: { projectKey: string }) {
  const options = useProjectOptions(projectKey);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = () => setOpen(false);
  // The item that had focus disappears with the menu, so focus goes back to the ••• button.
  const dismiss = () => {
    close();
    triggerRef.current?.focus();
  };
  const run = (action: () => void) => {
    dismiss();
    action();
  };
  const toggle = () => {
    setConfirming(false);
    options.resetDelete();
    setOpen(!open);
  };
  return (
    <Popover
      open={open}
      onClose={close}
      aria-label="Project options"
      trigger={
        <IconButton
          ref={triggerRef}
          aria-label="Project options"
          aria-expanded={open}
          icon={Ellipsis}
          onClick={toggle}
        />
      }
    >
      {confirming ? (
        <MenuConfirm
          message={options.error ?? deleteMenuMessage(options.ticketCount)}
          pending={options.pending}
          onCancel={dismiss}
          onConfirm={() => options.deleteProject(close)}
        />
      ) : (
        <>
          <MenuItem icon={PenLine} onClick={() => run(options.edit)}>
            Edit project
          </MenuItem>
          <MenuItem icon={CircleDot} onClick={() => run(options.manageStatuses)}>
            Manage statuses
          </MenuItem>
          <MenuItem icon={Tag} onClick={() => run(options.manageLabels)}>
            Manage labels
          </MenuItem>
          <MenuItem icon={Plug} onClick={() => run(options.connect)}>
            Connect Claude Code
          </MenuItem>
          <MenuItem icon={Trash2} tone="danger" onClick={() => setConfirming(true)}>
            Delete project
          </MenuItem>
          <ProjectUsageNote projectKey={projectKey} className={styles.usage} />
        </>
      )}
    </Popover>
  );
}
