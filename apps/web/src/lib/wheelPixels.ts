export interface WheelLike {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  clientX: number;
  clientY: number;
}

const DELTA_LINE = 1;
const DELTA_PAGE = 2;
const LINE_PX = 16;

// Firefox counts a mouse wheel's steps in lines; a page step is the scroller's height.
export function wheelPixels({ deltaX, deltaY, deltaMode }: WheelLike, pageHeight: number) {
  const unit = deltaMode === DELTA_LINE ? LINE_PX : deltaMode === DELTA_PAGE ? pageHeight : 1;
  return { x: deltaX * unit, y: deltaY * unit };
}
