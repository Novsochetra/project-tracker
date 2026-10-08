import clsx from 'clsx';
import { GroupedCard, Switch } from '../../components';
import styles from './PromptSheet.module.css';

export interface SendSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SendSwitch({ label, checked, onChange }: SendSwitchProps) {
  return (
    <GroupedCard>
      <div className={clsx('ring-inside', styles.switchRow)}>
        <span className={styles.switchLabel}>{label}</span>
        <Switch checked={checked} onChange={onChange} aria-label="Move to In progress when sent" />
      </div>
    </GroupedCard>
  );
}
