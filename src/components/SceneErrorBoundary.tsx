import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; onError?: (err: Error) => void };
type State = { failed: boolean };

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: Error) {
    this.props.onError?.(err);
  }

  render() {
    if (this.state.failed) return <div className="scene-fallback" aria-hidden />;
    return this.props.children;
  }
}
