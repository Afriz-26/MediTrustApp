import React, { useEffect, useState } from "react";
import { db } from "@/api/client";
import { searchLocations } from "@/lib/osm";
import { Loader2, Trash2, Plus, Search, Eye, EyeOff, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Admin-only: add local pharmacies / clinics that are not on MediTrust yet.
// Patients see them in "Local ... near you" under the map, with Call and Directions buttons.
const EMPTY = { kind: "pharmacy", name: "", phone: "", address: "", city: "", state: "", speciality: "", pin: "" };

// Accepts "13.6288, 79.4192" (what Google Maps gives when you right-click a place and tap the coordinates).
function parsePin(text) {
  const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text || "");
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export default function DirectoryManager() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [townQuery, setTownQuery] = useState("");
  const [townResults, setTownResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    try {
      const list = await db.entities.DirectoryListing.list({ sort: "-created_date" });
      setRows(list);
    } catch (e) {
      setMessage(`Could not load the directory: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const searchTown = async () => {
    setSearching(true);
    setMessage("");
    try {
      setTownResults((await searchLocations(townQuery)).slice(0, 5));
    } catch (e) {
      setMessage(e.message);
    } finally {
      setSearching(false);
    }
  };

  const pickTown = (t) => {
    setForm((f) => ({
      ...f,
      city: t.city || t.name || f.city,
      state: t.state || f.state,
      pin: f.pin || `${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`,
    }));
    setTownResults([]);
    setTownQuery("");
  };

  const save = async () => {
    setMessage("");
    const name = form.name.trim();
    if (name.length < 2) { setMessage("Please enter the name."); return; }
    const pin = form.pin.trim() ? parsePin(form.pin) : null;
    if (form.pin.trim() && !pin) { setMessage("The pin must look like: 13.6288, 79.4192"); return; }
    if (!pin && !form.city.trim()) { setMessage("Add a pin (best) or at least the town."); return; }
    setSaving(true);
    try {
      await db.entities.DirectoryListing.create({
        kind: form.kind, name, phone: form.phone.trim(), address: form.address.trim(),
        city: form.city.trim(), state: form.state.trim(),
        speciality: form.kind === "doctor" ? form.speciality.trim() : "",
        lat: pin ? pin.lat : null, lng: pin ? pin.lng : null, is_active: true,
      });
      setForm((f) => ({ ...EMPTY, kind: f.kind, city: f.city, state: f.state }));
      setMessage(pin ? "Added." : "Added without a pin: it will show without distance or Directions.");
      await load();
    } catch (e) {
      setMessage(`Could not save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row) => {
    try {
      await db.entities.DirectoryListing.update(row.id, { is_active: !row.is_active });
      await load();
    } catch (e) {
      setMessage(`Could not update: ${e.message}`);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.name}" from the directory?`)) return;
    try {
      await db.entities.DirectoryListing.delete(row.id);
      await load();
    } catch (e) {
      setMessage(`Could not delete: ${e.message}`);
    }
  };

  const input = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        <h3 className="font-semibold text-gray-800">Add a local pharmacy or clinic</h3>
        <p className="text-xs text-gray-500">
          Only add real places you have checked. Patients see these with a Call button and Directions. They are shown as "Not on MediTrust yet".
        </p>

        <div className="flex gap-2">
          {["pharmacy", "doctor"].map((k) => (
            <button
              key={k}
              onClick={() => set("kind", k)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border ${form.kind === k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}
            >
              {k === "pharmacy" ? "Pharmacy" : "Doctor / Clinic"}
            </button>
          ))}
        </div>

        <input className={input} placeholder="Name (e.g. Sri Sai Medicals)" value={form.name} onChange={(e) => set("name", e.target.value)} />
        <input className={input} placeholder="Phone (optional, e.g. 98xxxxxxxx)" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <input className={input} placeholder="Street / area (optional)" value={form.address} onChange={(e) => set("address", e.target.value)} />
        {form.kind === "doctor" && (
          <input className={input} placeholder="Speciality (optional, e.g. General Physician)" value={form.speciality} onChange={(e) => set("speciality", e.target.value)} />
        )}

        <div className="grid grid-cols-2 gap-2">
          <input className={input} placeholder="Town / city" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <input className={input} placeholder="State" value={form.state} onChange={(e) => set("state", e.target.value)} />
        </div>

        <div className="rounded-xl bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-600">Location</p>
          <input
            className={input}
            placeholder="Pin: 13.6288, 79.4192  (Google Maps: right-click the shop, tap the numbers to copy)"
            value={form.pin}
            onChange={(e) => set("pin", e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className={input}
              placeholder="No pin? Search the town to fill town, state and a rough location"
              value={townQuery}
              onChange={(e) => setTownQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") searchTown(); }}
            />
            <button onClick={searchTown} disabled={searching || townQuery.trim().length < 3} className="px-3 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-50">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          {townResults.map((t, i) => (
            <button key={i} onClick={() => pickTown(t)} className="block w-full text-left text-xs text-blue-700 hover:underline truncate">
              {t.display_name}
            </button>
          ))}
          <p className="text-[11px] text-gray-400">A town search gives only a rough centre. Use a real pin so Directions lead to the shop.</p>
        </div>

        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add to directory
        </button>
        {message && <p className="text-sm text-gray-600" role="status">{message}</p>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Directory ({rows.length})</h3>
        </div>
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Nothing listed yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800 text-sm truncate">{r.name}</p>
                    <Badge className="bg-slate-100 text-slate-600 text-[10px] capitalize">{r.kind}</Badge>
                    {!r.is_active && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Hidden</Badge>}
                    {r.lat == null && <Badge className="bg-red-50 text-red-600 text-[10px]">No pin</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {[r.address, r.city, r.state].filter(Boolean).join(", ") || "No address"}{r.phone ? ` · ${r.phone}` : ""}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => toggle(r)} title={r.is_active ? "Hide from patients" : "Show to patients"} className="p-2 rounded-lg text-gray-500 hover:bg-gray-50">
                    {r.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => remove(r)} title="Delete" className="p-2 rounded-lg text-red-500 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
