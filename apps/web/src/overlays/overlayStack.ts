const stack: symbol[] = [];

export function pushOverlay(token: symbol): () => void {
  stack.push(token);
  return () => {
    const index = stack.lastIndexOf(token);
    if (index >= 0) stack.splice(index, 1);
  };
}

export const isTopOverlay = (token: symbol): boolean => stack[stack.length - 1] === token;
