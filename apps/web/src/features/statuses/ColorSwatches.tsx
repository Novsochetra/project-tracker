import { Check } from 'lucide-react';
import { useId } from 'react';
import { markColor, useAppearance } from '../../appearance';
import { Icon } from '../../components';
import styles from './StatusEditor.module.css';
import { colorChoices, colorName, sameColor } from './statusForm';

export interface ColorSwatchesProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorSwatches({ value, onChange }: ColorSwatchesProps) {
  const labelId = useId();
  const name = useId();
  const appearance = useAppearance();

  return (
    <div className={styles.colors}>
      <span id={labelId} className={styles.label}>
        Color
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className={styles.swatches}>
        {colorChoices(value).map((color) => (
          <label
            key={color}
            className={styles.swatch}
            style={{ color: markColor(color, appearance) }}
          >
            <input
              type="radio"
              name={name}
              value={color}
              aria-label={colorName(color)}
              checked={sameColor(color, value)}
              onChange={() => onChange(color)}
            />
            <span className={styles.dot} aria-hidden="true">
              <Icon icon={Check} size={14} className={styles.check} />
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
