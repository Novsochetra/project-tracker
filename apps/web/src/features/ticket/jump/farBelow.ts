// The box counts as near while it starts within half a screen below the visible part.
export const NEAR_MARGIN = '0px 0px 50% 0px';

export interface BoxSighting {
  intersecting: boolean;
  top: number;
  // The bottom of the screen plus the near margin; null while the observer doesn't know it.
  rootBottom: number | null;
}

export const isFarBelow = ({ intersecting, top, rootBottom }: BoxSighting): boolean =>
  !intersecting && rootBottom !== null && top >= rootBottom;
