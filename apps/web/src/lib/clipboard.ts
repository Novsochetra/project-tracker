type TextField = HTMLTextAreaElement | HTMLInputElement;

async function writeWithClipboardApi(text: string): Promise<boolean> {
  try {
    if (typeof navigator.clipboard?.writeText !== 'function') return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Selecting while readonly keeps iOS from opening the keyboard; setSelectionRange is what iOS honors.
function selectAll(field: TextField): void {
  const wasReadOnly = field.readOnly;
  field.readOnly = true;
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, field.value.length);
  } finally {
    field.readOnly = wasReadOnly;
  }
}

function copySelection(field: TextField): boolean {
  try {
    selectAll(field);
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

// The Clipboard API is missing on plain-http LAN addresses, which is how phones often reach the app.
function copyWithHiddenField(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('aria-hidden', 'true');
  field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px';
  document.body.append(field);
  try {
    return copySelection(field);
  } finally {
    field.remove();
  }
}

export async function copyText(text: string, fallbackElement?: TextField | null): Promise<boolean> {
  if (await writeWithClipboardApi(text)) return true;

  return fallbackElement ? copySelection(fallbackElement) : copyWithHiddenField(text);
}
