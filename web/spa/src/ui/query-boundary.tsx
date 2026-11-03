import { Component, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import "./ov-panel.css";

type State = { failed: boolean };

class Boundary extends Component<{ onReset: () => void; children: ReactNode }, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      // The screen's words for this are not in the catalog yet: plain English, like the server's own errors.
      <div className="ov-empty" role="alert">
        <span>Could not load this. Check the connection and try again.</span>
        <button
          type="button"
          style={{ justifySelf: "start", font: "inherit", padding: ".25rem .8rem", cursor: "pointer" }}
          onClick={() => {
            this.props.onReset();
            this.setState({ failed: false });
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

/** Catches a failed query below it and offers to ask again; the rest of the screen stays. */
export function QueryBoundary({ children }: { children: ReactNode }) {
  return <QueryErrorResetBoundary>{({ reset }) => <Boundary onReset={reset}>{children}</Boundary>}</QueryErrorResetBoundary>;
}
