// Why a project's automatic review stopped after a run, so the run card can say it.
export const CHAIN_STOPS = ['rounds', 'moved', 'offline', 'too_long'] as const;
export type ChainStop = (typeof CHAIN_STOPS)[number];

// Two rounds of work and review, then a person reads what the reviewer still wants.
export const AUTO_REVIEW_ROUNDS = 2;
