
import { db } from '@/api/client';

import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { Loader2, MapPin, Stethoscope, Pill as PillIcon, Phone, ShieldCheck, Users, Maximize2, Minimize2, Navigation } from "lucide-react";
import { fetchNearbyProviders, distanceKm } from "@/lib/osm";
import { buildExternalId } from "@/lib/providerRequests";
import { getDirectionsUrl, getMapsSearchUrl } from "@/lib/maps";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import features from "@/config/features";
import ManualRequestCard from "@/components/provider/ManualRequestCard";
import DirectoryListings from "@/components/provider/DirectoryListings";
import "leaflet/dist/leaflet.css";

// Recenter the map when the center prop changes.
function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center[0], center[1]]);
  return null;
}

// Live Leaflet map of real doctors/pharmacies from OpenStreetMap Overpass API,
// deduplicated against onboarded (MediTrust Verified) providers.
// In compact mode, the map is a small fixed-height section and results
// render progressively as they arrive.
// Manual provider requests remain available when live map search has no results or is unavailable.
export default function ProviderMap(props) {
  const kind = props.type === "pharmacies" || props.type === "pharmacy" ? "pharmacy" : "doctor";
  return (
    <div className="space-y-4">
      {/* MediTrust's own local directory: covers towns where OpenStreetMap has little or no data */}
      <DirectoryListings kind={kind} center={props.center} />
      {features.externalListings
        ? <ProviderMapInner {...props} />
        : <ManualRequestCard type={kind} />}
    </div>
  );
}

function ProviderMapInner({ center, type, onProviderSelect, requestedProviderIds = new Set(), radius = 6000, compact = false, searchQuery = "" }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [verifiedMap, setVerifiedMap] = useState({});
  const [demandMap, setDemandMap] = useState({});
  const [expanded, setExpanded] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceReload, setSourceReload] = useState(0);

  const providerType = type === "doctors" ? "doctor" : "pharmacy";

  // Fetch onboarded (approved) external sources for this type, plus demand aggregates.
  useEffect(() => {
    let active = true;
    setSourceError("");
    (async () => {
      try {
        const page = await db.entities.ProviderExternalSource.list({ sort: "-latest_request_date", limit: 200 });
        if (!active) return;
        const rows = page;
        const v = {};
        const d = {};
        for (const r of rows) {
          if (r.provider_type !== providerType) continue;
          if (r.status === "approved") v[r.external_provider_id] = r;
          d[r.external_provider_id] = r.request_count || 0;
        }
        setVerifiedMap(v);
        setDemandMap(d);
      } catch (e) {
        if (!active) return;
        console.error("Failed to load verified external provider details.", e);
        setSourceError("Verified provider details could not be loaded.");
      }
    })();
    return () => { active = false; };
  }, [providerType, sourceReload]);

  // Fetch nearby providers — progressively update as data arrives
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setProviders([]);
    fetchNearbyProviders(center[0], center[1], type, radius)
      .then((data) => {
        if (!active) return;
        const ranked = data
          .map((p) => ({ ...p, distance: distanceKm(center[0], center[1], p.lat, p.lng) }))
          .sort((a, b) => a.distance - b.distance);
        // Progressive render: add in batches of 5
        let i = 0;
        const batchSize = 5;
        const renderBatch = () => {
          if (!active || i >= ranked.length) {
            setLoading(false);
            return;
          }
          const batch = ranked.slice(i, i + batchSize);
          setProviders(prev => [...prev, ...batch]);
          i += batchSize;
          if (i < ranked.length) {
            setTimeout(renderBatch, 50);
          } else {
            setLoading(false);
          }
        };
        renderBatch();
      })
      .catch((e) => {
        if (active) {
          console.error("Failed to load nearby providers.", e);
          setError(e.message || "Failed to load nearby places");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [center[0], center[1], type, radius]);

  const isDoctor = type === "doctors";
  const markerColor = isDoctor ? "#2563eb" : "#ec4899";

  const enrich = (p) => {
    const externalId = buildExternalId(p.osm_id);
    const verifiedRow = verifiedMap[externalId];
    return {
      ...p,
      externalId,
      verified: !!verifiedRow,
      profileId: verifiedRow?.linked_profile_id || "",
      requestCount: demandMap[externalId] || 0,
    };
  };

  const handleSelect = (p) => {
    setSelected(enrich(p));
  };

  // Filter providers by search query (name, specialization, address)
  const filteredProviders = providers.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const haystack = [p.name, p.specialization, p.facility_name, p.osm_address].join(' ').toLowerCase();
    return haystack.includes(q);
  });

  const mapHeight = compact ? (expanded ? "400px" : "240px") : "420px";
  const farthestKm = providers.reduce((max, provider) => Math.max(max, provider.distance || 0), 0);
  const searchRadiusKm = farthestKm > radius / 1000
    ? Math.ceil(farthestKm / 5) * 5
    : radius / 1000;
  const selectedAlreadyRequested = selected && (
    requestedProviderIds.has(String(selected.osm_id))
    || requestedProviderIds.has(String(selected.externalId))
  );
  const externalSearchUrl = !isDoctor
    ? getMapsSearchUrl(center[0], center[1], "pharmacies")
    : null;

  const retryNearbySearch = () => {
    setError("");
    setLoading(true);
    setProviders([]);
    fetchNearbyProviders(center[0], center[1], type, radius, { forceRefresh: true })
      .then((data) => {
        const ranked = data
          .map((provider) => ({ ...provider, distance: distanceKm(center[0], center[1], provider.lat, provider.lng) }))
          .sort((a, b) => a.distance - b.distance);
        setProviders(ranked);
      })
      .catch((e) => {
        console.error("Failed to retry nearby provider search.", e);
        setError(e.message || "Failed to load nearby places");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className={compact ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200" style={{ height: mapHeight }}>
        <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full" style={{ zIndex: 0 }}>
          <Recenter center={center} />
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CircleMarker center={center} radius={8} pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.9 }} />
          {filteredProviders.map((p, i) => {
            const ep = enrich(p);
            const color = ep.verified ? "#16a34a" : markerColor;
            return (
              <CircleMarker
                key={p.osm_id + i}
                center={[p.lat, p.lng]}
                radius={ep.verified ? 8 : 7}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}
                eventHandlers={{ click: () => handleSelect(p) }}
              >
                <Popup>
                  <div className="min-w-[180px]">
                    <p className="font-semibold text-gray-800">{p.name}</p>
                    {p.specialization && p.specialization !== "Pharmacy" && (
                      <p className="text-xs text-blue-600 font-medium mt-0.5">{p.specialization}</p>
                    )}
                    {p.facility_name && p.facility_name !== p.name && (
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">{p.facility_type} · {p.facility_name}</p>
                    )}
                    {ep.verified
                      ? <p className="text-xs text-emerald-600 font-medium mt-1">MediTrust Verified</p>
                      : <p className="text-xs text-slate-500 mt-1">External Listing</p>}
                    {p.osm_address && <p className="text-xs text-gray-500 mt-1">{p.osm_address}</p>}
                    <p className="text-xs text-blue-600 mt-1">{p.distance.toFixed(1)} km away</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {loading && (
          <div className="absolute top-3 left-3 bg-white/90 rounded-xl px-3 py-2 shadow flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            {isDoctor ? "Loading nearby doctors…" : "Searching pharmacies and nearby towns…"}
          </div>
        )}

        {/* Expand/collapse toggle (compact mode only) */}
        {compact && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="absolute top-3 right-3 bg-white/90 rounded-lg p-2 shadow hover:bg-white transition-colors"
            title={expanded ? "Collapse map" : "Expand map"}
          >
            {expanded ? <Minimize2 className="w-4 h-4 text-gray-600" /> : <Maximize2 className="w-4 h-4 text-gray-600" />}
          </button>
        )}

        <div className="absolute bottom-3 right-3 bg-white/90 rounded-lg px-2 py-1 text-[10px] text-gray-500 shadow">© OpenStreetMap</div>
      </div>

      {sourceError && (
        <div role="alert" className="m-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {sourceError}
          <Button size="sm" variant="outline" className="ml-2" onClick={() => setSourceReload((value) => value + 1)}>Retry</Button>
        </div>
      )}

      {/* Results list */}
      <div className={`rounded-2xl border border-gray-200 bg-white overflow-y-auto ${compact ? 'h-[400px]' : 'h-[420px] lg:h-[560px]'}`}>
        <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 z-10">
          <p className="text-sm font-semibold text-gray-800">
            {loading
              ? isDoctor ? "Searching…" : "Searching this area and nearby towns…"
              : error
                ? "Nearby search unavailable"
                : isDoctor
                  ? `${filteredProviders.length} healthcare places found within ${searchRadiusKm} km`
                  : `${filteredProviders.length} pharmacies found`}
          </p>
          <p className="text-xs text-gray-500">Live data from OpenStreetMap · deduplicated with MediTrust</p>
        </div>

        {error && (
          <div className="p-6 text-center text-gray-500">
            <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">Couldn't load nearby {isDoctor ? "healthcare places" : "pharmacies"}.</p>
            <p className="text-xs mt-1 mb-3">
              {isDoctor
                ? "The map service may be busy. Please try again."
                : "OpenStreetMap search services are temporarily unavailable. Retry, search Google Maps, or tell us about the pharmacy below."}
            </p>
            <div className="flex justify-center gap-2">
              <Button size="sm" variant="outline" onClick={retryNearbySearch} className="rounded-xl">Retry</Button>
              {externalSearchUrl && (
                <a href={externalSearchUrl} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="rounded-xl">Search Google Maps</Button>
                </a>
              )}
            </div>
          </div>
        )}

        {!loading && !error && filteredProviders.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No mapped {isDoctor ? "healthcare places" : "pharmacies"} found in this area.</p>
            <p className="text-xs mt-1">
              {isDoctor
                ? "OpenStreetMap may not have this clinic listed yet. Tell us about one below and we will review it."
                : "OpenStreetMap may not have pharmacies mapped here; this does not mean none exist. Search Google Maps or tell us about one below so our team can review it."}
            </p>
            <div className="flex justify-center gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={retryNearbySearch} className="rounded-xl">Search again</Button>
              {externalSearchUrl && (
                <a href={externalSearchUrl} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="rounded-xl">Search Google Maps</Button>
                </a>
              )}
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {filteredProviders.map((p, i) => {
            const ep = enrich(p);
            return (
              <button
                key={p.osm_id + i}
                onClick={() => handleSelect(p)}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selected?.osm_id === p.osm_id ? "bg-blue-50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ep.verified ? "#dcfce7" : (isDoctor ? "#dbeafe" : "#fce7f3") }}>
                    {isDoctor ? <Stethoscope className="w-5 h-5" style={{ color: ep.verified ? "#16a34a" : markerColor }} /> : <PillIcon className="w-5 h-5" style={{ color: ep.verified ? "#16a34a" : markerColor }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                      <span className="text-xs text-blue-600 font-medium flex-shrink-0">{p.distance.toFixed(1)} km</span>
                    </div>
                    {isDoctor && p.specialization && (
                      <p className="text-xs text-blue-600 font-medium truncate">{p.specialization}</p>
                    )}
                    {p.facility_name && p.facility_name !== p.name && (
                      <p className="text-xs text-gray-500 truncate capitalize">{p.facility_type} · {p.facility_name}</p>
                    )}
                    {p.osm_address && (
                      <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {p.osm_address}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {ep.verified ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px] py-0"><ShieldCheck className="w-3 h-3 mr-1" /> MediTrust Verified</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] py-0 text-slate-500">External Listing</Badge>
                      )}
                      {!ep.verified && ep.requestCount > 0 && (
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><Users className="w-3 h-3" /> {ep.requestCount} requested</span>
                      )}
                      {p.phone && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Phone className="w-3 h-3" /> {p.phone}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3 pb-safe flex gap-2">
            <Button
              onClick={() => onProviderSelect && onProviderSelect(selected)}
              disabled={selectedAlreadyRequested}
              className="flex-1 rounded-xl"
              style={{ background: selectedAlreadyRequested ? "#64748b" : markerColor }}
            >
              {selectedAlreadyRequested ? "Requested" : "Request"}
            </Button>
            {selected.lat != null && selected.lng != null && (
              <a href={getDirectionsUrl(selected.lat, selected.lng, center[0], center[1])} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="outline" className="w-full rounded-xl">
                  <Navigation className="w-4 h-4 mr-1" /> Get Directions
                </Button>
              </a>
            )}
          </div>
        )}
      </div>

      {!loading && (error || filteredProviders.length === 0) && (
        <div className={compact ? "lg:col-span-2" : ""}>
          <ManualRequestCard type={isDoctor ? "doctor" : "pharmacy"} />
        </div>
      )}
    </div>
  );
}