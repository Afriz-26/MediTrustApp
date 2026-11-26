import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, Loader2, Navigation } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchLocations, reverseGeocode } from "@/lib/osm";

// Debounced Nominatim auto-suggest constrained to India.
export default function LocationSearch({ onSelect, onUseCurrent, placeholder = "Search area, city, or pincode...", autoFocus }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    timer.current = setTimeout(async () => {
      try {
        const r = await searchLocations(query);
        setResults(r);
      } catch (e) {
        console.error("Failed to search locations.", e);
        setResults([]);
        setError("Location search is unavailable right now. Please try again.");
      } finally {
        setLoading(false);
      }
      setOpen(true);
    }, 450);
    return () => timer.current && clearTimeout(timer.current);
  }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (loc) => {
    setQuery(loc.name);
    setOpen(false);
    onSelect && onSelect(loc);
  };

  const handleCurrent = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (loc) {
            setQuery(loc.name);
            onSelect && onSelect(loc);
          }
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false)
    );
  };

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          className="pl-12 pr-12 h-12 rounded-xl bg-white border-0 shadow-lg"
        />
        <button
          onClick={handleCurrent}
          title="Use current location"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-100"
        >
          {locating ? (
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          ) : (
            <Navigation className="w-5 h-5 text-blue-500" />
          )}
        </button>
      </div>

      {open && (loading || results.length > 0 || error || query.trim().length >= 3) && (
        <div className="absolute z-20 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 max-h-72 overflow-y-auto">
          {loading && (
            <div className="p-3 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          )}
          {error && <p role="alert" className="p-3 text-sm text-red-600">{error}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="p-3 text-sm text-gray-500">No matching locations found.</p>
          )}
          {results.map((loc, i) => (
            <button
              key={i}
              onClick={() => handleSelect(loc)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 flex items-start gap-3"
            >
              <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{loc.name}</p>
                <p className="text-xs text-gray-500 truncate">{loc.display_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}