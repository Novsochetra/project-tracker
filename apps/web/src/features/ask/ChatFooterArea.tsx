import { helperLabel, type AskOptions, type Run } from '@tracker/shared';
import clsx from 'clsx';
import { Laptop, MessageCircleQuestion } from 'lucide-react';
import { GroupedCard, Icon, SelectRow, Spinner } from '../../components';
import { useIsPhone } from '../../lib/media';
import { useOptionalScreen } from '../../navigation';
import { useRegisterBottomBar } from '../../navigation/bottomBarStore';
import { helperOptions } from '../claude/helperOptions';
import { SetupLine } from '../claude/SetupLine';
import { WAITING_TEXT } from '../requests/copy';
import { AskComposer } from './AskComposer';
import { helperOf, stoppableRunOf, thinkingText } from './chatFooter';
import styles from './ChatScreen.module.css';
import type { AskHelper } from './useAskHelper';

export interface ChatFooterAreaProps {
  projectKey: string;
  chatId: string | null;
  helper: AskHelper;
  waiting: boolean;
  savedOptions: AskOptions;
  placeholder: string;
}

function Thinking({ run, waiting }: { run: Run; waiting: boolean }) {
  if (waiting) {
    return (
      <p className={clsx(styles.statusLine, 'fade-in')}>
        <Icon icon={MessageCircleQuestion} size={16} className={styles.waitingIcon} />
        {WAITING_TEXT}
      </p>
    );
  }
  return (
    <p className={styles.statusLine}>
      <span aria-hidden="true" className={styles.spinner}>
        <Spinner />
      </span>
      {thinkingText(run)}
    </p>
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
        options={helperOptions(footer.helpers)}
        value={footer.helper.id}
        title={helperLabel(footer.helper)}
        onChange={choose}
      />
    </GroupedCard>
  );
}

export function ChatFooterArea(props: ChatFooterAreaProps) {
  const { projectKey, chatId, helper, waiting, savedOptions, placeholder } = props;
  const { footer } = helper;
  const isPhone = useIsPhone();
  const isTop = useOptionalScreen()?.isTop ?? true;
  // It takes the bottom bar's place, so toasts rise above it as they do above the bar.
  useRegisterBottomBar(isPhone && isTop);
  const stopped = footer.kind === 'ask' || footer.kind === 'setup' ? footer.stopped : null;
  return (
    <div className={styles.footer} data-bottom-cover="">
      <div className={styles.footerInner}>
        {footer.kind === 'thinking' && <Thinking run={footer.run} waiting={waiting} />}
        {stopped && <p className={clsx(styles[stopped.kind], 'fade-in')}>{stopped.text}</p>}
        {footer.kind === 'setup' && <SetupLine />}
        <RunOn helper={helper} />
        <AskComposer
          projectKey={projectKey}
          chatId={chatId}
          helper={helperOf(footer)}
          stoppableRun={stoppableRunOf(footer)}
          offersSend={footer.kind !== 'setup'}
          savedOptions={savedOptions}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
