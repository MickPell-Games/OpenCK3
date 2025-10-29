import type { AssetRecord, BuildJob } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.detail ?? response.statusText;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return (await response.json()) as T;
}

export async function uploadTexture(
  projectId: string,
  file: File,
  usage: string
): Promise<AssetRecord> {
  const body = new FormData();
  body.append("project_id", projectId);
  body.append("file", file);
  body.append("metadata", JSON.stringify({ usage }));

  const response = await fetch(`${API_BASE}/assets/dds`, {
    method: "POST",
    body
  });
  const payload = await handleResponse<{ asset: AssetRecord }>(response);
  return payload.asset;
}

export async function uploadAudio(
  projectId: string,
  file: File,
  title: string,
  composer: string
): Promise<AssetRecord> {
  const body = new FormData();
  body.append("project_id", projectId);
  body.append("file", file);
  body.append(
    "metadata",
    JSON.stringify({ title, composer, uploaded_at: new Date().toISOString() })
  );

  const response = await fetch(`${API_BASE}/assets/audio`, {
    method: "POST",
    body
  });
  const payload = await handleResponse<{ asset: AssetRecord }>(response);
  return payload.asset;
}

export async function triggerBuild(projectId: string): Promise<BuildJob> {
  const response = await fetch(`${API_BASE}/builds/${projectId}`, {
    method: "POST"
  });
  const payload = await handleResponse<{ job: BuildJob }>(response);
  return payload.job;
}

export async function getBuild(jobId: string): Promise<BuildJob> {
  const response = await fetch(`${API_BASE}/builds/${jobId}`);
  return await handleResponse<BuildJob>(response);
}

export async function uploadWorkshop(jobId: string, visibility: string): Promise<void> {
  const body = new FormData();
  body.append("job_id", jobId);
  body.append("visibility", visibility);
  const response = await fetch(`${API_BASE}/workshop/upload`, {
    method: "POST",
    body
  });
  await handleResponse(response);
}

export function buildDownloadUrl(jobId: string): string {
  return `${API_BASE}/builds/${jobId}/download`;
}
