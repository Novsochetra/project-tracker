import { createTrackerClient, type TrackerApi } from '../client';
import { trackerUrl, type Config, type Env } from '../config';
import type { ConfigStore } from '../configFile';
import { describeError } from '../errors';
import { plainHttpProblem } from '../plainHttp';
import { savedToken, trackerKey, withoutToken, withToken } from '../savedConfig';
import { EXIT_ERROR, EXIT_OK, EXIT_USAGE } from './exitCodes';
import type { GlobalValues } from './options';

export interface LoginIo {
  env: Env;
  store: ConfigStore;
  stdout(text: string): void;
  stderr(text: string): void;
  readSecret(prompt: string): Promise<string>;
  connect?: (config: Config) => TrackerApi;
}

const NO_TOKEN_GIVEN = 'No token given. Copy one from Connect Claude Code → API tokens.';

const isTokenShaped = (token: string): boolean => /^\S+$/.test(token);

type Check = { problem: string } | { open: boolean };

// The token is checked before it is saved, so a typo or a revoked token is caught here and not
// in the middle of an agent's work.
async function checkToken(url: string, token: string, io: LoginIo): Promise<Check> {
  const client = (io.connect ?? createTrackerClient)({ url, token, agentName: 'tracker login' });
  try {
    const session = await client.getSession();
    if (session.authenticated) return { open: !session.authRequired };
    return {
      problem: `The tracker at ${url} didn't accept this token: it was revoked, mistyped or made for another tracker. Create a new one in Connect Claude Code → API tokens.`,
    };
  } catch (error) {
    return { problem: describeError(error, { trackerUrl: url }) };
  }
}

const OPEN_NOTE =
  'This tracker has no owner account yet, so it lets agents in without a token for now.';

// A token in the environment wins over the saved one, so the saved one would go unused.
const envTokenNote = (env: Env): string | undefined => {
  const name = ['TRACKER_API_TOKEN', 'TRACKER_TOKEN'].find((key) => env[key]?.trim());
  return name && `${name} is set here and is used instead of the saved token. Unset it.`;
};

function savedText(url: string, path: string, notes: (string | false | undefined)[]): string {
  return [
    `Saved. The CLI and the MCP server now use ${url} with this token.`,
    `It is kept in ${path}, which only you can read. Remove it with "tracker logout".`,
    ...notes.filter((note): note is string => Boolean(note)),
  ].join('\n');
}

export async function login(global: GlobalValues, io: LoginIo): Promise<number> {
  const saved = io.store.read();
  const url = trackerKey(trackerUrl(io.env, global, saved));
  // Asked before the token is pasted, so it is never typed in for a tracker it can't go to.
  const insecure = plainHttpProblem(url);
  if (insecure) {
    io.stderr(`Error: ${insecure}`);
    return EXIT_USAGE;
  }
  const token = (await io.readSecret(`Paste the API token for ${url}: `)).trim();
  if (!token || !isTokenShaped(token)) {
    io.stderr(token ? 'That is not a token: it has spaces in it.' : NO_TOKEN_GIVEN);
    return EXIT_USAGE;
  }
  const check = await checkToken(url, token, io);
  if ('problem' in check) {
    io.stderr(`Error: ${check.problem}`);
    return EXIT_ERROR;
  }
  io.store.write(withToken(saved, url, token));
  io.stdout(savedText(url, io.store.path, [check.open && OPEN_NOTE, envTokenNote(io.env)]));
  return EXIT_OK;
}

export function logout(global: GlobalValues, io: LoginIo): number {
  const saved = io.store.read();
  const url = trackerKey(trackerUrl(io.env, global, saved));
  if (savedToken(saved, url) === undefined) {
    io.stdout(`No token is saved for ${url}.`);
    return EXIT_OK;
  }
  io.store.write(withoutToken(saved, url));
  io.stdout(
    `Removed the token saved for ${url}. It still works until you revoke it in Connect Claude Code → API tokens.`,
  );
  return EXIT_OK;
}
