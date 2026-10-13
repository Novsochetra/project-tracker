import { useEffect, useState } from 'react';
import { errorMessage, useApi } from '../../api';
import {
  PushRefused,
  readDevicePush,
  turnPushOff,
  turnPushOn,
  type DevicePush,
} from './devicePush';

export interface PushSwitch {
  device: DevicePush | null;
  pending: boolean;
  error: string | null;
  toggle: (on: boolean) => void;
}

const REFUSED = 'Notifications are blocked for Tracker. Allow them in Settings, then try again.';

const messageOf = (error: unknown) =>
  error instanceof PushRefused ? REFUSED : errorMessage(error);

export function usePushSwitch(): PushSwitch {
  const client = useApi();
  const [device, setDevice] = useState<DevicePush | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void readDevicePush().then((read) => {
      if (live) setDevice(read);
    });
    return () => {
      live = false;
    };
  }, []);

  const toggle = (on: boolean) => {
    setError(null);
    setPending(true);
    // Called within the tap: iOS shows the permission prompt only then.
    const work = on ? turnPushOn(client) : turnPushOff(client);
    void work
      .catch((failure: unknown) => setError(messageOf(failure)))
      .then(readDevicePush)
      .then(setDevice)
      .finally(() => setPending(false));
  };

  return { device, pending, error, toggle };
}
