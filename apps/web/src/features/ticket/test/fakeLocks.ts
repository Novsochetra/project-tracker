// Web Locks as a browser keeps them for one origin, which jsdom lacks: a lock goes to one request
// at a time, in the order asked, and stays held until the promise its callback returns settles, or
// until the page holding it goes.
export function fakeLocks() {
  const tails = new Map<string, Promise<unknown>>();
  let letGo = () => undefined as void;
  let gone = new Promise<void>((resolve) => (letGo = resolve));
  const request = (name: string, callback: (lock: { name: string }) => unknown) => {
    const turn = (tails.get(name) ?? Promise.resolve()).then(() =>
      Promise.race([callback({ name }), gone]),
    );
    tails.set(
      name,
      turn.catch(() => undefined),
    );
    return turn;
  };
  Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
  return {
    pagesGo: () => {
      const go = letGo;
      gone = new Promise<void>((resolve) => (letGo = resolve));
      go();
    },
    restore: () => {
      Reflect.deleteProperty(navigator, 'locks');
    },
  };
}
