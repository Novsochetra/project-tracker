// The parts of the service worker's globals the push handlers use. The web app compiles against
// the DOM's types, which have no service worker ones.
export interface WaitingEvent {
  waitUntil: (work: Promise<unknown>) => void;
}

export interface PushEventLike extends WaitingEvent {
  data: { json: () => unknown } | null;
}

export interface NotificationClickLike extends WaitingEvent {
  notification: { data: unknown; close: () => void };
}

export interface WindowClientLike {
  url: string;
  focus: () => Promise<unknown>;
  postMessage: (message: unknown) => void;
}

export interface ClientsLike {
  matchAll: (options: {
    type: 'window';
    includeUncontrolled: boolean;
  }) => Promise<readonly WindowClientLike[]>;
  openWindow: (url: string) => Promise<unknown>;
}

export interface PushScope {
  location: { origin: string };
  clients: ClientsLike;
  registration: {
    showNotification: (title: string, options: NotificationOptions) => Promise<void>;
  };
  addEventListener: ((type: 'push', listener: (event: PushEventLike) => void) => void) &
    ((type: 'notificationclick', listener: (event: NotificationClickLike) => void) => void);
}
