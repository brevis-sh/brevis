import { Component, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ApiError } from "../api/client";

type Props = { children: ReactNode; notFound?: ReactNode; onReset: () => void };

class Catch extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (error instanceof ApiError && error.status === 404 && this.props.notFound) return this.props.notFound;
    return (
      <div role="alert" className="card">
        <p>{error.message}</p>
        <button
          type="button"
          onClick={() => {
            this.props.onReset();
            this.setState({ error: null });
          }}
        >
          Retry
        </button>
      </div>
    );
  }
}

/** A failed read shows the server's message and a retry; a 404 shows `notFound` when given. */
export function QueryBoundary({ children, notFound }: { children: ReactNode; notFound?: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <Catch onReset={reset} notFound={notFound}>
          {children}
        </Catch>
      )}
    </QueryErrorResetBoundary>
  );
}
