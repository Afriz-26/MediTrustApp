// OpenStreetMap helpers: Nominatim geocoding, Photon + Overpass + Nominatim POI search.
// No API key required. Public servers are free but slow/busy at times, so every source gets a longer timeout,
// one retry, and its result (or failure) is logged to the browser console as "[MediTrust map] ...".

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const PHOTON_URL = "https://photon.komoot.io/api/";
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const SOURCE_TIMEOUT_MS = 8000;
const OVERPASS_TIMEOUT_MS = 12000;
const PHARMACY_SOURCE_TIMEOUT_MS = 6000;
const PHARMACY_OVERPASS_TIMEOUT_MS = 6000;

async function withRetry(fn, tries = 2, delayMs = 700) {
  let lastError;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < tries - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = SOURCE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search places worldwide via Nominatim. Returns [{ display_name, name, lat, lng, type, address }].
 */
export async function searchLocations(query) {
  if (!query || query.trim().length < 3) return [];
  const url = `${NOMINATIM_URL}?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(
    query.trim()
  )}`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`Location search failed (${res.status}). Please try again.`);
  const data = await res.json();
  return (data || []).map((p) => {
    const a = p.address || {};
    const city = a.city || a.town || a.village || a.suburb || a.county || "";
    return {
      display_name: p.display_name,
      name: p.name || city || p.display_name.split(",")[0],
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lon),
      type: p.type,
      city,
      state: a.state || "",
      country: a.country || "",
      address: a,
    };
  });
}

/**
 * Reverse-geocode a lat/lng to a display name (for "use current location").
 */
export async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`Could not look up your location (${res.status}).`);
  const data = await res.json();
  const a = data.address || {};
  const city = a.city || a.town || a.village || a.suburb || a.county || "";
  return {
    display_name: data.display_name,
    name: city || data.display_name.split(",")[0],
    lat,
    lng,
    city,
    state: a.state || "",
    country: a.country || "",
  };
}

// Map raw OSM healthcare/speciality tags to a readable specialisation label.
const SPECIALITY_MAP = {
  general: "General Physician",
  internal: "Internal Medicine",
  cardiology: "Cardiologist",
  dermatology: "Dermatologist",
  neurology: "Neurologist",
  orthopaedics: "Orthopaedic",
  orthopedics: "Orthopaedic",
  paediatrics: "Pediatrician",
  pediatrics: "Pediatrician",
  gynaecology: "Gynecologist",
  ophthalmology: "Ophthalmologist",
  ent: "ENT",
  psychiatry: "Psychiatrist",
  oncology: "Oncologist",
  surgery: "General Surgery",
  urology: "Urologist",
  dental: "Dentist",
  dentist: "Dentist",
  physiotherapy: "Physiotherapist",
  alternative: "Alternative Medicine",
  ayurveda: "Ayurveda",
  homeopathy: "Homeopathy",
  chiropractic: "Chiropractor",
  fertility: "Fertility Specialist",
  midwife: "Midwife",
};

function inferSpecialisation(tags) {
  const raw = tags["healthcare:speciality"] || tags["healthcare"] || tags["amenity"] || "";
  if (!raw) return "General Physician";
  // OSM speciality can be a semicolon-separated list — take the first match.
  const parts = raw.split(";").map((s) => s.trim().toLowerCase());
  for (const p of parts) {
    if (SPECIALITY_MAP[p]) return SPECIALITY_MAP[p];
  }
  // Partial match
  for (const key of Object.keys(SPECIALITY_MAP)) {
    if (parts.some((p) => p.includes(key) || key.includes(p))) return SPECIALITY_MAP[key];
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function boundingBox(lat, lng, radius) {
  const latDelta = radius / 111320;
  const lonDelta = radius / (111320 * Math.max(Math.abs(Math.cos((lat * Math.PI) / 180)), 0.01));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  return [
    clamp(lng - lonDelta, -180, 180),
    clamp(lat - latDelta, -90, 90),
    clamp(lng + lonDelta, -180, 180),
    clamp(lat + latDelta, -90, 90),
  ].join(",");
}

// ───────────────────────── Source 1: Photon (name-based text search) ─────────────────────────
async function fetchPhotonCategory({ query, tag, lat, lng, radius, timeoutMs = SOURCE_TIMEOUT_MS }) {
  const params = new URLSearchParams({
    q: query,
    lat: String(lat),
    lon: String(lng),
    bbox: boundingBox(lat, lng, radius),
    limit: "100",
    lang: "en",
  });
  if (tag) params.set("osm_tag", tag);
  const response = await fetchWithTimeout(`${PHOTON_URL}?${params}`, {}, timeoutMs);
  if (!response.ok) throw new Error(`Photon returned ${response.status}`);
  const data = await response.json();
  return data.features || [];
}

function mapPhotonFeatures(features, providerType, lat, lng, radius) {
  const osmTypes = { N: "node", W: "way", R: "relation" };
  const seen = new Set();
  const mapped = features
    .map((feature) => {
      const properties = feature.properties || {};
      const [featureLng, featureLat] = feature.geometry?.coordinates || [];
      if (!Number.isFinite(featureLat) || !Number.isFinite(featureLng) || !properties.osm_type || !properties.osm_id) return null;
      if (providerType === "pharmacy") {
        const isPharmacy = (properties.osm_key === "amenity" && properties.osm_value === "pharmacy")
          || (properties.osm_key === "shop" && ["chemist", "drugstore", "pharmacy"].includes(properties.osm_value))
          || (properties.osm_key === "healthcare" && properties.osm_value === "pharmacy");
        if (!isPharmacy) return null;
      }
      const distance = distanceKm(lat, lng, featureLat, featureLng);
      if (distance > radius / 1000) return null;
      const osm_id = `${osmTypes[properties.osm_type] || "osm"}/${properties.osm_id}`;
      if (seen.has(osm_id)) return null;
      seen.add(osm_id);
      const tags = { [properties.osm_key]: properties.osm_value };
      const facilityType = properties.osm_value === "hospital"
        ? "hospital"
        : properties.osm_value === "clinic"
          ? "clinic"
          : providerType === "pharmacy" ? "pharmacy" : "doctor";
      const address = [
        properties.housenumber,
        properties.street,
        properties.locality,
        properties.city,
        properties.state,
        properties.postcode,
      ].filter(Boolean).join(", ");
      const name = properties.name || (providerType === "pharmacy"
        ? "Pharmacy"
        : facilityType === "hospital" ? "Hospital" : facilityType === "clinic" ? "Clinic" : "Doctor / Clinic");
      tags.name = properties.name || "";
      return {
        osm_id,
        osm_type: providerType,
        name,
        osm_name: properties.name || "",
        osm_address: address,
        specialization: providerType === "pharmacy" ? "Pharmacy" : inferSpecialisation(tags),
        facility_type: facilityType,
        facility_name: name,
        phone: properties.phone || "",
        lat: featureLat,
        lng: featureLng,
        tags,
      };
    })
    .filter(Boolean);
  return mapped;
}

// ───────────────────────── Source 2: Nominatim (pharmacies only) ─────────────────────────
async function fetchNearbyPharmacies(lat, lng, radius, timeoutMs = SOURCE_TIMEOUT_MS) {
  const latDelta = radius / 111320;
  const lngDelta = radius / (111320 * Math.max(Math.abs(Math.cos((lat * Math.PI) / 180)), 0.01));
  const west = Math.max(-180, lng - lngDelta);
  const east = Math.min(180, lng + lngDelta);
  const north = Math.min(90, lat + latDelta);
  const south = Math.max(-90, lat - latDelta);
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    limit: "50",
    amenity: "pharmacy",
    viewbox: `${west},${north},${east},${south}`,
    bounded: "1",
  });
  const response = await fetchWithTimeout(`${NOMINATIM_URL}?${params}`, { headers: { "Accept-Language": "en" } }, timeoutMs);
  if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
  const places = await response.json();
  return mapNominatimPharmacies(places, lat, lng, radius);
}

function mapNominatimPharmacies(places, lat, lng, radius) {
  const seen = new Set();
  const results = [];
  for (const place of places) {
    if (place.type !== "pharmacy" || !place.osm_type || !place.osm_id) continue;
    const pharmacyLat = Number(place.lat);
    const pharmacyLng = Number(place.lon);
    if (!Number.isFinite(pharmacyLat) || !Number.isFinite(pharmacyLng)) continue;
    if (distanceKm(lat, lng, pharmacyLat, pharmacyLng) > radius / 1000) continue;
    const osmId = `${place.osm_type}/${place.osm_id}`;
    if (seen.has(osmId)) continue;
    seen.add(osmId);

    const address = place.address || {};
    const name = place.name || "Pharmacy (name not listed)";
    results.push({
      osm_id: osmId,
      osm_type: "pharmacy",
      name,
      osm_name: place.name || "",
      osm_address: [
        address.house_number,
        address.road || address.pedestrian,
        address.neighbourhood || address.suburb,
        address.city || address.town || address.village,
        address.state,
        address.postcode,
      ].filter(Boolean).join(", "),
      specialization: "Pharmacy",
      facility_type: "pharmacy",
      facility_name: name,
      phone: place.extratags?.phone || place.extratags?.["contact:phone"] || "",
      lat: pharmacyLat,
      lng: pharmacyLng,
      tags: { amenity: "pharmacy", name: place.name || "" },
    });
  }
  return results;
}

// ───────────────────────── Source 3: Overpass (searches by TAG, not by name) ─────────────────────────
// Photon/Nominatim need the shop's name to match the search words, so a shop called "Sri Sai Medicals" or a
// clinic with no obvious word in its name is missed. Overpass asks "everything tagged pharmacy/chemist/clinic here".
const OVERPASS_FILTERS = {
  pharmacy: ['"amenity"="pharmacy"', '"shop"="chemist"', '"healthcare"="pharmacy"'],
  doctor: [
    '"amenity"="hospital"', '"amenity"="clinic"', '"amenity"="doctors"',
    '"healthcare"="doctor"', '"healthcare"="clinic"', '"healthcare"="hospital"',
  ],
};

async function fetchOverpass(providerType, lat, lng, radius, timeoutMs = OVERPASS_TIMEOUT_MS) {
  const r = Math.round(radius);
  const body = OVERPASS_FILTERS[providerType].map((f) => `nw[${f}](around:${r},${lat},${lng});`).join("");
  const query = `[out:json][timeout:10];(${body});out center tags 150;`;
  const attempt = async (url) => {
    const response = await fetchWithTimeout(url, { method: "POST", body: new URLSearchParams({ data: query }) }, timeoutMs);
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const data = await response.json();
    return data.elements || [];
  };
  let elements;
  try {
    elements = await Promise.any(OVERPASS_URLS.map(attempt));
  } catch (error) {
    throw new Error("Overpass is temporarily unavailable");
  }
  return mapOverpassElements(elements, providerType, lat, lng, radius);
}

function mapOverpassElements(elements, providerType, lat, lng, radius) {
  const results = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const pLat = Number(el.lat ?? el.center?.lat);
    const pLng = Number(el.lon ?? el.center?.lon);
    if (!el.type || !el.id || !Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;
    if (distanceKm(lat, lng, pLat, pLng) > radius / 1000) continue;
    const rawName = tags.name || tags["name:en"] || "";
    const kind = tags.amenity || tags.healthcare || "";
    const facilityType = providerType === "pharmacy"
      ? "pharmacy"
      : kind === "hospital" ? "hospital" : kind === "clinic" ? "clinic" : "doctor";
    const name = rawName || (providerType === "pharmacy"
      ? "Medical store (name not listed)"
      : facilityType === "hospital" ? "Hospital" : facilityType === "clinic" ? "Clinic" : "Doctor / Clinic");
    results.push({
      osm_id: `${el.type}/${el.id}`,
      osm_type: providerType,
      name,
      osm_name: rawName,
      osm_address: [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:suburb"] || tags["addr:neighbourhood"],
        tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
        tags["addr:state"],
        tags["addr:postcode"],
      ].filter(Boolean).join(", "),
      specialization: providerType === "pharmacy" ? "Pharmacy" : inferSpecialisation(tags),
      facility_type: facilityType,
      facility_name: name,
      phone: tags.phone || tags["contact:phone"] || "",
      lat: pLat,
      lng: pLng,
      tags: providerType === "pharmacy"
        ? { amenity: "pharmacy", name: rawName }
        : { amenity: tags.amenity || "", healthcare: tags.healthcare || "", name: rawName },
    });
  }
  return results;
}

// ───────────────────────── Combine sources ─────────────────────────
function mergeProviders(lat, lng, ...groups) {
  const unique = [];
  const seenIds = new Set();
  for (const provider of groups.flat()) {
    if (seenIds.has(provider.osm_id)) continue;
    seenIds.add(provider.osm_id);
    const name = (provider.osm_name || "").trim().toLowerCase();
    const duplicate = name && unique.some((existing) =>
      (existing.osm_name || "").trim().toLowerCase() === name
      && distanceKm(provider.lat, provider.lng, existing.lat, existing.lng) < 0.1
    );
    if (!duplicate) unique.push(provider);
  }
  return unique.sort((a, b) =>
    distanceKm(lat, lng, a.lat, a.lng) - distanceKm(lat, lng, b.lat, b.lng)
  );
}

const PHARMACY_PHOTON = [
  { query: "pharmacy" },
  { query: "medical" },
];
const DOCTOR_PHOTON = [
  { query: "hospital", tag: "amenity:hospital" },
  { query: "clinic", tag: "amenity:clinic" },
  { query: "doctor", tag: "amenity:doctors" },
];

// Runs all sources in parallel. Returns the merged list plus whether the main source (Overpass) answered,
// so an empty list can be told apart from "the servers did not respond".
async function searchRadius(providerType, lat, lng, radius, {
  includeNominatim = false,
  overpassOnly = false,
  includeOverpass = true,
} = {}) {
  const jobs = [];
  const add = (label, fn) => jobs.push({
    label,
    run: () => withRetry(fn, providerType === "pharmacy" ? 1 : 2),
  });
  const sourceTimeoutMs = providerType === "pharmacy" ? PHARMACY_SOURCE_TIMEOUT_MS : SOURCE_TIMEOUT_MS;

  if (!overpassOnly) {
    const categories = providerType === "pharmacy" ? PHARMACY_PHOTON : DOCTOR_PHOTON;
    for (const category of categories) {
      add(`photon "${category.query}"`, () => fetchPhotonCategory({ ...category, lat, lng, radius, timeoutMs: sourceTimeoutMs })
        .then((features) => mapPhotonFeatures(features, providerType, lat, lng, radius)));
    }
    if (providerType === "pharmacy" && includeNominatim) {
      add("nominatim", () => fetchNearbyPharmacies(lat, lng, radius, sourceTimeoutMs));
    }
  }
  if (includeOverpass || overpassOnly) {
    const timeoutMs = providerType === "pharmacy" ? PHARMACY_OVERPASS_TIMEOUT_MS : OVERPASS_TIMEOUT_MS;
    add("overpass", () => fetchOverpass(providerType, lat, lng, radius, timeoutMs));
  }

  const settled = await Promise.allSettled(jobs.map((job) => job.run()));
  const groups = [];
  let overpassOk = false;
  let discoverySourcesOk = false;
  settled.forEach((outcome, index) => {
    const label = jobs[index].label;
    if (outcome.status === "fulfilled") {
      groups.push(outcome.value);
      if (label === "overpass") overpassOk = true;
      if (label === "overpass" || label.startsWith("photon")) discoverySourcesOk = true;
      console.info(`[MediTrust map] ${providerType} ${Math.round(radius / 1000)}km ${label}: ${outcome.value.length} found`);
    } else {
      console.warn(`[MediTrust map] ${providerType} ${Math.round(radius / 1000)}km ${label} FAILED:`, outcome.reason?.message || outcome.reason);
    }
  });
  const list = mergeProviders(lat, lng, ...groups)
    .filter((p) => distanceKm(lat, lng, p.lat, p.lng) <= radius / 1000);
  return {
    list,
    overpassOk,
    discoverySourcesOk,
    sourcesOk: settled.some((outcome) => outcome.status === "fulfilled"),
  };
}

/**
 * Fetch nearby doctors/hospitals or pharmacies from OpenStreetMap around a point.
 * type: "doctors" | "pharmacy"
 * radius in meters. If few results, the search widens to 20 km, and if still nothing to 40 km (tag search only).
 */
export async function fetchNearbyProviders(lat, lng, type, radius = 8000, { forceRefresh = false } = {}) {
  const providerType = type === "doctors" ? "doctor" : type;
  const cacheKey = `osm_v7_${providerType}_${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`;
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.expiry > Date.now()) return parsed.data;
      }
    } catch (error) {
      console.warn("Nearby provider cache is unavailable.", error);
    }
  }

  const isPharmacy = providerType === "pharmacy";
  if (isPharmacy) {
    const nearby = await searchRadius(providerType, lat, lng, radius, {
      includeNominatim: true,
      includeOverpass: false,
    });
    let list = nearby.list;
    let discoverySourceAnswered = nearby.discoverySourcesOk;

    const minimumUsefulPharmacyResults = 5;
    if (list.length < minimumUsefulPharmacyResults && radius < 20000) {
      const wider = await searchRadius(providerType, lat, lng, 20000, {
        includeNominatim: true,
        includeOverpass: false,
      });
      list = mergeProviders(lat, lng, list, wider.list);
      discoverySourceAnswered = discoverySourceAnswered || wider.discoverySourcesOk;
    }

    if (list.length < minimumUsefulPharmacyResults && radius < 40000) {
      const tagged = await searchRadius(providerType, lat, lng, 40000, { overpassOnly: true });
      list = mergeProviders(lat, lng, list, tagged.list);
      discoverySourceAnswered = discoverySourceAnswered || tagged.discoverySourcesOk;
    }

    if (list.length === 0 && !discoverySourceAnswered) {
      throw new Error("The map servers did not respond. Check your connection or ad-blocker, then retry.");
    }
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        data: list,
        expiry: Date.now() + (list.length ? 6 * 60 : 2) * 60 * 1000,
      }));
    } catch (error) {
      console.warn("Nearby pharmacy results could not be cached.", error);
    }
    return list;
  }

  const wantAtLeast = 3;
  const first = await searchRadius(providerType, lat, lng, radius, {
    includeOverpass: true,
  });
  let list = first.list;
  let overpassAnswered = first.overpassOk;
  let sourceAnswered = first.sourcesOk;

  if (list.length < wantAtLeast && radius < 20000) {
    const wider = await searchRadius(providerType, lat, lng, 20000, {
      includeOverpass: true,
    });
    list = mergeProviders(lat, lng, list, wider.list);
    overpassAnswered = overpassAnswered || wider.overpassOk;
    sourceAnswered = sourceAnswered || wider.sourcesOk;
  }
  if (list.length === 0 && radius < 40000) {
    const widest = await searchRadius(providerType, lat, lng, 40000, { overpassOnly: true });
    list = mergeProviders(lat, lng, list, widest.list);
    overpassAnswered = overpassAnswered || widest.overpassOk;
    sourceAnswered = sourceAnswered || widest.sourcesOk;
  }

  if (list.length === 0 && !sourceAnswered && !overpassAnswered) {
    // Not "nothing exists" - the map servers did not answer. Show the retry state instead of a false empty list.
    throw new Error("The map servers did not respond. Check your connection or ad-blocker, then retry.");
  }

  if (list.length > 0) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data: list, expiry: Date.now() + 6 * 60 * 60 * 1000 }));
    } catch (error) {
      console.warn("Nearby provider results could not be cached.", error);
    }
  }
  return list;
}

/** Haversine distance in km between two coords. */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
