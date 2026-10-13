import { helperLabel, type Run, type Runner } from '@tracker/shared';
import { Check, Copy, Laptop, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, GroupedCard, Icon, SelectRow, Spinner } from '../../components';
import { useIsPhone } from '../../lib/media';
import { helperOptions } from './helperOptions';
import styles from './PromptSheet.module.css';
import { workingText } from './runs';
import type { RunOffer } from './useRunOffer';

export interface PromptFooterProps {
  copied: boolean;
  disabled: boolean;
  onCopy: () => void;
  run?: RunOffer | undefined;
  onRun: () => void;
}

export function PromptFooter({ copied, disabled, onCopy, run, onRun }: PromptFooterProps) {
  const copy = (primary: boolean) => (
    <CopyButton copied={copied} disabled={disabled} primary={primary} onClick={onCopy} />
  );
  if (!run) return copy(true);
  const { footer } = run;
  switch (footer.kind) {
    case 'run':
      return (
        <RunActions
          runOn={
            footer.helpers.length > 1 && (
              <RunOn helpers={footer.helpers} helper={footer.helper} onChoose={run.choose} />
            )
          }
          action={<RunButton disabled={disabled || run.starting} onClick={onRun} />}
          copy={copy(false)}
        />
      );
    case 'working':
      return <RunActions action={<WorkingLine run={footer.run} />} copy={copy(false)} />;
    case 'copy':
    case 'setup':
      return copy(true);
  }
}

interface RunActionsProps {
  runOn?: ReactNode;
  action: ReactNode;
  copy: ReactNode;
}

// Phones stack the buttons with Run on top, so it comes first for focus and screen readers too.
function RunActions({ runOn, action, copy }: RunActionsProps) {
  const isPhone = useIsPhone();
  return (
    <div className={styles.actions}>
      {runOn}
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

interface RunOnProps {
  helpers: Runner[];
  helper: Runner;
  onChoose: (helperId: string) => void;
}

function RunOn({ helpers, helper, onChoose }: RunOnProps) {
  return (
    <GroupedCard>
      <SelectRow
        label="Run on"
        icon={<Icon icon={Laptop} className={styles.runOnIcon} />}
        options={helperOptions(helpers)}
        value={helper.id}
        title={helperLabel(helper)}
        onChange={onChoose}
      />
    </GroupedCard>
  );
}
