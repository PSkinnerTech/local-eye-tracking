export function App() {
  return (
    <main className="app-shell">
      <section className="setup-panel">
        <p className="eyebrow">Local webcam attention tracker</p>
        <h1>Calibrate before testing</h1>
        <p>
          The app will use your webcam locally to learn what looking at the screen looks like,
          then run a green/red attention test.
        </p>
      </section>
    </main>
  );
}
