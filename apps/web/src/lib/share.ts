export const PROMPT_SHARE_TITLE = 'Prompt for Claude Code';

export const canShare = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export async function sharePrompt(text: string): Promise<boolean> {
  if (!canShare()) return false;
  try {
    await navigator.share({ title: PROMPT_SHARE_TITLE, text });
    return true;
  } catch {
    return false;
  }
}
