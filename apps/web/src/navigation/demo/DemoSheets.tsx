import { useRef, useState, type FormEvent } from 'react';
import { Sheet } from '../../overlays/Sheet';
import { SheetActionButton, SheetTextButton } from '../../overlays/SheetButtons';
import styles from './demo.module.css';
import type { DemoSheet } from './DemoContext';

interface SheetDemoProps {
  open: boolean;
  onClose: () => void;
  notify: (message: string) => void;
}

function CreateSheet({
  open,
  onClose,
  notify,
  kind,
}: SheetDemoProps & { kind: 'ticket' | 'project' }) {
  const [name, setName] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const noun = kind === 'ticket' ? 'ticket' : 'project';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    notify(`“${name.trim()}” created`);
    setName('');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={`New ${noun}`}
      title={`New ${noun}`}
      subtitle={
        kind === 'ticket' ? (
          <>
            <span className={styles.dot} aria-hidden="true" />
            Mobile app
          </>
        ) : undefined
      }
      left={<SheetTextButton onClick={onClose}>Cancel</SheetTextButton>}
      right={
        <SheetActionButton type="submit" disabled={!name.trim()}>
          Create
        </SheetActionButton>
      }
      initialFocusRef={nameRef}
      onSubmit={submit}
    >
      <div className={styles.sheetBody}>
        <input
          ref={nameRef}
          className={styles.nameInput}
          aria-label={kind === 'ticket' ? 'Ticket title' : 'Project name'}
          placeholder={kind === 'ticket' ? 'Ticket title' : 'Project name'}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <textarea
          className={styles.descInput}
          rows={3}
          aria-label="Description"
          placeholder="Add details…"
        />
        <div className={styles.card}>
          <div className={styles.prop}>
            Status <span>To do</span>
          </div>
          <div className={styles.prop}>
            Priority <span>Medium</span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function LongSheet({ open, onClose }: SheetDemoProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Long sheet"
      title="Long sheet"
      subtitle="Mobile app"
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
    >
      <div className={styles.sheetBody}>
        <p className={styles.help}>
          This sheet scrolls inside. Dragging down only dismisses once the list is back at the top.
        </p>
        <div className={styles.card}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className={styles.prop}>
              MOB-{i + 1} <span>{i % 3 === 0 ? 'To do' : 'In progress → Done'}</span>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

export function DemoSheets({
  sheet,
  onClose,
  notify,
}: { sheet: DemoSheet | null } & Omit<SheetDemoProps, 'open'>) {
  const shared = { onClose, notify };

  return (
    <>
      <CreateSheet kind="ticket" open={sheet === 'ticket'} {...shared} />
      <CreateSheet kind="project" open={sheet === 'project'} {...shared} />
      <LongSheet open={sheet === 'long'} {...shared} />
    </>
  );
}
