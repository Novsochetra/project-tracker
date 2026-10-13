const SHA = /^[0-9a-f]{7,40}$/i;

export const shortCommit = (sha: string | undefined): string | null => {
  const text = sha?.trim() ?? '';
  return SHA.test(text) ? text.slice(0, 7).toLowerCase() : null;
};

export const versionLabel = (version: string, commit: string | null): string =>
  commit ? `v${version} · ${commit}` : `v${version}`;
