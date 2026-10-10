import type { AskOptions, Run } from '@tracker/shared';
import clsx from 'clsx';
import { Laptop } from 'lucide-react';
import type { MouseEvent } from 'react';
import { errorMessage } from '../../api';
import { useCancelAsk } from '../../api/hooks/chats';
import { Button, GroupedCard, Icon, SelectRow, Spinner, useToast } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { useIsPhone } from '../../lib/media';
import { useOptionalScreen } from '../../navigation';
import { useRegisterBottomBar } from '../../navigation/bottomBarStore';
import { SetupLine } from '../claude/SetupLine';
import { AskComposer } from './AskComposer';
import { helperOf, thinkingText } from './chatFooter';
import styles from './ChatScreen.module.css';
import type { AskHelper } from './useAskHelper';

export interface ChatFooterAreaProps {
  projectKey: string;
  chatId: string | null;
  helper: AskHelper;
  savedOptions: AskOptions;
}

function Thinking({ run }: { run: Run }) {
  const cancel = useCancelAsk();
  const toast = useToast();
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) holdPresses(event.currentTarget);
    cancel.mutate(run, {
      onError: (error) => toast.show(errorMessage(error), { kind: 'error' }),
    });
  };
  return (
    <div className={styles.status}>
      <p className={styles.statusLine}>
        <span aria-hidden="true" className={styles.spinner}>
          <Spinner />
        </span>
        {thinkingText(run)}
      </p>
      <Button size="sm" disabled={cancel.isPending} onClick={onClick}>
        Cancel
      </Button>
    </div>
  );
}

function RunOn({ helper }: { helper: AskHelper }) {
  const { footer, choose } = helper;
  if (footer.kind !== 'ask' || footer.helpers.length < 2) return null;
  return (
    <GroupedCard className={styles.runOn}>
      <SelectRow
        label="Run on"
        icon={<Icon icon={Laptop} className={styles.runOnIcon} />}
        options={footer.helpers.map(({ id, name }) => ({ value: id, label: name }))}
        value={footer.helper.id}
        onChange={choose}
      />
    </GroupedCard>
  );
}

export function ChatFooterArea({ projectKey, chatId, helper, savedOptions }: ChatFooterAreaProps) {
  const { footer } = helper;
  const isPhone = useIsPhone();
  const isTop = useOptionalScreen()?.isTop ?? true;
  // It takes the bottom bar's place, so toasts rise above it as they do above the bar.
  useRegisterBottomBar(isPhone && isTop);
  const stopped = footer.kind === 'ask' || footer.kind === 'setup' ? footer.stopped : null;
  return (
    <div className={styles.footer}>
      <div className={styles.footerInner}>
        {footer.kind === 'thinking' && <Thinking run={footer.run} />}
        {stopped && <p className={clsx(styles.stopped, 'fade-in')}>{stopped}</p>}
        {footer.kind === 'setup' && <SetupLine />}
        <RunOn helper={helper} />
        <AskComposer
          projectKey={projectKey}
          chatId={chatId}
          helper={helperOf(footer)}
          offersSend={footer.kind !== 'setup'}
          savedOptions={savedOptions}
        />
      </div>
    </div>
  );
}
