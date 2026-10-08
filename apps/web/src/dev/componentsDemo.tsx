import { DEFAULT_STATUSES, PRIORITIES, PRIORITY_LABELS, isOverdue } from '@tracker/shared';
import type { Priority, StatusCategory } from '@tracker/shared';
import * as I from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import * as C from '../components';

const css = (style: CSSProperties) => style;
const row = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 });
const stack = css({ display: 'flex', flexDirection: 'column', gap: 16 });
const caption = css({ font: 'var(--text-caption)', color: 'var(--muted)' });
const mono = css({ ...caption, fontFamily: 'var(--font-mono)', fontWeight: 400 });
const clip = css({ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' });
const square = css({ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)' });
const head = css({ ...row, minHeight: 40, padding: '0 8px 0 16px', background: 'var(--fill)' });
const paper = css({ ...stack, gap: 8, padding: 16, borderRadius: 8, background: 'var(--surface)' });
const page = css({ ...stack, gap: 24, maxWidth: 1120, margin: '0 auto', padding: '40px 16px' });
const columns = 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))';
const grid = css({ display: 'grid', gridTemplateColumns: columns, gap: 24, paddingBottom: 160 });
const titleText = css({ font: 'var(--text-title)', letterSpacing: '-0.015em', padding: '4px 6px' });

const STATUS_OPTIONS = DEFAULT_STATUSES.map((status) => ({
  value: status.category,
  label: status.name,
  icon: <C.StatusGlyph category={status.category} color={status.color} />,
}));
const PRIORITY_OPTIONS = PRIORITIES.map((priority) => ({
  value: priority,
  label: PRIORITY_LABELS[priority],
  icon: <C.PriorityBars priority={priority} />,
}));
const FILTERS = [
  { value: 'all', label: 'All', count: 12 },
  { value: 'active', label: 'Active', count: 9 },
  { value: 'done', label: 'Done', count: 3 },
] as const;
const TICKETS = [
  { key: 'MOB-3', title: 'Crash when rotating the profile screen', priority: 'high', who: 'Dara' },
  { key: 'MOB-4', title: 'Dark mode colors for Settings', priority: 'medium', who: '' },
  { key: 'MOB-5', title: 'Update App Store screenshots', priority: 'low', who: 'Sophea' },
] as const;
const BUTTONS: [C.ButtonProps, string][] = [
  [{ variant: 'primary', icon: I.Plus }, 'New ticket'],
  [{ icon: I.ClipboardCheck }, 'Paste report'],
  [{ variant: 'text' }, 'Cancel'],
  [{ variant: 'danger' }, 'Delete'],
  [{ variant: 'primary', size: 'header', disabled: true }, 'Create'],
  [{ size: 'sm', icon: I.Terminal }, 'Send open tickets to Claude Code'],
  [{ variant: 'primary', size: 'lg' }, 'Send to Claude Code'],
  [{ variant: 'text', tone: 'danger', icon: I.Trash2 }, 'Delete ticket'],
  [{ size: 'bar', icon: I.ClipboardCheck, fullWidth: true }, 'Paste report (full width)'],
  [{ variant: 'primary', size: 'bar', icon: I.Terminal, style: { flex: 1.35 } }, 'Send to Claude'],
];
const ICON_BUTTONS: C.IconButtonProps[] = [
  { 'aria-label': 'Project options', icon: I.Ellipsis },
  { 'aria-label': 'New ticket in To do', icon: I.Plus, size: 'sm' },
  { 'aria-label': 'New project', icon: I.Plus, size: 'xs' },
  { 'aria-label': 'New ticket', icon: I.Plus, tone: 'ink' },
];
const PEOPLE = ['Dara', 'Sophea', 'Vanna Chan'];
const DELETE_PROJECT = "Delete this project and its 8 tickets? This can't be undone.";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ border: '1px solid var(--line)', borderRadius: 12 }}>
      <h2 style={{ margin: 0, padding: '14px 20px', font: 'var(--text-headline)' }}>{title}</h2>
      <div style={{ ...stack, padding: '24px 20px', background: 'var(--panel)', borderRadius: 12 }}>
        {children}
      </div>
    </section>
  );
}

function ButtonsDemo() {
  return (
    <Section title="Buttons">
      <div style={row}>
        {BUTTONS.map(([props, label]) => (
          <C.Button key={label} {...props}>
            {label}
          </C.Button>
        ))}
      </div>
      <div style={row}>
        {ICON_BUTTONS.map((props) => (
          <C.IconButton key={props['aria-label']} {...props} />
        ))}
      </div>
    </Section>
  );
}

function GlyphsDemo() {
  return (
    <Section title="Glyphs, avatars, rating">
      <div style={row}>
        {DEFAULT_STATUSES.map((status) => (
          <span key={status.category} style={{ ...row, gap: 6 }}>
            <C.StatusGlyph category={status.category} color={status.color} /> {status.name}
          </span>
        ))}
      </div>
      <div style={row}>
        {PRIORITIES.map((priority) => (
          <C.PriorityBars key={priority} priority={priority} />
        ))}
        <C.Avatar name="Sophea" />
        <C.Avatar name="Dara Kim" size={20} />
        <C.Avatar name="" />
        <C.AgentAvatar />
        <C.YouAvatar />
        <C.LogoGlyph />
        <C.StarRating value={4} />
        <C.Spinner />
      </div>
    </Section>
  );
}

function FieldsDemo() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('active');
  const [move, setMove] = useState(true);
  return (
    <Section title="Segmented, search, switch">
      <div style={{ ...row, justifyContent: 'space-between', gap: '10px 16px' }}>
        <C.Segmented aria-label="Filter" options={FILTERS} value={filter} onChange={setFilter} />
        <C.SearchField aria-label="Search tickets" placeholder="Search tickets" />
      </div>
      <C.GroupedCard>
        <div style={{ ...row, minHeight: 48, padding: '0 12px 0 14px' }}>
          <span style={{ flex: 1 }}>Move MOB-3 to In progress</span>
          <C.Switch checked={move} onChange={setMove} aria-label="Move to In progress when sent" />
        </div>
      </C.GroupedCard>
    </Section>
  );
}

function DetailsDemo() {
  const [status, setStatus] = useState<StatusCategory>('in_progress');
  const [prio, setPrio] = useState<Priority>('high');
  const [assignee, setAssignee] = useState('Dara');
  const [due, setDue] = useState('2026-10-05');
  return (
    <Section title="Property rows and dropdown">
      <C.GroupedCard dense>
        <C.SelectRow label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <C.SelectRow label="Priority" options={PRIORITY_OPTIONS} value={prio} onChange={setPrio} />
        <C.InputRow
          icon={<C.Avatar name={assignee} size={20} decorative />}
          label="Assignee"
          placeholder="Unassigned"
          suggestions={PEOPLE}
          value={assignee}
          onChange={(event) => setAssignee(event.currentTarget.value)}
        />
        <C.DateRow value={due} overdue={isOverdue(due, status === 'done')} onChange={setDue} />
      </C.GroupedCard>
      <C.GroupedCard>
        <C.InputRow icon={<C.Icon icon={I.Folder} />} label="Repository" mono placeholder="~/app" />
        <C.InputRow icon={<C.Icon icon={I.Hash} />} label="Ticket prefix" mono placeholder="MOB" />
        <C.DateRow value="" mutedIcon onChange={setDue} />
      </C.GroupedCard>
      <C.GroupedCard>
        <C.InfoRow label="Project">Mobile app</C.InfoRow>
        <C.InfoRow label="Created">Oct 2, 2026</C.InfoRow>
      </C.GroupedCard>
    </Section>
  );
}

function ListsDemo() {
  return (
    <Section title="Lists">
      <C.ListCard as="section" variant="group" aria-label="To do">
        <div style={head}>
          <C.StatusGlyph category="todo" color={DEFAULT_STATUSES[0]!.color} />
          <span style={{ flex: 1 }}>To do</span>
          <C.IconButton aria-label="New ticket in To do" icon={I.Plus} size="sm" />
        </div>
        {TICKETS.map((ticket) => (
          <C.ListRow key={ticket.key}>
            <C.PriorityBars priority={ticket.priority} />
            <span style={mono}>{ticket.key}</span>
            <C.StatusGlyph category="todo" color={DEFAULT_STATUSES[0]!.color} />
            <span style={{ ...clip, whiteSpace: 'nowrap' }}>{ticket.title}</span>
            <C.Avatar name={ticket.who} />
          </C.ListRow>
        ))}
      </C.ListCard>
      <C.ListCard>
        <C.ListRow style={{ minHeight: 60, gap: 16 }}>
          <span style={square} />
          <span style={clip}>Mobile app</span>
          <C.Icon icon={I.ChevronRight} size={20} style={{ color: 'var(--faint)' }} />
        </C.ListRow>
      </C.ListCard>
    </Section>
  );
}

function OptionsMenu() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = () => {
    setOpen(false);
    setConfirming(false);
  };
  const toggle = () => setOpen(!open);
  const trigger = (
    <C.IconButton aria-label="Options" aria-expanded={open} icon={I.Ellipsis} onClick={toggle} />
  );
  const confirm = (
    <C.ConfirmCard variant="menu" message={DELETE_PROJECT} onCancel={close} onConfirm={close} />
  );
  return (
    <C.Popover open={open} onClose={close} aria-label="Project options" trigger={trigger}>
      {confirming ? (
        confirm
      ) : (
        <>
          <C.MenuItem icon={I.PenLine} onClick={close}>
            Edit project
          </C.MenuItem>
          <C.MenuItem icon={I.Trash2} tone="danger" onClick={() => setConfirming(true)}>
            Delete project
          </C.MenuItem>
        </>
      )}
    </C.Popover>
  );
}

function ConfirmDemo() {
  const [deleting, setDeleting] = useState(false);
  const done = () => setDeleting(false);
  const message = "Delete MOB-3? This can't be undone.";
  if (deleting) return <C.ConfirmCard message={message} onCancel={done} onConfirm={done} />;
  return (
    <C.Button variant="text" tone="danger" icon={I.Trash2} onClick={() => setDeleting(true)}>
      Delete ticket
    </C.Button>
  );
}

function StatesDemo() {
  const action = <C.Button variant="primary">New project</C.Button>;
  return (
    <Section title="Menu, confirm, empty states">
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <ConfirmDemo />
        <OptionsMenu />
      </div>
      <C.EmptyState bordered icon={I.Folder} title="No projects yet" action={action} />
      <C.EmptyState icon={I.Plus} title="No tickets yet" text="Create the first ticket." />
    </Section>
  );
}

function TextDemo() {
  return (
    <Section title="Growing text">
      <div style={paper}>
        <span style={mono}>MOB-3</span>
        <C.AutoTextarea
          variant="inline"
          aria-label="Title"
          defaultValue="Crash"
          style={titleText}
        />
        <C.AutoTextarea variant="inline" aria-label="Description" placeholder="Add details…" />
        <C.AutoTextarea aria-label="Comment" placeholder="Leave a comment…" />
      </div>
    </Section>
  );
}

function ToastDemo() {
  const toast = C.useToast();
  const [raised, setRaised] = useState(false);
  C.useToastRaise(raised);
  return (
    <Section title="Toast">
      <div style={row}>
        <C.Button onClick={() => toast.show('MOB-7 created')}>Show toast</C.Button>
        <C.Button onClick={() => toast.show('Report applied to 2 tickets')}>Replace it</C.Button>
        <C.Switch checked={raised} onChange={setRaised} aria-label="Raise above the phone bar" />
        <span style={caption}>Raise above the phone bar</span>
      </div>
    </Section>
  );
}

export function ComponentsDemo() {
  return (
    <C.ToastProvider>
      <div style={page}>
        <header style={row}>
          <C.LogoGlyph />
          <h1 style={{ margin: 0, font: 'var(--text-heading)' }}>Components</h1>
        </header>
        <div style={grid}>
          <ButtonsDemo />
          <GlyphsDemo />
          <FieldsDemo />
          <ListsDemo />
          <StatesDemo />
          <TextDemo />
          <ToastDemo />
          <DetailsDemo />
        </div>
      </div>
    </C.ToastProvider>
  );
}
