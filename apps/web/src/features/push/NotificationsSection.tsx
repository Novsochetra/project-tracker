import { SwitchSection } from '../../components/SwitchSection';
import { PUSH_NOTES } from './pushNotes';
import { usePushSwitch } from './usePushSwitch';

export function NotificationsSection() {
  const { device, pending, error, toggle } = usePushSwitch();
  const ready = device?.support === 'ready';

  return (
    <SwitchSection
      label="Notifications on this device"
      checked={device?.on ?? false}
      disabled={!ready || pending}
      onChange={toggle}
      note={device && PUSH_NOTES[device.support]}
      error={error}
    />
  );
}
