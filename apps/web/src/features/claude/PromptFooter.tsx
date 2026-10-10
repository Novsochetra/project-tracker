import type { Run } from '@tracker/shared';
import { Check, Copy, Laptop, Play } from 'lucide-react';
import { Button, GroupedCard, Icon, SelectRow, Spinner } from '../../components';
import { useIsPhone } from '../../lib/media';
import styles from './PromptSheet.module.css';
import { offersRunSlot, workingText } from './runs';
import type { RunOffer } from './useRunOffer';

export interface PromptFooterProps {
  copied: boolean;
  disabled: boolean;
  onCopy: () => void;
  run?: RunOffer | undefined;
  onRun: () => void;
}

export function PromptFooter({ copied, disabled, onCopy, run, onRun }: PromptFooterProps) {
  const isPhone = useIsPhone();
  const withRun = run && offersRunSlot(run.footer) ? run : null;
  const copy = (
    <CopyButton copied={copied} disabled={disabled} primary={!withRun} onClick={onCopy} />
  );
  if (!withRun) return copy;
  const action = withRun.working ? (
    <WorkingLine run={withRun.working} />
  ) : (
    <RunButton disabled={disabled || withRun.starting} onClick={onRun} />
  );
  // Phones stack the buttons with Run on top, so it comes first for focus and screen readers too.
  return (
    <div className={styles.actions}>
      {!withRun.working && withRun.helpers.length > 1 && <RunOn run={withRun} />}
      <div className={styles.buttons}>
        {isPhone ? action : copy}
        {isPhone ? copy : action}
      </div>
    </div>
  );
}

interface CopyButtonProps {
  copied: boolean;
  disabled: boolean;
  primary: boolean;
  onClick: () => void;
}

function CopyButton({ copied, disabled, primary, onClick }: CopyButtonProps) {
  const isPhone = useIsPhone();
  return (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      size={isPhone ? 'bar' : 'lg'}
      fullWidth={isPhone}
      className={styles.footerButton}
      disabled={disabled}
      onClick={onClick}
    >
      {copied ? <Icon icon={Check} className="fade-in" /> : <Icon icon={Copy} />}
      {copied ? 'Copied' : 'Copy prompt'}
    </Button>
  );
}

function RunButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const isPhone = useIsPhone();
  return (
    <Button
      variant="primary"
      size={isPhone ? 'bar' : 'lg'}
      fullWidth={isPhone}
      className={styles.footerButton}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon icon={Play} />
      Run in Claude Code
    </Button>
  );
}

function WorkingLine({ run }: { run: Run }) {
  return (
    <p className={styles.working}>
      <span aria-hidden="true" className={styles.workingSpinner}>
        <Spinner />
      </span>
      {workingText(run)}
    </p>
  );
}

function RunOn({ run }: { run: RunOffer }) {
  const options = run.helpers.map((helper) => ({ value: helper.id, label: helper.name }));
  return (
    <GroupedCard>
      <SelectRow
        label="Run on"
        icon={<Icon icon={Laptop} className={styles.runOnIcon} />}
        options={options}
        value={run.helper?.id ?? ''}
        onChange={run.choose}
      />
    </GroupedCard>
  );
}
