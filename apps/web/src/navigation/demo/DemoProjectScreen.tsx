import clsx from 'clsx';
import {
  ArrowRight,
  ClipboardCheck,
  CircleDot,
  Ellipsis,
  GripVertical,
  Plus,
  Terminal,
  Trash2,
} from 'lucide-react';
import { PullToRefresh } from '../../gestures/PullToRefresh';
import { SwipeActions } from '../../gestures/SwipeActions';
import type { SwipeAction } from '../../gestures/swipeTypes';
import { BottomBar } from '../BottomBar';
import { NavBar } from '../NavBar';
import { NavBarButton } from '../NavBarButton';
import { useScreen } from '../ScreenContext';
import { useNavigation } from '../useNavigation';
import styles from './demo.module.css';
import { useDemo, type DemoActions } from './DemoContext';
import { NEXT_STATUS, STATUS_LABEL, type DemoProject, type DemoTicket } from './demoData';

const icon = { size: 20, strokeWidth: 1.75 } as const;

function rowActions(demo: DemoActions, key: string, ticket: DemoTicket) {
  const leading: SwipeAction[] = [
    {
      label: STATUS_LABEL[NEXT_STATUS[ticket.status]],
      icon: <ArrowRight {...icon} />,
      tone: 'accent',
      onTrigger: () => demo.advance(key, ticket.num),
    },
  ];
  const trailing: SwipeAction[] = [
    {
      label: 'Delete',
      icon: <Trash2 {...icon} />,
      tone: 'danger',
      onTrigger: () => demo.remove(key, ticket.num),
    },
    {
      label: 'Status',
      icon: <CircleDot {...icon} />,
      tone: 'neutral',
      onTrigger: () => demo.notify(`${key}-${ticket.num} is ${STATUS_LABEL[ticket.status]}`),
    },
  ];
  return { leading, trailing };
}

function TicketRows({ project }: { project: DemoProject }) {
  const demo = useDemo();
  const { push } = useNavigation();
  return (
    <div className={styles.group}>
      {project.tickets.map((ticket) => (
        <SwipeActions key={ticket.num} {...rowActions(demo, project.key, ticket)}>
          <div className={styles.ticketRow}>
            <span className={styles.handle} data-no-swipe="" aria-hidden="true">
              <GripVertical size={16} strokeWidth={1.75} />
            </span>
            <button
              type="button"
              className={clsx(styles.ticketMain, 'ring-inside')}
              onClick={() => push({ name: 'ticket', key: project.key, num: ticket.num })}
            >
              <span className={styles.key}>
                {project.key}-{ticket.num}
              </span>
              <span className={styles.status} data-status={ticket.status}>
                {STATUS_LABEL[ticket.status]}
              </span>
              <span className={styles.ticketTitle}>{ticket.title}</span>
            </button>
          </div>
        </SwipeActions>
      ))}
    </div>
  );
}

export function DemoProjectScreen({ projectKey }: { projectKey: string }) {
  const demo = useDemo();
  const { back } = useNavigation();
  const { scrollRef } = useScreen();
  const project = demo.projects.find((candidate) => candidate.key === projectKey);
  if (!project) return <p className={styles.page}>This project was deleted.</p>;
  return (
    <>
      <NavBar
        title={project.name}
        backLabel="Projects"
        right={
          <>
            <NavBarButton
              aria-label="Project options"
              onClick={() => demo.openOptions(project.key)}
            >
              <Ellipsis {...icon} />
            </NavBarButton>
            <NavBarButton aria-label="New ticket" onClick={() => demo.openSheet('ticket')}>
              <Plus {...icon} />
            </NavBarButton>
          </>
        }
      />
      <PullToRefresh onRefresh={demo.refresh} scrollRef={scrollRef}>
        <div className={styles.page}>
          <button type="button" className={clsx(styles.tool, 'desktop-only')} onClick={back}>
            ‹ Projects
          </button>
          <TicketRows project={project} />
        </div>
      </PullToRefresh>
      <BottomBar>
        <button
          type="button"
          className={clsx(styles.barButton, 'press')}
          onClick={() => demo.openSheet('report')}
        >
          <ClipboardCheck {...icon} /> Paste report
        </button>
        <button
          type="button"
          className={clsx(styles.barButton, styles.barPrimary, 'press')}
          onClick={() => demo.openSheet('prompt')}
        >
          <Terminal {...icon} /> Send open tickets
        </button>
      </BottomBar>
    </>
  );
}
