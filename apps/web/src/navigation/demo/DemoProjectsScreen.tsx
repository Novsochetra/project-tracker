import clsx from 'clsx';
import { ChevronRight, Plus } from 'lucide-react';
import { PullToRefresh } from '../../gestures/PullToRefresh';
import { LargeTitle } from '../LargeTitle';
import { NavBar } from '../NavBar';
import { NavBarButton } from '../NavBarButton';
import { useScreen } from '../ScreenContext';
import { useNavigation } from '../useNavigation';
import styles from './demo.module.css';
import { useDemo } from './DemoContext';

const TIPS = [
  'Tap a project, then a ticket: screens slide in from the right edge.',
  'Drag from the very left edge to go back; let go early and it springs back.',
  'Pull this list down from the top to refresh.',
  'Swipe a ticket row right for the next status, left for Status and Delete.',
  'Open a sheet and drag its grabber or its top down to dismiss it.',
  'Open the images, pinch or double-tap to zoom, swipe sideways, swipe down to close.',
];

export function DemoProjectsScreen() {
  const demo = useDemo();
  const { push } = useNavigation();
  const { scrollRef } = useScreen();
  return (
    <>
      <NavBar
        title="Projects"
        right={
          <NavBarButton aria-label="New project" onClick={() => demo.openSheet('project')}>
            <Plus size={20} strokeWidth={1.75} />
          </NavBarButton>
        }
      />
      <PullToRefresh onRefresh={demo.refresh} scrollRef={scrollRef}>
        <div className={styles.page}>
          <LargeTitle aside={demo.projects.length}>Projects</LargeTitle>
          <ul className={styles.list}>
            {demo.projects.map((project) => (
              <li key={project.key}>
                <button
                  type="button"
                  className={clsx(styles.row, 'ring-inside')}
                  onClick={() => push({ name: 'project', key: project.key })}
                >
                  <span className={styles.square} aria-hidden="true" />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>
                      {project.name} <span className={styles.key}>{project.key}</span>
                    </span>
                    <span className={styles.rowMeta}>{project.description}</span>
                  </span>
                  <ChevronRight size={20} strokeWidth={1.75} className={styles.chevron} />
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.tools}>
            <button type="button" className={styles.tool} onClick={() => demo.openImages(0)}>
              Images
            </button>
            <button type="button" className={styles.tool} onClick={() => demo.openSheet('report')}>
              Long sheet
            </button>
            <button type="button" className={styles.tool} onClick={() => demo.openOptions('MOB')}>
              Action sheet
            </button>
            <button type="button" className={styles.tool} onClick={demo.exit}>
              Exit demo
            </button>
          </div>
          <ol className={styles.tips}>
            {[...TIPS, ...TIPS].map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ol>
        </div>
      </PullToRefresh>
    </>
  );
}
