// "Open" means still being worked on: a reviewed ticket only waits for the person's Done, and
// "180 open, 178 reviewed" read as 358 tickets. The count can be a moment behind the open count
// (the web takes it from a list that loads apart from the projects), so it is clamped.
export const openNotReviewed = (openCount: number, reviewedCount: number): number =>
  openCount - Math.min(Math.max(reviewedCount, 0), openCount);
