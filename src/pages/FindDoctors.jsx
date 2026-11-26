
import { db } from '@/api/client';

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Stethoscope, Search, ShieldCheck, Navigation, Loader2, Star, Building2, ExternalLink } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDoctorName } from "@/lib/utils";
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

// Map common search terms to DoctorProfile specialization enum values
const SPEC_SEARCH_MAP = {
  general: 'general_physician', physician: 'general_physician', gp: 'general_physician', medicine: 'general_physician',
  cardio: 'cardiologist', cardiologist: 'cardiologist', heart: 'cardiologist',
  derma: 'dermatologist', dermatologist: 'dermatologist', skin: 'dermatologist',
  neuro: 'neurologist', neurologist: 'neurologist', brain: 'neurologist', nerve: 'neurologist',
  ortho: 'orthopedic', orthopedic: 'orthopedic', orthopaedic: 'orthopedic', bone: 'orthopedic', joint: 'orthopedic',
  pediatric: 'pediatrician', pediatrician: 'pediatrician', child: 'pediatrician', kids: 'pediatrician',
  psych: 'psychiatrist', psychiatrist: 'psychiatrist', mental: 'psychiatrist',
  gyno: 'gynecologist', gynecologist: 'gynecologist', women: 'gynecologist',
  ophthal: 'ophthalmologist', ophthalmologist: 'ophthalmologist', eye: 'ophthalmologist',
  dental: 'dentist', dentist: 'dentist', teeth: 'dentist',
  ent: 'ent', ear: 'ent', nose: 'ent', throat: 'ent',
};

function findSpecialization(query) {
  const q = query.toLowerCase().trim();
  for (const [key, spec] of Object.entries(SPEC_SEARCH_MAP)) {
    if (q.includes(key)) return spec;
  }
  return null;
}

const SPEC_LABELS = {
  general_physician: 'General Physician', cardiologist: 'Cardiologist', dermatologist: 'Dermatologist',
  neurologist: 'Neurologist', orthopedic: 'Orthopedic', pediatrician: 'Pediatrician',
  psychiatrist: 'Psychiatrist', gynecologist: 'Gynecologist', ophthalmologist: 'Ophthalmologist',
  ent: 'ENT', dentist: 'Dentist',
};

function FindDoctorsContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [location, setLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [verifiedDoctors, setVerifiedDoctors] = useState([]);
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
      setRequestedProviderIds(await getRequestedProviderIds("doctor", me?.email));
      setRequestStatusError('');
    } catch (error) {
      console.error('Failed to load doctor request status.', error);
      setRequestStatusError(error.message || "Failed to load your provider requests.");
    }
  }, []);

  // Load saved location and user
  useEffect(() => {
    const saved = localStorage.getItem("meditrust_location");
    if (saved) setLocation(JSON.parse(saved));
    loadRequestStatus();
  }, [loadRequestStatus]);

  // Load verified doctors from the database
  const loadVerifiedDoctors = useCallback(async () => {
    setLoadingVerified(true);
    setVerifiedError("");
    try {
      const page = await db.entities.DoctorProfile.filter(
        { verification_status: 'approved', is_verified: true },
        { sort: '-rating', limit: 100 }
      );
      const doctors = page;
      // Compute distance from patient location if available
      const withDistance = doctors.map((d) => ({
        ...d,
        distance: (location && d.lat && d.lng) ? distanceKm(location.lat, location.lng, d.lat, d.lng) : null,
      }));
      // Sort by distance if available, otherwise by rating
      withDistance.sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        if (a.distance != null) return -1;
        if (b.distance != null) return 1;
        return (b.rating || 0) - (a.rating || 0);
      });
      setVerifiedDoctors(withDistance);
    } catch (e) {
      console.error('Failed to load verified doctors.', e);
      setVerifiedError("Failed to load verified doctors. Please refresh.");
    }
    setLoadingVerified(false);
  }, [location]);

  useEffect(() => {
    loadVerifiedDoctors();
  }, [loadVerifiedDoctors]);

  const handleLocationChange = (loc) => {
    const clean = {
      city: loc.city || loc.name, state: loc.state || "", country: loc.country || "",
      display: loc.display_name || loc.name, lat: loc.lat, lng: loc.lng,
    };
    setLocation(clean);
    localStorage.setItem("meditrust_location", JSON.stringify(clean));
  };

  // Filter verified doctors by search query
  const specFilter = findSpecialization(searchQuery);
  const filteredVerified = verifiedDoctors.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    // If search matches a specialization, filter by it
    if (specFilter && d.specialization !== specFilter) return false;
    // Also match by name, hospital, city
    const haystack = [d.name, d.hospital_name, d.city, d.state, SPEC_LABELS[d.specialization] || ''].join(' ').toLowerCase();
    return haystack.includes(q) || (specFilter && d.specialization === specFilter);
  });

  const handleProviderSelect = (provider) => {
    setRequestProvider(provider);
  };

  const handleBookVerified = (doctor) => {
    const params = new URLSearchParams({ doctorId: doctor.id });
    navigate(createPageUrl("BookAppointment") + "?" + params.toString());
  };

  const requestDoctor = (doctor) => setRequestProvider({
    osm_id: doctor.id,
    osm_name: doctor.name,
    osm_address: doctor.hospital_address,
    lat: doctor.lat,
    lng: doctor.lng,
    specialization: doctor.specialization,
    linkedEntityType: "DoctorProfile",
    linkedEntityId: doctor.id,
  });

  const markRequested = (provider) => {
    setRequestedProviderIds((current) => new Set([
      ...current,
      provider.osm_id,
      provider.linkedEntityId,
      provider.externalId,
    ].filter(Boolean).map(String)));
  };

  if (!location) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50">
        <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 pt-12 pb-6 px-4 rounded-b-3xl">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-white" /></Link>
              <h1 className="text-xl font-bold text-white">{t('findDoctors')}</h1>
            </div>
          </div>
        </div>
        <div className="px-4 py-8 max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <MapPin className="w-12 h-12 text-blue-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-800 mb-2">Set your location first</h3>
            <p className="text-sm text-gray-500 mb-4">Search your area to find doctors near you.</p>
            <div className="mb-4"><LocationSearch onSelect={handleLocationChange} autoFocus /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 pb-20">
      <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 pt-12 pb-6 px-4 rounded-b-3xl">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-white" /></Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white flex items-center gap-2"><Stethoscope className="w-5 h-5" /> {t('findDoctors')}</h1>
              <p className="text-white/80 text-sm flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {location?.city || 'Location not set'}{location?.state ? `, ${location.state}` : ''}</p>
            </div>
          </div>
          {/* Search bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctors, specialties… (e.g. cardiologist, orthopedic, dentist)"
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
        {/* ── Verified MediTrust Doctors ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-gray-800">Verified MediTrust Doctors</h2>
            <Badge className="bg-emerald-100 text-emerald-700 text-xs">{filteredVerified.length}</Badge>
          </div>

          {loadingVerified ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
          ) : verifiedError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-sm text-red-600">{verifiedError}</p>
              <Button size="sm" variant="outline" className="mt-2 rounded-xl" onClick={loadVerifiedDoctors}>Retry</Button>
            </div>
          ) : filteredVerified.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{searchQuery.trim() ? `No verified doctors match "${searchQuery}"` : 'No verified doctors available yet'}</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search, or ask us to add your doctor below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVerified.map((doc, idx) => {
                const directionsUrl = getDirectionsUrl(doc.lat, doc.lng, location.lat, location.lng);
                return (
                  <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-gray-800">{formatDoctorName(doc.name)}</h3>
                            <p className="text-sm text-blue-600 font-medium">{SPEC_LABELS[doc.specialization] || doc.specialization}</p>
                          </div>
                          {doc.distance != null && <span className="text-xs text-blue-600 font-medium flex-shrink-0">{doc.distance.toFixed(1)} km</span>}
                        </div>
                        {doc.hospital_name && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" /> {doc.hospital_name}</p>}
                        {doc.hospital_address && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {doc.hospital_address}</p>}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px]"><ShieldCheck className="w-3 h-3 mr-1" /> Verified</Badge>
                          {doc.rating != null && <span className="text-xs text-amber-500 flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {doc.rating}</span>}
                          {doc.experience_years != null && <span className="text-xs text-gray-400">{doc.experience_years} yrs exp</span>}
                          {doc.consultation_fees?.offline != null && <span className="text-xs text-gray-500">₹{doc.consultation_fees.offline} visit</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                      {isBookable(doc, "doctor") ? (
                        <Button onClick={() => handleBookVerified(doc)} size="sm" className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                          <Stethoscope className="w-4 h-4 mr-1" /> Book appointment
                        </Button>
                      ) : (
                        <Button onClick={() => requestDoctor(doc)} size="sm" variant="outline" className="flex-1 rounded-xl" disabled={hasRequestedProvider(requestedProviderIds, doc)}>
                          {hasRequestedProvider(requestedProviderIds, doc) ? "Requested" : "Request"}
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
            <ExternalLink className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-gray-800">Not on MediTrust yet?</h2>
            <p className="text-xs text-gray-400">Ask us to bring your doctor onboard</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
            <p className="text-xs text-blue-700">
              Know a good doctor or clinic that is not listed above? Tell us and we will invite them to join MediTrust. Doctors you see above can be booked right away.
            </p>
          </div>
          <ProviderMap
            center={[location.lat, location.lng]}
            type="doctors"
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
        type="doctor"
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

export default function FindDoctors() {
  return (
    <LanguageProvider>
      <FindDoctorsContent />
    </LanguageProvider>
  );
}