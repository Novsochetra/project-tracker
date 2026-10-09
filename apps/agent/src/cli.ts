import { readSecret } from './cli/readSecret';
import { runCli } from './cli/run';
import { configPath, fileStore } from './configFile';

process.exitCode = await runCli(process.argv.slice(2), {
  env: process.env,
  store: fileStore(configPath(process.env)),
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
  readSecret: (prompt) => readSecret(prompt),
});
