export interface PushMessage {
  title: string;
  body: string;
  url: string;
  // A later notification with the same tag replaces the earlier one.
  tag: string;
}

export interface PushKey {
  publicKey: string;
}

// A push service takes at most 4096 bytes, its encryption included; these keep the JSON well under.
export const PUSH_TITLE_MAX = 120;
export const PUSH_BODY_MAX = 300;
export const PUSH_ENDPOINT_MAX = 2000;
// The program, file or host in "MOB-12: Claude wants to edit …", so the title stays short on a
// lock screen; the card shows it whole.
export const PUSH_ACTION_MAX = 40;
