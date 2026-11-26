

import { db } from '@/api/client';

import { medicineDataset } from "./medicineDataset";

// In-memory cache of medicines for instant autocomplete.
// Loaded once from the Medicine entity (open-dataset import), falling back to
// the curated info-only dataset if the entity is empty.
let cache = null;
let loadingPromise = null;

function normalize(row) {
  return {
    id: row.id || row.source_id,
    source_id: row.source_id || row.id,
    name: row.name,
    generic: row.generic || "",
    manufacturer: row.manufacturer || "",
    category: row.category || "",
    rx: !!row.rx,
    uses: row.uses || "",
    symptoms: row.symptoms || [],
    mrp_range: row.mrp_range || "",
    image_url: row.image_url || "",
    source: row.source || "curated_open",
  };
}

export async function loadMedicines(force = false) {
  if (cache && !force) return cache;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const page = await db.entities.Medicine.list({ limit: 200 });
      const rows = page;
      if (rows.length) {
        cache = rows.map(normalize);
        return cache;
      }
    } catch (e) {
      // fall through to local dataset
    }
    cache = medicineDataset.map((m) => ({ ...m, id: m.source_id }));
    return cache;
  })();
  const result = await loadingPromise;
  loadingPromise = null;
  return result;
}