import { DEFAULT_STATUSES, PRIORITIES, PRIORITY_LABELS, isOverdue } from '@tracker/shared';
import type { Priority, StatusCategory } from '@tracker/shared';
import * as Icons from 'lucide-react';
import { useState } from 'react';
import { DemoSection } from './DemoSection';
import { clip, grid, head, mono, page, row, square } from './demoStyles';
import { StatesDemo, TextDemo, ToastDemo } from './feedbackDemos';
import * as Gallery from './galleryComponents';

const STATUS_OPTIONS = DEFAULT_STATUSES.map((status) => ({
  value: status.category,
  label: status.name,
  icon: <Gallery.StatusGlyph category={status.category} color={status.color} />,
}));
const PRIORITY_OPTIONS = PRIORITIES.map((priority) => ({
  value: priority,
  label: PRIORITY_LABELS[priority],
  icon: <Gallery.PriorityBars priority={priority} />,
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
const BUTTONS: [Gallery.ButtonProps, string][] = [
  [{ variant: 'primary', icon: Icons.Plus }, 'New ticket'],
  [{ icon: Icons.Paperclip }, 'Add files'],
  [{ variant: 'text' }, 'Cancel'],
  [{ variant: 'danger' }, 'Delete'],
  [{ variant: 'primary', size: 'header', disabled: true }, 'Create'],
  [{ size: 'sm', icon: Icons.Plug }, 'Connect Claude Code'],
  [{ variant: 'primary', size: 'lg', icon: Icons.Check }, 'Move to Done'],
  [{ variant: 'text', tone: 'danger', icon: Icons.Trash2 }, 'Delete ticket'],
  [{ size: 'bar', icon: Icons.MessageSquare, fullWidth: true }, 'Comment (full width)'],
  [
    { variant: 'primary', size: 'bar', icon: Icons.Plus, style: { flex: 1.35 } },
    'New ticket (bar)',
  ],
];
const ICON_BUTTONS: Gallery.IconButtonProps[] = [
  { 'aria-label': 'Project options', icon: Icons.Ellipsis },
  { 'aria-label': 'New ticket in To do', icon: Icons.Plus, size: 'sm' },
  { 'aria-label': 'New project', icon: Icons.Plus, size: 'xs' },
  { 'aria-label': 'New ticket', icon: Icons.Plus, tone: 'ink' },
];
const PEOPLE = ['Dara', 'Sophea', 'Vanna Chan'];

function ButtonsDemo() {
  return (
    <DemoSection title="Buttons">
      <div style={row}>
        {BUTTONS.map(([props, label]) => (
          <Gallery.Button key={label} {...props}>
            {label}
          </Gallery.Button>
        ))}
      </div>
      <div style={row}>
        {ICON_BUTTONS.map((props) => (
          <Gallery.IconButton key={props['aria-label']} {...props} />
        ))}
      </div>
    </DemoSection>
  );
}

function GlyphsDemo() {
  return (
    <DemoSection title="Glyphs, avatars, rating">
      <div style={row}>
        {DEFAULT_STATUSES.map((status) => (
          <span key={status.category} style={{ ...row, gap: 6 }}>
            <Gallery.StatusGlyph category={status.category} color={status.color} /> {status.name}
          </span>
        ))}
      </div>
      <div style={row}>
        {PRIORITIES.map((priority) => (
          <Gallery.PriorityBars key={priority} priority={priority} />
        ))}
        <Gallery.Avatar name="Sophea" />
        <Gallery.Avatar name="Dara Kim" size={20} />
        <Gallery.Avatar name="" />
        <Gallery.AgentAvatar />
        <Gallery.YouAvatar />
        <Gallery.LogoGlyph />
        <Gallery.StarRating value={4} />
        <Gallery.Spinner />
      </div>
    </DemoSection>
  );
}

function FieldsDemo() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('active');
  const [move, setMove] = useState(true);

  return (
    <DemoSection title="Segmented, search, switch">
      <div style={{ ...row, justifyContent: 'space-between', gap: '10px 16px' }}>
        <Gallery.Segmented
          aria-label="Filter"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
        <Gallery.SearchField aria-label="Search tickets" placeholder="Search tickets" />
      </div>
      <Gallery.GroupedCard>
        <div style={{ ...row, minHeight: 48, padding: '0 12px 0 14px' }}>
          <span style={{ flex: 1 }}>Move MOB-3 to In progress</span>
          <Gallery.Switch
            checked={move}
            onChange={setMove}
            aria-label="Move to In progress when sent"
          />
        </div>
      </Gallery.GroupedCard>
    </DemoSection>
  );
}

function DetailsDemo() {
  const [status, setStatus] = useState<StatusCategory>('in_progress');
  const [prio, setPrio] = useState<Priority>('high');
  const [assignee, setAssignee] = useState('Dara');
  const [due, setDue] = useState('2026-10-05');

  return (
    <DemoSection title="Property rows and dropdown">
      <Gallery.GroupedCard dense>
        <Gallery.SelectRow
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
        />
        <Gallery.SelectRow
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={prio}
          onChange={setPrio}
        />
        <Gallery.InputRow
          icon={<Gallery.Avatar name={assignee} size={20} decorative />}
          label="Assignee"
          placeholder="Unassigned"
          suggestions={PEOPLE}
          value={assignee}
          onChange={(event) => setAssignee(event.currentTarget.value)}
        />
        <Gallery.DateRow value={due} overdue={isOverdue(due, status)} onChange={setDue} />
      </Gallery.GroupedCard>
      <Gallery.GroupedCard>
        <Gallery.InputRow
          icon={<Gallery.Icon icon={Icons.Folder} />}
          label="Repository"
          mono
          placeholder="~/app"
        />
        <Gallery.InputRow
          icon={<Gallery.Icon icon={Icons.Hash} />}
          label="Ticket prefix"
          mono
          placeholder="MOB"
        />
        <Gallery.DateRow value="" mutedIcon onChange={setDue} />
      </Gallery.GroupedCard>
      <Gallery.GroupedCard>
        <Gallery.InfoRow label="Project">Mobile app</Gallery.InfoRow>
        <Gallery.InfoRow label="Created">Oct 2, 2026</Gallery.InfoRow>
      </Gallery.GroupedCard>
    </DemoSection>
  );
}

function ListsDemo() {
  return (
    <DemoSection title="Lists">
      <Gallery.ListCard as="section" variant="group" aria-label="To do">
        <div style={head}>
          <Gallery.StatusGlyph category="todo" color={DEFAULT_STATUSES[0]!.color} />
          <span style={{ flex: 1 }}>To do</span>
          <Gallery.IconButton aria-label="New ticket in To do" icon={Icons.Plus} size="sm" />
        </div>
        {TICKETS.map((ticket) => (
          <Gallery.ListRow key={ticket.key}>
            <Gallery.PriorityBars priority={ticket.priority} />
            <span style={mono}>{ticket.key}</span>
            <Gallery.StatusGlyph category="todo" color={DEFAULT_STATUSES[0]!.color} />
            <span style={{ ...clip, whiteSpace: 'nowrap' }}>{ticket.title}</span>
            <Gallery.Avatar name={ticket.who} />
          </Gallery.ListRow>
        ))}
      </Gallery.ListCard>
      <Gallery.ListCard>
        <Gallery.ListRow style={{ minHeight: 60, gap: 16 }}>
          <span style={square} />
          <span style={clip}>Mobile app</span>
          <Gallery.Icon icon={Icons.ChevronRight} size={20} style={{ color: 'var(--faint)' }} />
        </Gallery.ListRow>
      </Gallery.ListCard>
    </DemoSection>
  );
}

export function ComponentsDemo() {
  return (
    <Gallery.ToastProvider>
      <div style={page}>
        <header style={row}>
          <Gallery.LogoGlyph />
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
    </Gallery.ToastProvider>
  );
}
