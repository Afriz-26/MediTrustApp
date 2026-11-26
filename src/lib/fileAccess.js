
// Helpers for private file access — generates signed, time-limited URLs
// for files uploaded via UploadPrivateFile.
import { db } from '@/api/client';

// Cache signed URLs to avoid re-generating on every render.
const urlCache = new Map(); // fileUri -> { url, expiresAt }

export async function getSignedFileUrl(fileUri, expiresIn = 300) {
  if (!fileUri) return null;
  const cached = urlCache.get(fileUri);
  if (cached && cached.expiresAt > Date.now() + 5000) {
    return cached.url;
  }
  try {
    const res = await db.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: expiresIn });
    const url = res.signed_url;
    urlCache.set(fileUri, { url, expiresAt: Date.now() + expiresIn * 1000 });
    return url;
  } catch (_) {
    return null;
  }
}