import JSZip from "jszip";

const DEFAULT_MOD_SLUG = "openck3_mod";

export function normalizeModSlug(modName: string): string {
  const slug = modName
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_\-]/g, "");

  return slug || DEFAULT_MOD_SLUG;
}

export async function exportModPackage(modName: string): Promise<void> {
  const zip = new JSZip();
  const safeSlug = normalizeModSlug(modName);
  const rootFolder = zip.folder("ck3");

  rootFolder?.folder(safeSlug);

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const trimmedName = modName.trim();
  const sanitizedDownloadName = trimmedName
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const downloadName = sanitizedDownloadName
    ? `${sanitizedDownloadName}.zip`
    : `${safeSlug}.zip`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = downloadName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
