import clsx from 'clsx';
import { ClipboardCheck, Terminal } from 'lucide-react';
import { BottomBar } from '../BottomBar';
import { NavBar } from '../NavBar';
import { useNavigation } from '../useNavigation';
import styles from './demo.module.css';
import { useDemo } from './DemoContext';
import { DEMO_IMAGES, STATUS_LABEL } from './demoData';

const icon = { size: 20, strokeWidth: 1.75 } as const;

const PARAGRAPHS = Array.from(
  { length: 8 },
  (_, i) =>
    `Note ${i + 1}: scroll this screen, go back, then come here again from the same row. The project list keeps its scroll position because every level of the stack stays mounted.`,
);

export function DemoTicketScreen({ projectKey, num }: { projectKey: string; num: number }) {
  const demo = useDemo();
  const { back } = useNavigation();
  const project = demo.projects.find((candidate) => candidate.key === projectKey);
  const ticket = project?.tickets.find((candidate) => candidate.num === num);
  const key = `${projectKey}-${num}`;
  return (
    <>
      <NavBar title={key} mono backLabel={project?.name ?? projectKey} />
      <div className={styles.page}>
        <button type="button" className={clsx(styles.tool, 'desktop-only')} onClick={back}>
          ‹ {project?.name ?? projectKey}
        </button>
        <span className={styles.key}>{key}</span>
        <h1 className={styles.heading}>{ticket?.title ?? 'This ticket was deleted.'}</h1>
        {ticket && <p className={styles.meta}>{STATUS_LABEL[ticket.status]}</p>}
        <div className={styles.thumbs}>
          {DEMO_IMAGES.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={styles.thumb}
              aria-label={`Open ${image.alt}`}
              onClick={() => demo.openImages(index)}
            >
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
        <label className={styles.composer}>
          <span className="visually-hidden">Comment</span>
          <textarea rows={3} placeholder="Leave a comment… (the bottom bar hides while you type)" />
        </label>
        {PARAGRAPHS.map((text) => (
          <p key={text} className={styles.paragraph}>
            {text}
          </p>
        ))}
      </div>
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
          <Terminal {...icon} /> Send to Claude
        </button>
      </BottomBar>
    </>
  );
}
