import { Copy } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Sheet } from '../../overlays/Sheet';
import { SheetActionButton, SheetTextButton } from '../../overlays/SheetButtons';
import styles from './demo.module.css';
import type { DemoSheet } from './DemoContext';
import { DEMO_PROMPT } from './demoData';

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

function PromptSheet({ open, onClose, notify }: SheetDemoProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="prompt"
      label="Send to Claude Code"
      title="Send to Claude Code"
      subtitle="MOB-3 · Crash when rotating"
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
      footer={
        <button
          type="button"
          className={styles.footerButton}
          onClick={() => notify('Prompt copied')}
        >
          <Copy size={16} strokeWidth={1.75} /> Copy prompt
        </button>
      }
    >
      <div className={styles.sheetBody}>
        <p className={styles.help}>Paste this into Claude Code. Drag the header down to dismiss.</p>
        <textarea
          className={styles.prompt}
          aria-label="Prompt for Claude Code"
          rows={12}
          readOnly
          value={DEMO_PROMPT}
        />
      </div>
    </Sheet>
  );
}

function ReportSheet({ open, onClose, notify }: SheetDemoProps) {
  const apply = (event: FormEvent) => {
    event.preventDefault();
    notify('Report applied to 2 tickets');
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="report"
      label="Paste Claude Code report"
      title="Paste report"
      subtitle="Mobile app"
      left={<SheetTextButton onClick={onClose}>Cancel</SheetTextButton>}
      right={<SheetActionButton type="submit">Apply</SheetActionButton>}
      onSubmit={apply}
    >
      <div className={styles.sheetBody}>
        <p className={styles.help}>
          This sheet scrolls inside. Dragging down only dismisses once the list is back at the top.
        </p>
        <div className={styles.card}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className={styles.prop}>
              MOB-{i + 1} <span>{i % 3 === 0 ? 'Skipped' : 'In progress → Done'}</span>
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
      <PromptSheet open={sheet === 'prompt'} {...shared} />
      <ReportSheet open={sheet === 'report'} {...shared} />
    </>
  );
}
