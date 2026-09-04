import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Prevents an uncaught render/commit error from leaving a blank page with
 * no clue what happened — shows the error message and stack instead. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[example app] uncaught error", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace", whiteSpace: "pre-wrap", color: "#b91c1c" }}>
          <h2>Something crashed</h2>
          <div>{this.state.error.message}</div>
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>{this.state.error.stack}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
