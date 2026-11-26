// The review prompt sheet (reviewPrompt.ts) and the MCP review prompt (apps/agent/src/prompts/
// review.ts) share these, so the two can't drift.
export const REVIEW_RATING_SCALE = [
  '   - 5: fully meets the requirement, with good quality and tests',
  '   - 4: meets the requirement, with minor nits',
  '   - 3: works, but has notable issues',
  '   - 2: partially meets the requirement',
  '   - 1: does not meet the requirement',
];

export const REVIEW_VERDICT_RULES = [
  '   - "approved" only when the requirement is fully met and your verification passed.',
  '   - Otherwise "changes_requested", with specific, actionable feedback: what is wrong, where, and what to do. The ticket goes back to To do for a worker.',
];
