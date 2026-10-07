import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';
import { MemoryRouter } from 'react-router';
import { ActionSheet } from '../../overlays/ActionSheet';
import { ImageViewer } from '../../overlays/ImageViewer';
import { useBottomBarVisible } from '../bottomBarStore';
import { NavigationProvider } from '../NavigationProvider';
import type { Route } from '../routes';
import { StackNavigator } from '../StackNavigator';
import { useNavigation } from '../useNavigation';
import styles from './demo.module.css';
import { DemoContext, useDemo, type DemoActions, type DemoSheet } from './DemoContext';
import {
  DEMO_IMAGES,
  INITIAL_PROJECTS,
  NEXT_STATUS,
  STATUS_LABEL,
  type DemoProject,
} from './demoData';
import { DemoScreen } from './DemoScreen';
import { DemoSheets } from './DemoSheets';

interface Options {
  key: string;
  open: boolean;
  confirming: boolean;
}

function ProjectOptions({
  options,
  onChange,
}: {
  options: Options;
  onChange: (next: Options) => void;
}) {
  const demo = useDemo();
  const { replace } = useNavigation();
  const project = demo.projects.find((candidate) => candidate.key === options.key);
  const close = () => onChange({ ...options, open: false });
  const name = project?.name ?? options.key;
  const remove = () => {
    demo.notify(`“${name}” deleted`);
    replace('/');
    close();
  };
  return (
    <ActionSheet
      open={options.open}
      onClose={close}
      label="Project options"
      caption={
        options.confirming
          ? `Delete “${name}” and its ${project?.tickets.length ?? 0} tickets? This can't be undone.`
          : name
      }
      actions={
        options.confirming
          ? [{ label: 'Delete project', tone: 'danger', bold: true, onSelect: remove }]
          : [
              { label: 'Edit project', onSelect: () => (demo.openSheet('project'), close()) },
              {
                label: 'Delete project',
                tone: 'danger',
                onSelect: () => onChange({ ...options, confirming: true }),
              },
            ]
      }
    />
  );
}

function DemoToast({ message }: { message: { id: number; text: string } | null }) {
  const raised = useBottomBarVisible();
  return (
    <div role="status" className={clsx(styles.toastRegion, raised && styles.toastRaised)}>
      {message && (
        <span key={message.id} className={styles.toast}>
          {message.text}
        </span>
      )}
    </div>
  );
}

const updateTicket = (projects: DemoProject[], key: string, num: number, remove: boolean) =>
  projects.map((project) =>
    project.key !== key
      ? project
      : {
          ...project,
          tickets: remove
            ? project.tickets.filter((ticket) => ticket.num !== num)
            : project.tickets.map((ticket) =>
                ticket.num === num ? { ...ticket, status: NEXT_STATUS[ticket.status] } : ticket,
              ),
        },
  );

export function DemoApp({ onExit }: { onExit: () => void }) {
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [sheet, setSheet] = useState<DemoSheet | null>(null);
  const [options, setOptions] = useState<Options>({ key: 'MOB', open: false, confirming: false });
  const [viewer, setViewer] = useState({ open: false, index: 0 });
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null);
  const notify = useCallback(
    (text: string) => setMessage((last) => ({ id: (last?.id ?? 0) + 1, text })),
    [],
  );

  const demo = useMemo<DemoActions>(() => {
    const statusOf = (key: string, num: number) =>
      projects.find((project) => project.key === key)?.tickets.find((ticket) => ticket.num === num)
        ?.status;
    return {
      projects,
      advance: (key, num) => {
        const status = statusOf(key, num);
        setProjects((current) => updateTicket(current, key, num, false));
        if (status) notify(`${key}-${num} moved to ${STATUS_LABEL[NEXT_STATUS[status]]}`);
      },
      remove: (key, num) => {
        setProjects((current) => updateTicket(current, key, num, true));
        notify(`${key}-${num} deleted`);
      },
      refresh: () =>
        new Promise<void>((resolve) => setTimeout(resolve, 1200)).then(() => notify('Up to date')),
      openSheet: setSheet,
      openOptions: (key) => setOptions({ key, open: true, confirming: false }),
      openImages: (index) => setViewer({ open: true, index }),
      exit: onExit,
      notify,
    };
  }, [projects, notify, onExit]);
  const renderScreen = useCallback((route: Route) => <DemoScreen route={route} />, []);

  return (
    <div className={styles.app}>
      <DemoContext value={demo}>
        <MemoryRouter>
          <NavigationProvider>
            <StackNavigator renderScreen={renderScreen} />
            <DemoSheets sheet={sheet} onClose={() => setSheet(null)} notify={notify} />
            <ProjectOptions options={options} onChange={setOptions} />
          </NavigationProvider>
        </MemoryRouter>
        <ImageViewer
          images={DEMO_IMAGES}
          index={viewer.index}
          open={viewer.open}
          onClose={() => setViewer((current) => ({ ...current, open: false }))}
          onIndexChange={(index) => setViewer((current) => ({ ...current, index }))}
        />
        <DemoToast message={message} />
      </DemoContext>
    </div>
  );
}
