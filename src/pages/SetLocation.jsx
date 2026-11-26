
import { db } from '@/api/client';

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import LocationSearch from "@/components/location/LocationSearch";
import { useLanguage, LanguageProvider } from "@/components/ui/LanguageContext";

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center[0], center[1]]);
  return null;
}

function SetLocationContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("meditrust_location");
    if (saved) setLocation(JSON.parse(saved));
  }, []);

  const handleSelect = (loc) => {
    const clean = {
      city: loc.city || loc.name,
      state: loc.state || "",
      country: loc.country || "India",
      display: loc.display_name || loc.name,
      lat: loc.lat,
      lng: loc.lng,
    };
    setLocation(clean);
    localStorage.setItem("meditrust_location", JSON.stringify(clean));
    // persist to user profile if available
    db.auth.me().then((me) => {
      if (me.email) {
        db.entities.UserProfile.filter({ email: me.email }, { limit: 1 })
          .then((page) => {
            if (page.length) {
              db.entities.UserProfile.update(page[0].id, {
                location_display: clean.display,
                city: clean.city,
                state: clean.state,
                location_lat: clean.lat,
                location_lng: clean.lng,
              });
            }
          })
          .catch((e) => console.error(e));
      }
    }).catch((e) => console.error(e));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      <div className="bg-background dark:bg-zinc-900 border-b border-border px-4 py-4 sticky top-0 z-10 pt-safe">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-muted-foreground" />
          </Link>
          <h1 className="font-semibold text-foreground">Set Your Location</h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <LocationSearch onSelect={handleSelect} autoFocus />
        </motion.div>

        {location && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm mb-4">
              <div className="h-56">
                <MapContainer center={[location.lat, location.lng]} zoom={13} className="h-full w-full" style={{ zIndex: 0 }}>
                  <Recenter center={[location.lat, location.lng]} />
                  <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <CircleMarker center={[location.lat, location.lng]} radius={9} pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.9 }} />
                </MapContainer>
              </div>
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-800">{location.city}{location.state ? `, ${location.state}` : ''}</p>
                    <p className="text-xs text-gray-500">{location.display}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-700">Location saved. We'll show nearby doctors and pharmacies.</p>
            </div>

            <Button
              onClick={() => navigate(createPageUrl('PatientDashboard'))}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-sky-500 rounded-xl font-medium"
            >
              Continue to Dashboard
            </Button>
          </motion.div>
        )}

        {!location && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm text-blue-700">
              💡 Search for your area, city, or pincode to find real-time doctors and pharmacies near you across India.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function SetLocation() {
  return (
    <LanguageProvider>
      <SetLocationContent />
    </LanguageProvider>
  );
}