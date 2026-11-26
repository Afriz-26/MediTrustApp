
import { db } from '@/api/client';

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Pill, Search, ShieldCheck, Navigation, Loader2, Star, ExternalLink, Phone } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage, LanguageProvider } from "@/components/ui/LanguageContext";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import LocationSearch from "@/components/location/LocationSearch";
import ProviderMap from "@/components/map/ProviderMap";
import RequestModal from "@/components/provider/RequestModal";
import { getDirectionsUrl } from "@/lib/maps";
import { distanceKm } from "@/lib/osm";
import { getRequestedProviderIds, hasRequestedProvider, isBookable } from "@/lib/providers";

function PharmaciesContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [verifiedPharmacies, setVerifiedPharmacies] = useState([]);
  const [loadingVerified, setLoadingVerified] = useState(true);
  const [verifiedError, setVerifiedError] = useState("");
  const [requestProvider, setRequestProvider] = useState(null);
  const [requester, setRequester] = useState({});
  const [requestedProviderIds, setRequestedProviderIds] = useState(new Set());
  const [requestStatusError, setRequestStatusError] = useState("");

  const loadRequestStatus = useCallback(async () => {
    try {
      const me = await db.auth.me();
      setRequester({ email: me?.email, name: me?.full_name });
      setRequestedProviderIds(await getRequestedProviderIds("pharmacy", me?.email));
      setRequestStatusError('');
    } catch (error) {
      console.error('Failed to load pharmacy request status.', error);
      setRequestStatusError(error.message || "Failed to load your provider requests.");
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("meditrust_location");
      if (saved) setLocation(JSON.parse(saved));
    } catch (error) {
      console.error("Saved pharmacy search location could not be read.", error);
      setLocation(null);
    } finally {
      setLocationLoaded(true);
    }
    loadRequestStatus();
  }, [loadRequestStatus]);

  const loadVerifiedPharmacies = useCallback(async () => {
    setLoadingVerified(true);
    setVerifiedError("");
    try {
      const page = await db.entities.PharmacyProfile.filter(
        { verification_status: 'approved', is_verified: true },
        { sort: '-rating', limit: 100 }
      );
      const pharmacies = page;
      const withDistance = pharmacies.map((p) => ({
        ...p,
        distance: (location && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
          ? distanceKm(location.lat, location.lng, Number(p.lat), Number(p.lng))
          : null,
      }));
      withDistance.sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        if (a.distance != null) return -1;
        if (b.distance != null) return 1;
        return (b.rating || 0) - (a.rating || 0);
      });
      setVerifiedPharmacies(withDistance);
    } catch (e) {
      console.error('Failed to load verified pharmacies.', e);
      setVerifiedError("Failed to load verified pharmacies. Please refresh.");
    }
    setLoadingVerified(false);
  }, [location]);

  useEffect(() => {
    loadVerifiedPharmacies();
  }, [loadVerifiedPharmacies]);

  const handleLocationChange = (loc) => {
    const clean = {
      city: loc.city || loc.name, state: loc.state || "", country: loc.country || "",
      display: loc.display_name || loc.name, lat: loc.lat, lng: loc.lng,
    };
    setLocation(clean);
    setSearchQuery(""); // an old search word must not hide the new area's pharmacies
    setLocationLoaded(true);
    localStorage.setItem("meditrust_location", JSON.stringify(clean));
  };

  const filteredVerified = verifiedPharmacies.filter((p) => {
    // No distance cut-off: with only a few providers, hiding far or unlocated ones makes the list look empty.
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const haystack = [p.name, p.owner_name, p.city, p.state, p.address].join(' ').toLowerCase();
    return haystack.includes(q);
  });

  const handleProviderSelect = (provider) => {
    setRequestProvider(provider);
  };

  const handleOrderVerified = (pharmacy) => {
    const params = new URLSearchParams({ pharmacyId: pharmacy.id });
    navigate(createPageUrl("OrderMedicines") + "?" + params.toString());
  };

  const requestPharmacy = (pharmacy) => setRequestProvider({
    osm_id: pharmacy.id,
    osm_name: pharmacy.name,
    osm_address: pharmacy.address,
    lat: pharmacy.lat,
    lng: pharmacy.lng,
    linkedEntityType: "PharmacyProfile",
    linkedEntityId: pharmacy.id,
  });

  const markRequested = (provider) => {
    setRequestedProviderIds((current) => new Set([
      ...current,
      provider.osm_id,
      provider.linkedEntityId,
      provider.externalId,
    ].filter(Boolean).map(String)));
  };

  const locationLat = Number(location?.lat);
  const locationLng = Number(location?.lng);
  const hasCoordinates = location
    && location.lat !== ''
    && location.lng !== ''
    && Number.isFinite(locationLat)
    && Number.isFinite(locationLng)
    && locationLat >= -90 && locationLat <= 90
    && locationLng >= -180 && locationLng <= 180;

  if (!locationLoaded) {
    return <div role="status" aria-label="Loading location" className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
    </div>;
  }

  if (!hasCoordinates) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-pink-50">
        <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 pt-12 pb-6 px-4 rounded-b-3xl">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-white" /></Link>
              <h1 className="text-xl font-bold text-white">{t('pharmacies')}</h1>
            </div>
          </div>
        </div>
        <div className="px-4 py-8 max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <MapPin className="w-12 h-12 text-pink-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-800 mb-2">Location not set</h3>
            <p className="text-sm text-gray-500 mb-4">Set your location to find pharmacies near you.</p>
            <Button type="button" variant="outline" className="mb-4 rounded-xl" onClick={() => navigate(createPageUrl('SetLocation'))}>
              Set location
            </Button>
            <div className="mb-4"><LocationSearch onSelect={handleLocationChange} autoFocus /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-pink-50 pb-20">
      <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 pt-12 pb-6 px-4 rounded-b-3xl">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-white" /></Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white flex items-center gap-2"><Pill className="w-5 h-5" /> {t('pharmacies')}</h1>
              <p className="text-white/80 text-sm flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {location.city}{location.state ? `, ${location.state}` : ''}</p>
            </div>
          </div>
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pharmacies by name or area…"
              className="pl-12 h-12 rounded-xl bg-white border-0 shadow-lg"
            />
          </div>
          <div className="mt-2 max-w-md"><LocationSearch onSelect={handleLocationChange} placeholder="Change location…" /></div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-5xl mx-auto space-y-6">
        {requestStatusError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {requestStatusError}
            <Button size="sm" variant="outline" className="ml-3 rounded-xl" onClick={loadRequestStatus}>Retry</Button>
          </div>
        )}
        {/* ── Verified MediTrust Pharmacies ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-gray-800">Verified MediTrust Pharmacies</h2>
            <Badge className="bg-emerald-100 text-emerald-700 text-xs">{filteredVerified.length}</Badge>
          </div>

          {loadingVerified ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-pink-500 animate-spin" /></div>
          ) : verifiedError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-sm text-red-600">{verifiedError}</p>
              <Button size="sm" variant="outline" className="mt-2 rounded-xl" onClick={loadVerifiedPharmacies}>Retry</Button>
            </div>
          ) : filteredVerified.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <Pill className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{searchQuery.trim() ? `No verified pharmacies match "${searchQuery}"` : 'No verified pharmacies available yet'}</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search, or ask us to add your pharmacy below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVerified.map((pharm, idx) => {
                const directionsUrl = getDirectionsUrl(pharm.lat, pharm.lng, locationLat, locationLng);
                return (
                  <motion.div key={pharm.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Pill className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-gray-800">{pharm.name}</h3>
                            {pharm.owner_name && <p className="text-xs text-gray-500 mt-0.5">Owner: {pharm.owner_name}</p>}
                          </div>
                          {pharm.distance != null
                            ? <span className="text-xs text-pink-600 font-medium flex-shrink-0">{pharm.distance.toFixed(1)} km</span>
                            : <span className="text-xs text-gray-400 flex-shrink-0">Distance unknown</span>}
                        </div>
                        {pharm.address && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {pharm.address}</p>}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px]"><ShieldCheck className="w-3 h-3 mr-1" /> Verified</Badge>
                          {pharm.rating != null && <span className="text-xs text-amber-500 flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {pharm.rating}</span>}
                          {pharm.phone && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Phone className="w-3 h-3" /> {pharm.phone}</span>}
                          <Badge className="bg-pink-100 text-pink-700 text-[10px]">Pickup Only</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                      {isBookable(pharm, "pharmacy") ? (
                        <Button onClick={() => handleOrderVerified(pharm)} size="sm" className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                          <Pill className="w-4 h-4 mr-1" /> Order medicines
                        </Button>
                      ) : (
                        <Button onClick={() => requestPharmacy(pharm)} size="sm" variant="outline" className="flex-1 rounded-xl" disabled={hasRequestedProvider(requestedProviderIds, pharm)}>
                          {hasRequestedProvider(requestedProviderIds, pharm) ? "Requested" : "Request"}
                        </Button>
                      )}
                      {directionsUrl && (
                        <a href={directionsUrl} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="rounded-xl">
                            <Navigation className="w-4 h-4 mr-1" /> Directions
                          </Button>
                        </a>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── External OSM Providers ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="w-5 h-5 text-pink-500" />
            <h2 className="font-semibold text-gray-800">Not on MediTrust yet?</h2>
            <p className="text-xs text-gray-400">Ask us to bring your pharmacy onboard</p>
          </div>
          <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-3">
            <p className="text-xs text-pink-700">
              Know a good pharmacy that is not listed above? Tell us and we will invite them to join MediTrust. Pharmacies you see above can take your reservation right away.
            </p>
          </div>
          <ProviderMap
            center={[locationLat, locationLng]}
            type="pharmacy"
            radius={12000}
            onProviderSelect={handleProviderSelect}
            requestedProviderIds={requestedProviderIds}
            compact
            searchQuery={searchQuery}
          />
        </div>
      </div>

      <RequestModal
        open={!!requestProvider}
        provider={requestProvider}
        type="pharmacy"
        requester={requester}
        location={location}
        linkedEntityType={requestProvider?.linkedEntityType || "none"}
        linkedEntityId={requestProvider?.linkedEntityId || ""}
        onSubmitted={() => markRequested(requestProvider)}
        onClose={() => setRequestProvider(null)}
      />
    </div>
  );
}

export default function Pharmacies() {
  return (
    <LanguageProvider>
      <PharmaciesContent />
    </LanguageProvider>
  );
}