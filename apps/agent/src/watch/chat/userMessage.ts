// One stream-json line: JSON keeps a message's own line breaks inside the string.
export const userMessageLine = (text: string, uuid: string): string =>
  `${JSON.stringify({ type: 'user', uuid, message: { role: 'user', content: text } })}\n`;
