import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <div className="scene-fallback" aria-hidden />;
    return this.props.children;
  }
}
