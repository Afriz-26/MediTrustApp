import React, { useEffect, useState } from "react";
import { db } from "@/api/client";
import { Phone, Navigation, MapPin, Stethoscope, Pill as PillIcon } from "lucide-react";
import { distanceKm } from "@/lib/osm";
import { getDirectionsUrl } from "@/lib/maps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// MediTrust's own directory of local clinics/pharmacies that are not on the platform yet.
// Fills the gaps OpenStreetMap has in small towns. Added by the MediTrust team (admin).
// Shows nothing at all when there are no listings, so it never gets in the way.
export default function DirectoryListings({ kind, center, maxKm = 60, limit = 12 }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let active = true;
    db.entities.DirectoryListing.filter({ kind, is_active: true })
      .then((list) => { if (active) setRows(list); })
      .catch((e) => console.warn("Local directory is unavailable.", e));
    return () => { active = false; };
  }, [kind]);

  const lat = center?.[0];
  const lng = center?.[1];
  const ranked = rows
    .map((r) => ({
      ...r,
      distance: r.lat != null && r.lng != null && lat != null && lng != null
        ? distanceKm(lat, lng, r.lat, r.lng)
        : null,
    }))
    .filter((r) => r.distance == null || r.distance <= maxKm)
    .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))
    .slice(0, limit);

  if (ranked.length === 0) return null;

  const isDoctor = kind === "doctor";
  const accent = isDoctor ? "#2563eb" : "#ec4899";
  const tint = isDoctor ? "#dbeafe" : "#fce7f3";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800">
          Local {isDoctor ? "clinics and doctors" : "pharmacies"} near you
        </p>
        <p className="text-xs text-gray-500">
          Listed by the MediTrust team and not on MediTrust yet. Call first to check they are open.
        </p>
      </div>
      <div className="divide-y divide-gray-50">
        {ranked.map((r) => {
          const directionsUrl = getDirectionsUrl(r.lat, r.lng, lat, lng);
          return (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint }}>
                  {isDoctor
                    ? <Stethoscope className="w-5 h-5" style={{ color: accent }} />
                    : <PillIcon className="w-5 h-5" style={{ color: accent }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-800 text-sm truncate">{r.name}</p>
                    {r.distance != null && (
                      <span className="text-xs font-medium flex-shrink-0" style={{ color: accent }}>{r.distance.toFixed(1)} km</span>
                    )}
                  </div>
                  {isDoctor && r.speciality && <p className="text-xs text-blue-600 font-medium truncate">{r.speciality}</p>}
                  {(r.address || r.city) && (
                    <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" /> {[r.address, r.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] py-0 text-slate-500">Not on MediTrust yet</Badge>
                    {r.phone && (
                      <a href={`tel:${r.phone.replace(/[^+\d]/g, "")}`}>
                        <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs px-2">
                          <Phone className="w-3 h-3 mr-1" /> Call
                        </Button>
                      </a>
                    )}
                    {directionsUrl && (
                      <a href={directionsUrl} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs px-2">
                          <Navigation className="w-3 h-3 mr-1" /> Directions
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
