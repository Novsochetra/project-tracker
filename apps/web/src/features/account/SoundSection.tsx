import { SwitchSection } from '../../components/SwitchSection';
import { setSoundsOn, useSoundsOn } from '../../sound';

export function SoundSection() {
  return (
    <SwitchSection
      label="Sounds"
      checked={useSoundsOn()}
      onChange={setSoundsOn}
      note="Soft clicks as you switch, drag and move tickets, and a chime when one is done. The phone's silent mode mutes them."
    />
  );
}
