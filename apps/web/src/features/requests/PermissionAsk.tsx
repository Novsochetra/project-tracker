import type { RunRequest } from '@tracker/shared';
import { ShieldQuestion } from 'lucide-react';
import { Button } from '../../components';
import { ALLOW_LABEL, DENY_LABEL, PERMISSION_HEAD } from './copy';
import { RequestAction } from './RequestAction';
import { RequestHead } from './RequestHead';
import { ALLOW, DENY } from './requestAnswers';
import styles from './Requests.module.css';
import type { Answer } from './useAnswer';

export function PermissionAsk({ request, answer }: { request: RunRequest; answer: Answer }) {
  return (
    <>
      <RequestHead icon={ShieldQuestion} text={PERMISSION_HEAD} />
      <RequestAction label={request.label} cut={request.labelCut} />
      <div className={styles.buttons}>
        <Button
          variant="primary"
          size="lg"
          disabled={answer.pending}
          onClick={(event) => answer.send(ALLOW, event)}
        >
          {ALLOW_LABEL}
        </Button>
        <Button size="lg" disabled={answer.pending} onClick={(event) => answer.send(DENY, event)}>
          {DENY_LABEL}
        </Button>
      </div>
    </>
  );
}
