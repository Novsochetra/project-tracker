// Live: the working message, one line a call and Claude's words whole. History: a folded answer's
// steps, where Claude's words are a quiet line like a call, since the answer is right under them.
// Full: a ticket run's sheet, where nothing is cut.
export type StepVariant = 'live' | 'history' | 'full';
