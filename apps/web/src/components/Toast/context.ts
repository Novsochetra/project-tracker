import { createContext } from 'react';
import type { ToastStore } from './toastStore';

export const ToastContext = createContext<ToastStore | null>(null);
