// Google Maps directions/search URL helpers — no API key required.
// Generates universal Google Maps URLs from stored coordinates.

/**
 * Get a Google Maps directions URL from user's location to a destination.
 * If userLat/userLng are available, sets both origin and destination.
 * Otherwise just sets destination.
 */
export function getDirectionsUrl(destLat, destLng, userLat = null, userLng = null) {
  if (destLat == null || destLng == null) return null;
  const params = { api: '1', destination: `${destLat},${destLng}` };
  if (userLat != null && userLng != null) {
    params.origin = `${userLat},${userLng}`;
  }
  const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `https://www.google.com/maps/dir/?${query}`;
}

/**
 * Get a Google Maps search/place URL for a location with an optional name.
 */
export function getMapsSearchUrl(lat, lng, name = null) {
  if (lat == null || lng == null) return null;
  const query = name ? encodeURIComponent(`${name} ${lat},${lng}`) : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}