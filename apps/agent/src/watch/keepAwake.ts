import { spawn } from 'node:child_process';

// -i stops idle sleep but lets the screen turn off; -w ends it with the helper, even after a crash.
export const caffeinateArgs = (pid: number): string[] => ['-i', '-w', String(pid)];

export function keepMacAwake(pid: number = process.pid): void {
  if (process.platform !== 'darwin') return;
  const child = spawn('caffeinate', caffeinateArgs(pid), { stdio: 'ignore' });
  child.on('error', () => undefined);
  child.unref();
}
