import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  buildDownloadUrl,
  getBuild,
  triggerBuild,
  uploadAudio,
  uploadTexture,
  uploadWorkshop
} from "../api";
import type { AssetRecord, BuildJob } from "../types";

const POLL_INTERVAL = 3000;

function PublishingWorkflow() {
  const [projectId, setProjectId] = useState("my-mod");
  const [textureFile, setTextureFile] = useState<File | null>(null);
  const [textureUsage, setTextureUsage] = useState("interface icon");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioComposer, setAudioComposer] = useState("");
  const [job, setJob] = useState<BuildJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [assetLog, setAssetLog] = useState<string[]>([]);
  const [visibility, setVisibility] = useState("private");
  const [isWorkshopUploadPending, setIsWorkshopUploadPending] = useState(false);

  useEffect(() => {
    if (!job || !isPolling) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const next = await getBuild(job.id);
        setJob(next);
        if (next.status === "completed") {
          setMessage("Build ready for download");
          setIsPolling(false);
        } else if (next.status === "failed") {
          setError(next.message);
          setIsPolling(false);
        }
      } catch (pollError) {
        setError((pollError as Error).message);
        setIsPolling(false);
      }
    }, POLL_INTERVAL);

    return () => window.clearInterval(interval);
  }, [job, isPolling]);

  const progressPercentage = useMemo(() => {
    if (!job) {
      return 0;
    }
    return Math.round(job.progress * 100);
  }, [job]);

  const buildStatusLabel = useMemo(() => {
    if (!job) {
      return "No build started yet";
    }
    if (job.status === "running") {
      return `In progress • ${progressPercentage}%`;
    }
    return job.message ?? job.status;
  }, [job, progressPercentage]);

  const handleTextureSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectId || !textureFile) {
      setError("Select a texture and project before uploading.");
      return;
    }
    try {
      const asset = await uploadTexture(projectId, textureFile, textureUsage);
      appendAssetLog(asset);
      setMessage(`Uploaded texture ${asset.filename}`);
      setError(null);
      setTextureFile(null);
      (event.target as HTMLFormElement).reset();
    } catch (uploadError) {
      setError((uploadError as Error).message);
    }
  };

  const handleAudioSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectId || !audioFile || !audioTitle || !audioComposer) {
      setError("Audio upload requires file, title, and composer.");
      return;
    }
    try {
      const asset = await uploadAudio(projectId, audioFile, audioTitle, audioComposer);
      appendAssetLog(asset);
      setMessage(`Uploaded audio ${asset.filename}`);
      setError(null);
      setAudioFile(null);
      setAudioTitle("");
      setAudioComposer("");
      (event.target as HTMLFormElement).reset();
    } catch (uploadError) {
      setError((uploadError as Error).message);
    }
  };

  const appendAssetLog = (asset: AssetRecord) => {
    setAssetLog((current) => [
      `${new Date().toLocaleTimeString()} • ${asset.kind.toUpperCase()} • ${asset.filename}`,
      ...current
    ]);
  };

  const handleBuild = async () => {
    if (!projectId) {
      setError("Project ID is required to start a build.");
      return;
    }
    try {
      const newJob = await triggerBuild(projectId);
      setJob(newJob);
      setMessage("Build queued");
      setError(null);
      setIsPolling(true);
    } catch (buildError) {
      setError((buildError as Error).message);
      setIsPolling(false);
    }
  };

  const handleWorkshopUpload = async () => {
    if (!job || job.status !== "completed") {
      setError("Run a successful build before uploading to the Workshop.");
      return;
    }
    setIsWorkshopUploadPending(true);
    try {
      await uploadWorkshop(job.id, visibility);
      setMessage("Workshop upload staged successfully.");
      setError(null);
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setIsWorkshopUploadPending(false);
    }
  };

  const downloadUrl = job && job.status === "completed" ? buildDownloadUrl(job.id) : null;

  return (
    <div>
      <section className="panel">
        <h2>1. Prepare Assets</h2>
        <div className="form-row">
          <label>
            Project ID
            <input
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              placeholder="my-mod"
            />
          </label>
        </div>
        <form className="panel" onSubmit={handleTextureSubmit}>
          <h3>Upload Texture</h3>
          <div className="form-row">
            <label>
              DDS/Source File
              <input
                type="file"
                accept=".dds,.png,.tga,.jpg,.jpeg"
                onChange={(event) => setTextureFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label>
              Usage
              <input
                value={textureUsage}
                onChange={(event) => setTextureUsage(event.target.value)}
                placeholder="interface icon"
              />
            </label>
          </div>
          <button type="submit">Upload Texture</button>
        </form>

        <form className="panel" onSubmit={handleAudioSubmit}>
          <h3>Upload Audio</h3>
          <div className="form-row">
            <label>
              Audio File
              <input
                type="file"
                accept=".ogg,.wav"
                onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label>
              Track Title
              <input
                value={audioTitle}
                onChange={(event) => setAudioTitle(event.target.value)}
              />
            </label>
            <label>
              Composer
              <input
                value={audioComposer}
                onChange={(event) => setAudioComposer(event.target.value)}
              />
            </label>
          </div>
          <button type="submit">Upload Audio</button>
        </form>

        {assetLog.length > 0 && (
          <div className="asset-log">
            <strong>Recent uploads</strong>
            <ul>
              {assetLog.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>2. Build &amp; Publish</h2>
        <div className="actions">
          <button onClick={handleBuild}>Start Build</button>
          {downloadUrl && (
            <a href={downloadUrl} className="secondary">
              Download ZIP
            </a>
          )}
        </div>
        <div className="status-line">{buildStatusLabel}</div>
        <div className="progress-bar" aria-hidden={!job}>
          <div
            className="progress-bar__fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        {job?.message && <div className="message">{job.message}</div>}
        <div className="actions">
          <div className="visibility-select">
            <label htmlFor="workshop-visibility">Visibility</label>
            <select
              id="workshop-visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
            >
              <option value="private">Private</option>
              <option value="friends">Friends Only</option>
              <option value="public">Public</option>
            </select>
          </div>
          <button onClick={handleWorkshopUpload} disabled={isWorkshopUploadPending}>
            {isWorkshopUploadPending ? "Uploading…" : "Upload to Steam Workshop"}
          </button>
        </div>
      </section>

      {message && <div className="message">{message}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default PublishingWorkflow;
