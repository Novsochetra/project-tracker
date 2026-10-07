type Listener = (event: Event) => void;

export class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: MockEventSource[] = [];

  readyState = MockEventSource.CONNECTING;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  static latest(): MockEventSource {
    const source = MockEventSource.instances.at(-1);
    if (!source) throw new Error('No EventSource was created.');
    return source;
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  open(): void {
    this.readyState = MockEventSource.OPEN;
    this.dispatch('open', new Event('open'));
  }

  emit(data: unknown, type = 'message'): void {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    this.dispatch(type, new MessageEvent(type, { data: text }));
  }

  fail(closed: boolean): void {
    this.readyState = closed ? MockEventSource.CLOSED : MockEventSource.CONNECTING;
    this.dispatch('error', new Event('error'));
  }

  private dispatch(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}
