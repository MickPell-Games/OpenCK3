import PublishingWorkflow from "./components/PublishingWorkflow";

function App() {
  return (
    <div className="app-shell">
      <header>
        <h1>OpenCK3 Publishing</h1>
        <p>Upload assets, build your project, and ship it to the Steam Workshop.</p>
      </header>
      <PublishingWorkflow />
    </div>
  );
}

export default App;
