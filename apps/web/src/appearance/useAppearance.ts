import { useMediaQuery } from '../lib/media';
import { useAppearanceChoice } from './appearanceSetting';
import { DARK_SCHEME_QUERY, resolveAppearance, type Appearance } from './resolveAppearance';

export const useAppearance = (): Appearance =>
  resolveAppearance(useAppearanceChoice(), useMediaQuery(DARK_SCHEME_QUERY));
