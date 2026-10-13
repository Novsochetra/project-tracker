import type { Chat, ChatDetail, Run } from '@tracker/shared';
import clsx from 'clsx';
import { Play } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components';
import { ActionSheet } from '../../overlays';
import { DO_IT_LABEL, doItCaption, doItOffline } from './doItCopy';
import styles from './DoIt.module.css';
import { planToDo } from './planToDo';
import { useDoIt } from './useDoIt';

interface DoItOfferProps {
  projectKey: string;
  chat: Chat;
  plan: Run;
}

// Edit changes files, so nothing runs before the person's tap on the sheet's Do it.
function DoItOffer({ projectKey, chat, plan }: DoItOfferProps) {
  const doIt = useDoIt(projectKey, chat, plan);
  const [open, setOpen] = useState(false);
  const { helper } = doIt;
  if (helper === undefined) return null;
  if (helper === null) return <p className={styles.note}>{doItOffline(plan.runnerName)}</p>;
  const confirm = () => {
    setOpen(false);
    doIt.go(helper);
  };
  return (
    <div className={styles.doIt}>
      {doIt.error && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {doIt.error}
        </p>
      )}
      <Button
        variant="primary"
        size="lg"
        icon={Play}
        className={styles.button}
        disabled={doIt.pending}
        onClick={() => setOpen(true)}
      >
        {DO_IT_LABEL}
      </Button>
      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        label={DO_IT_LABEL}
        caption={doItCaption(helper.name)}
        actions={[{ label: DO_IT_LABEL, bold: true, onSelect: confirm }]}
      />
    </div>
  );
}

export function DoIt({ projectKey, detail }: { projectKey: string; detail: ChatDetail | null }) {
  const plan = planToDo(detail);
  return plan && detail ? (
    <DoItOffer projectKey={projectKey} chat={detail.chat} plan={plan} />
  ) : null;
}
