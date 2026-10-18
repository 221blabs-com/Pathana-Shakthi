import React from 'react';
import { reportClientError } from '../services/clientErrors';

// A screen that throws while rendering shows a friendly way back instead of
// a blank white page, and the error is sent to the server log.
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportClientError('render', error, { componentStack: String(info.componentStack || '').slice(0, 800) });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdfcf6] p-6" id="app-error-screen">
        <div className="card-3d max-w-md bg-white p-8 text-center">
          <img src="/shakthi-face-256.png" alt="" className="mx-auto h-24 w-24" />
          <h1 className="mt-4 text-2xl font-black text-stone-900">Oops! Something went wrong.</h1>
          <p className="mt-2 font-semibold text-stone-600">Shakthi Mitra will take you back. Your stars are safe.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="btn-3d bg-amber-400 px-5 py-3 font-black text-stone-900"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
            <button
              type="button"
              className="btn-3d border-2 border-stone-200 bg-white px-5 py-3 font-black text-stone-800"
              onClick={() => window.location.assign('/')}
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
