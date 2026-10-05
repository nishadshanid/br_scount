import { Component, type ReactNode } from 'react';

/** Shows a recoverable error screen instead of a frozen blank page if anything crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="card space-y-3">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-slate-500">Your data is safe in GitHub. Reload to continue.</p>
          <pre className="overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-800">{this.state.error.message}</pre>
          <button className="btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
