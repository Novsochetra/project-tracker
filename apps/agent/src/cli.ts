import { runCli } from './cli/run';

process.exitCode = await runCli(process.argv.slice(2), {
  env: process.env,
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
});
