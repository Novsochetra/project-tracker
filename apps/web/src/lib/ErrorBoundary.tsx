import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  name: string;
  fallback: ReactNode;
  children: ReactNode;
  // A part that failed is tried again once this changes, so data fixed since then shows as usual.
  retryKey?: unknown;
  // Holds that retry back while the fallback is in use, such as an edit open in it.
  holdRetry?: boolean;
}

interface ErrorBoundaryState {
  failed: boolean;
  shownWith: unknown;
}

// React unmounts the whole app when a render error reaches the root, so each part that can fail
// on its own shows its fallback instead.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false, shownWith: undefined };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (!state.failed) return { shownWith: props.retryKey };
    if (props.holdRetry || Object.is(props.retryKey, state.shownWith)) return null;
    return { failed: false, shownWith: props.retryKey };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`${this.props.name} couldn't be shown.`, error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
