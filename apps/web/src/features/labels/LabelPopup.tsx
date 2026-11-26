import { useIsPhone } from '../../lib/media';
import { LabelMenu, type LabelMenuProps } from './LabelMenu';
import { LabelSheet } from './LabelSheet';
import { useManageLabels } from './useManageLabels';

export interface LabelPopupProps extends LabelMenuProps {
  subtitle?: string | undefined;
  // New ticket leaves it off: the Labels sheet would take the place of its own.
  manageable?: boolean;
}

export function LabelPopup({ subtitle, anchorRef, manageable = false, ...props }: LabelPopupProps) {
  const isPhone = useIsPhone();
  const onManage = useManageLabels(props.projectKey, props.onClose);
  const picker = { ...props, onManage: manageable ? onManage : undefined };
  if (isPhone) return <LabelSheet subtitle={subtitle} {...picker} />;
  return <LabelMenu anchorRef={anchorRef} {...picker} />;
}
