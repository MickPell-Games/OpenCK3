export interface BuildJob {
  id: string;
  project_id: string;
  status: string;
  progress: number;
  message: string;
  artifact_path: string | null;
  created_at: number;
  updated_at: number;
}

export interface AssetRecord {
  project_id: string;
  filename: string;
  kind: "dds" | "audio";
  metadata: Record<string, unknown>;
}
