import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import PublishingWorkflow from "./components/PublishingWorkflow";
import { exportModPackage, normalizeModSlug } from "./utils/exportMod";

const STORAGE_KEY = "openck3.modName";

function App() {
  const [modName, setModName] = useState("");
  const [modNameInput, setModNameInput] = useState("");
  const [isEditingName, setIsEditingName] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setModName(stored);
      setModNameInput(stored);
      setIsEditingName(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (modName) {
      window.localStorage.setItem(STORAGE_KEY, modName);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [modName]);

  const safeProjectId = useMemo(
    () => (modName ? normalizeModSlug(modName) : "openck3_mod"),
    [modName]
  );

  const handleSaveName = useCallback(() => {
    const trimmed = modNameInput.trim();
    if (!trimmed) {
      setError("Enter a name for your mod before saving.");
      return;
    }

    setModName(trimmed);
    setModNameInput(trimmed);
    setIsEditingName(false);
    setError(null);
  }, [modNameInput]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleSaveName();
    },
    [handleSaveName]
  );

  const handleEdit = useCallback(() => {
    setModNameInput(modName);
    setError(null);
    setIsEditingName(true);
  }, [modName]);

  const handleCancel = useCallback(() => {
    setModNameInput(modName);
    setError(null);
    setIsEditingName(false);
  }, [modName]);

  const handleExport = useCallback(async () => {
    if (!modName || isExporting) {
      return;
    }
    try {
      setIsExporting(true);
      await exportModPackage(modName);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to export mod", error);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, modName]);

  const isExportDisabled = !modName || isExporting;

  return (
    <div className="openck3-app">
      <header className="openck3-header">
        <div className="openck3-header__column openck3-header__column--left">
          <button
            className="openck3-export-button"
            onClick={handleExport}
            disabled={isExportDisabled}
          >
            {isExporting ? "Exporting..." : "Export"}
          </button>
        </div>
        <div className="openck3-header__title">Open CK3</div>
        <div className="openck3-header__column openck3-header__column--right">
          {modName ? (
            <span className="openck3-header__mod-name">{modName}</span>
          ) : (
            <span className="openck3-header__placeholder">No mod saved</span>
          )}
        </div>
      </header>
      <main className="openck3-content">
        {isEditingName ? (
          <section className="openck3-card">
            <h2>Name Your Mod</h2>
            <p>Pick a memorable project name to start building your CK3 mod.</p>
            <form className="openck3-form" onSubmit={handleSubmit}>
              <label className="openck3-form__label" htmlFor="mod-name-input">
                Mod name
              </label>
              <input
                id="mod-name-input"
                value={modNameInput}
                onChange={(event) => setModNameInput(event.target.value)}
                placeholder="e.g. Royal Renaissance"
                className="openck3-form__input"
              />
              {error ? <p className="openck3-error">{error}</p> : null}
              <div className="openck3-form__actions">
                <button type="submit" className="openck3-primary-button">
                  Save Mod
                </button>
                {modName ? (
                  <button
                    type="button"
                    className="openck3-secondary-button"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        ) : (
          <section className="openck3-card openck3-card--summary">
            <h2>{modName}</h2>
            <p>Your project is ready. You can adjust the name at any time.</p>
            <button className="openck3-secondary-button" onClick={handleEdit}>
              Rename Mod
            </button>
          </section>
        )}
        {modName && !isEditingName ? (
          <PublishingWorkflow projectId={safeProjectId} />
        ) : null}
      </main>
    </div>
  );
}

export default App;
