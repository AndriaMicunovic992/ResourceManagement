import { Component } from 'react';

/**
 * Top-level safety net. A render/lifecycle error anywhere in the tree would
 * otherwise unmount the whole app and leave a blank white screen. This catches
 * it, shows a recoverable fallback, and keeps the error visible in dev.
 *
 * Note: error boundaries only catch errors during render/lifecycle — not
 * async failures (e.g. fetch rejections), which must be handled where awaited.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In production this is the hook point for an error-reporting service.
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-bg p-6 font-sans">
        <div className="max-w-md w-full bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-danger-bg text-danger mx-auto mb-4 flex items-center justify-center text-2xl font-semibold">
            !
          </div>
          <h1 className="text-lg font-semibold text-text mb-2">Something went wrong</h1>
          <p className="text-sm text-text-mid mb-6">
            The app hit an unexpected error and couldn't continue. Reloading usually fixes it.
          </p>
          {import.meta.env.DEV && (
            <pre className="text-left text-xs text-danger bg-danger-bg rounded-lg p-3 mb-6 overflow-auto max-h-40 whitespace-pre-wrap">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
