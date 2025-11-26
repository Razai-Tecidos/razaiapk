// release.ts - utilities to fetch published release manifest from Supabase
// Manifest shape produced by publish-release.mjs:
// {
//   version: string;
//   channel: string; // e.g. 'stable'
//   publishedAt: string; // ISO
//   files: Array<{ name: string; sizeBytes: number; sha256: string; url: string }>;
//   totalSize: number;
// }

export interface ReleaseFileEntry {
  name: string;
  sizeBytes: number;
  sha256: string;
  url: string;
}
export interface ReleaseManifest {
  version: string;
  channel: string;
  publishedAt: string;
  files: ReleaseFileEntry[];
  totalSize: number;
}

// Configure base public URL via the existing cloud config if available or explicit env
// Fallback: read VITE_SUPABASE_URL and assume bucket 'releases'
export function getReleaseManifestUrl(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return null;
  return `${url}/storage/v1/object/public/releases/latest-release.json`;
}

export async function fetchLatestRelease(): Promise<ReleaseManifest | null> {
  const manifestUrl = getReleaseManifestUrl();
  if (!manifestUrl) return null;
  try {
    const res = await fetch(manifestUrl);
    if (!res.ok) return null;
    const json = await res.json();
    // Basic validation
    if (!json || typeof json.version !== 'string' || !Array.isArray(json.files)) return null;
    return json as ReleaseManifest;
  } catch {
    return null;
  }
}

export function compareVersions(current: string, remote: string): number {
  // Returns -1 if remote newer, 0 equal, 1 if current newer (unlikely)
  const parse = (v: string) => v.split('.').map(x => parseInt(x, 10));
  const a = parse(current);
  const b = parse(remote);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}
