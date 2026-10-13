// Claude Code's own figures for a run, as its final result reports them. Each is null when the
// helper sent none: helpers from before PT-195 send nothing, and a run Claude never finished has
// no result to read them from.
export interface RunUsage {
  // Micro-dollars, since the portability rules allow no floats (§2). On a subscription this is
  // Claude Code's estimate, so the app says "about".
  costMicros: number | null;
  turns: number | null;
  durationMs: number | null;
}

export const USAGE_DAYS = 30;

export interface ProjectUsage extends RunUsage {
  days: number;
  // The runs that ended in those days with any figure; each sum leaves out the runs without it.
  runs: number;
}
