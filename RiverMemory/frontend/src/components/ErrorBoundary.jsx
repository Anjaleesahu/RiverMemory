import { Component } from "react";

/** Shows the real error instead of a blank white page when a component crashes. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("RiverMemory UI error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty" style={{ margin: "2rem", textAlign: "left" }}>
        <h3>Is page par error aaya</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error?.message || this.state.error)}</pre>
        <p className="muted small">Browser me F12 dabakar Console tab me poora error dekh sakte hain.</p>
        <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}