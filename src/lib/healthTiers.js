
// Health Tracker storage tier definitions and helpers.
// Tiers meter by total uploaded file size (bytes).
import { db } from '@/api/client';

export const TIERS = {
  free: { id: "free", label: "Free", limit: 50 * 1024 * 1024, limitLabel: "50 MB", price: 0 },
  pro: { id: "pro", label: "Pro", limit: 1024 * 1024 * 1024, limitLabel: "1 GB", price: 99 },
  elite: { id: "elite", label: "Elite", limit: 10 * 1024 * 1024 * 1024, limitLabel: "10 GB", price: 150 },
};

export const TIER_ORDER = ["free", "pro", "elite"];

export function getTier(tierId) {
  return TIERS[tierId] || TIERS.free;
}

// Sum file sizes across a user's health logs.
export function computeUsedBytes(logs) {
  return (logs || []).reduce((sum, l) => sum + (l.file_size || 0), 0);
}

export function formatBytes(bytes) {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// Persist the tier to the UserProfile entity (source of truth).
export async function syncTierToProfile(tierId, email) {
  if (!email) return;
  const page = await db.entities.UserProfile.filter({ email }, { limit: 1 });
  if (page.length) {
    await db.entities.UserProfile.update(page[0].id, { health_tracker_tier: tierId });
  }
}

// Read the user's tier from the UserProfile entity.
export async function readTier(email) {
  if (!email) return "free";
  const page = await db.entities.UserProfile.filter({ email }, { limit: 1 });
  if (page.length && page[0].health_tracker_tier) {
    return page[0].health_tracker_tier;
  }
  return "free";
}