// A finger rarely stops exactly at the end, and a step that just landed may sit a few pixels past it.
export const FOLLOW_SLACK_PX = 40;

export interface ScrollBox {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export const isAtEnd = ({ scrollTop, scrollHeight, clientHeight }: ScrollBox): boolean =>
  scrollHeight - scrollTop - clientHeight <= FOLLOW_SLACK_PX;
