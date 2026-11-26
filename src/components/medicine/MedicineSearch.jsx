import React, { useState, useRef, useEffect } from "react";
import { Search, Pill } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { loadMedicines } from "@/lib/medicines";
import { searchMedicineInfo } from "@/lib/medicineDataset";

// Google-style autocomplete powered by the Medicine entity (with MRP range + image).
export default function MedicineSearch({ onSelect, placeholder = "Search medicine or symptom (e.g. fever, acidity, cough)…" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const boxRef = useRef(null);

  useEffect(() => {
    loadMedicines().then(setMedicines).catch(() => setMedicines([]));
  }, []);

  const results = query.trim() ? searchMedicineInfo(query, medicines).slice(0, 8) : [];

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const highlight = (text) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-12 h-12 rounded-xl bg-white border-0 shadow-lg"
        />
      </div>

      {open && query.trim() && (
        <div className="absolute z-20 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 max-h-80 overflow-y-auto">
          {results.length > 0 ? (
            results.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onSelect && onSelect(m);
                  setQuery(m.name);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-pink-50 border-b border-gray-50 flex items-center gap-3"
              >
                {m.image_url ? (
                  <img src={m.image_url} alt={m.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                    <Pill className="w-4 h-4 text-pink-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-800 text-sm">{highlight(m.name)}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {m.generic} {m.manufacturer && `· ${m.manufacturer}`}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    
                    {m.rx && <Badge className="text-[9px] py-0 bg-red-100 text-red-700">Rx</Badge>}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-6 text-center">
              <Pill className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No medicines match "{query}"</p>
              <p className="text-xs text-gray-400 mt-1">Try a symptom like "fever" or "acidity"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}