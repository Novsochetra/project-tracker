import { lastExitFrom, pidFrom } from './jobState';
import { installAgent, isInstalled, jobState, plistUrl, uninstallAgent } from './launchd';
import { logPathOf } from './names';
import type { Autostart } from './platform';
import { privacyNote } from './rules';
import { runningLines } from './statusText';

export const macAutostart: Autostart = {
  isInstalled,
  installedUrl: plistUrl,
  runningPid: (label) => pidFrom(jobState(label)),
  statusLines: (label) => {
    const state = jobState(label);
    return runningLines(pidFrom(state), lastExitFrom(state), logPathOf(label));
  },
  install: (job) => {
    installAgent(job);
    return {
      starts: 'it starts when you log in, and again if it crashes',
      notes: [
        `Logs: ${logPathOf(job.label)}`,
        'The Mac must stay logged in. After a restart with FileVault on, it waits for your password first.',
        privacyNote([job.folder, ...job.program]),
      ],
    };
  },
  uninstall: uninstallAgent,
};
