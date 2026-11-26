import React, { useState, useEffect } from "react";
import { Send, Loader2, ShieldCheck, Stethoscope, Pill } from "lucide-react";
import { db } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createProviderRequest } from "@/lib/providerRequests";

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Lets a patient ask for a doctor / clinic / pharmacy that is not on MediTrust yet.
// This is the fallback when a provider is missing from OpenStreetMap or its search is unavailable.
export default function ManualRequestCard({ type = "doctor" }) {
  const isDoctor = type === "doctor";
  const [me, setMe] = useState(null);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const location = (() => {
    try { return JSON.parse(localStorage.getItem("meditrust_location") || "null"); } catch (_) { return null; }
  })();

  useEffect(() => {
    db.auth.me().then(setMe).catch(() => setMe(null));
  }, []);

  const submit = async () => {
    setError("");
    if (!name.trim()) { setError(isDoctor ? "Enter the doctor or clinic name." : "Enter the pharmacy name."); return; }
    if (!me?.email) { setError("Please sign in to send a request."); return; }
    setBusy(true);
    try {
      const city = location?.city || "";
      await createProviderRequest({
        type,
        osmId: `manual:${slug(name)}:${slug(area || city)}`,
        name: name.trim(),
        address: area.trim() || city,
        phone: phone.trim(),
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        tags: isDoctor && speciality.trim() ? { specialization: speciality.trim() } : {},
        requesterEmail: me.email,
        requesterName: me.full_name || me.email,
        reason: reason.trim(),
        state: location?.state || "",
        city,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || "Could not send the request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 text-center">
        <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
        <p className="font-semibold text-gray-800">Request sent</p>
        <p className="text-sm text-gray-500 mt-1">Our team can review the details and contact them about joining MediTrust.</p>
        <Button variant="outline" className="mt-3 rounded-xl" onClick={() => { setDone(false); setName(""); setArea(""); setPhone(""); setSpeciality(""); setReason(""); }}>
          Request another
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {isDoctor ? <Stethoscope className="w-5 h-5 text-blue-600" /> : <Pill className="w-5 h-5 text-pink-600" />}
        <h3 className="font-semibold text-gray-800">{isDoctor ? "Can't find your doctor?" : "Can't find your pharmacy?"}</h3>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        Tell us who you would like to see on MediTrust. Our team can review the request and contact them.
      </p>
      <div className="space-y-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isDoctor ? "Doctor or clinic name" : "Pharmacy name"} className="h-11 rounded-xl" maxLength={120} />
        <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder={`Town / area${location?.city ? ` (default: ${location.city})` : ""}`} className="h-11 rounded-xl" maxLength={160} />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Their phone number (optional)" inputMode="tel" className="h-11 rounded-xl" maxLength={20} />
        {isDoctor && (
          <Input value={speciality} onChange={(e) => setSpeciality(e.target.value)} placeholder="Speciality, e.g. cardiologist (optional)" className="h-11 rounded-xl" maxLength={60} />
        )}
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why would you like them on MediTrust? (optional)" className="rounded-xl min-h-[70px]" maxLength={300} />
      </div>
      {error && <p className="text-sm text-red-600 mt-2" role="alert">{error}</p>}
      <Button onClick={submit} disabled={busy} className="w-full h-11 mt-3 rounded-xl bg-gradient-to-r from-blue-500 to-sky-500">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Send request</>}
      </Button>
      <p className="text-[11px] text-gray-400 mt-2">
        We share only how many people asked for a provider, not your name or contact details.
      </p>
    </div>
  );
}
