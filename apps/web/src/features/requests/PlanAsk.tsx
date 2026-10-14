import { RUN_REQUEST_ANSWER_MAX, type PlanMode, type RunRequest } from '@tracker/shared';
import { ClipboardList } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Button } from '../../components';
import { Markdown } from '../ask/markdown/Markdown';
import {
  APPROVE_AUTO_LABEL,
  APPROVE_EDIT_LABEL,
  KEEP_PLANNING_LABEL,
  PLAN_CUT_TEXT,
  PLAN_HEAD,
  PLAN_NOTE_LABEL,
  PLAN_NOTE_PLACEHOLDER,
} from './copy';
import { RequestHead } from './RequestHead';
import { revealActions } from './revealActions';
import { approvePlan, keepPlanning } from './requestAnswers';
import styles from './Requests.module.css';
import type { Answer } from './useAnswer';

export function PlanAsk({ request, answer }: { request: RunRequest; answer: Answer }) {
  const [note, setNote] = useState('');
  const keepRef = useRef<HTMLDivElement>(null);
  const approve = (mode: PlanMode) => (event: MouseEvent<HTMLElement>) =>
    answer.send(approvePlan(mode), event);
  const keep = (event?: MouseEvent<HTMLElement>) => answer.send(keepPlanning(note), event);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    keep();
  };
  return (
    <>
      <RequestHead icon={ClipboardList} text={PLAN_HEAD} />
      <div className={styles.plan}>
        <Markdown className={styles.planText} text={request.label} />
      </div>
      {request.labelCut && <p className={styles.cut}>{PLAN_CUT_TEXT}</p>}
      <div className={styles.buttons}>
        <Button variant="primary" size="lg" disabled={answer.pending} onClick={approve('edit')}>
          {APPROVE_EDIT_LABEL}
        </Button>
        <Button size="lg" disabled={answer.pending || request.labelCut} onClick={approve('auto')}>
          {APPROVE_AUTO_LABEL}
        </Button>
      </div>
      <div ref={keepRef} className={styles.keep}>
        <input
          type="text"
          className={`${styles.other} ${styles.note}`}
          value={note}
          placeholder={PLAN_NOTE_PLACEHOLDER}
          aria-label={PLAN_NOTE_LABEL}
          maxLength={RUN_REQUEST_ANSWER_MAX}
          enterKeyHint="send"
          disabled={answer.pending}
          onChange={(event) => setNote(event.target.value)}
          onFocus={() => revealActions(keepRef.current)}
          onKeyDown={onKeyDown}
        />
        <Button variant="text" size="lg" disabled={answer.pending} onClick={(event) => keep(event)}>
          {KEEP_PLANNING_LABEL}
        </Button>
      </div>
    </>
  );
}
