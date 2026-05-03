import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException } from "@/lib/monitoring/logger";

interface Props { children: ReactNode; }
interface State { hasError: boolean; errorMessage: string; }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error, { componentStack: info.componentStack ?? "unknown" });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {import.meta.env.DEV && (
              <p className="mt-2 rounded bg-muted p-2 text-xs font-mono text-destructive">
                {this.state.errorMessage}
              </p>
            )}
            <div className="mt-4 flex justify-center gap-3">
              <button
                onClick={() => { this.setState({ hasError: false, errorMessage: "" }); }}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Try again
              </button>
              <a href="/dashboard" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
