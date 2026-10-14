// One stream-json line: JSON keeps a message's own line breaks inside the string.
export const userMessageLine = (text: string): string =>
  `${JSON.stringify({ type: 'user', message: { role: 'user', content: text } })}\n`;
