import React, { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/api/client";
import { Bell, Volume2, VolumeX, Stethoscope, Pill, UserPlus, MessageSquarePlus } from "lucide-react";

// Admin alert bar: checks every 20 seconds for new doctor/pharmacy sign-ups, new provider requests and new patients.
// A new arrival plays a chime (if sound is on), shows a highlighted line, and updates the browser tab title.
// Browsers only allow sound after you have clicked something on the page, so a click anywhere unlocks it.
const POLL_MS = 20000;
const SOUND_KEY = "meditrust_admin_sound";

const isPending = (p) => (p.verification_status || "pending") === "pending";

function playChime(ctx) {
  const now = ctx.currentTime;
  [880, 1175, 1568].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + i * 0.16;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.42);
  });
}

export default function AdminAlerts({ onGoProviders, onGoRequests }) {
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem(SOUND_KEY) === "1"; } catch { return false; }
  });
  const [audioReady, setAudioReady] = useState(false);
  const [pending, setPending] = useState({ doctors: 0, pharmacies: 0, requests: 0 });
  const [recent, setRecent] = useState([]);
  const ctxRef = useRef(null);
  const knownRef = useRef(null); // keys already seen; null until the first check (no chime for existing data)
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  const ensureAudio = useCallback(async () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      if (!ctxRef.current) ctxRef.current = new AudioCtx();
      if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
      const running = ctxRef.current.state === "running";
      setAudioReady(running);
      return running;
    } catch {
      return false;
    }
  }, []);

  // Any click on the page unlocks sound if it is switched on.
  useEffect(() => {
    const unlock = () => { if (soundOnRef.current) ensureAudio(); };
    document.addEventListener("pointerdown", unlock);
    return () => document.removeEventListener("pointerdown", unlock);
  }, [ensureAudio]);

  const check = useCallback(async () => {
    try {
      const safe = (promise) => promise.catch((e) => { console.warn("Admin alert source failed.", e); return []; });
      const [doctors, pharmacies, requests, profiles] = await Promise.all([
        safe(db.entities.DoctorProfile.list()),
        safe(db.entities.PharmacyProfile.list()),
        safe(db.entities.ProviderRequest.list()),
        safe(db.entities.UserProfile.list()),
      ]);

      const pendingDoctors = doctors.filter(isPending);
      const pendingPharmacies = pharmacies.filter(isPending);
      const pendingRequests = requests.filter((r) => r.status === "pending");
      setPending({ doctors: pendingDoctors.length, pharmacies: pendingPharmacies.length, requests: pendingRequests.length });

      const items = [
        ...pendingDoctors.map((d) => ({ key: `doctor:${d.id}`, icon: "doctor", text: `New doctor signed up: ${d.name || "Unnamed"}${d.city ? ` (${d.city})` : ""}`, go: "providers" })),
        ...pendingPharmacies.map((p) => ({ key: `pharmacy:${p.id}`, icon: "pharmacy", text: `New pharmacy signed up: ${p.name || "Unnamed"}${p.city ? ` (${p.city})` : ""}`, go: "providers" })),
        ...pendingRequests.map((r) => ({ key: `request:${r.id}`, icon: "request", text: `New ${r.request_type || "provider"} request: ${r.osm_name || r.name || "Unnamed"}`, go: "requests" })),
        ...profiles.filter((u) => u.user_type === "patient").map((u) => ({ key: `patient:${u.id}`, icon: "patient", text: `New patient joined${u.city ? ` from ${u.city}` : ""}`, go: null })),
      ];

      if (knownRef.current === null) {
        knownRef.current = new Set(items.map((i) => i.key));
        return;
      }
      const fresh = items.filter((i) => !knownRef.current.has(i.key));
      items.forEach((i) => knownRef.current.add(i.key));
      if (fresh.length > 0) {
        setRecent((prev) => [...fresh.map((f) => ({ ...f, at: Date.now() })), ...prev].slice(0, 5));
        if (soundOnRef.current && ctxRef.current && ctxRef.current.state === "running") playChime(ctxRef.current);
      }
    } catch (e) {
      console.warn("Admin alert check failed.", e);
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, POLL_MS);
    return () => clearInterval(timer);
  }, [check]);

  // Show the waiting count in the browser tab title.
  const waiting = pending.doctors + pending.pharmacies + pending.requests;
  useEffect(() => {
    const original = document.title;
    document.title = waiting > 0 ? `(${waiting}) ${original.replace(/^\(\d+\)\s*/, "")}` : original.replace(/^\(\d+\)\s*/, "");
    return () => { document.title = original.replace(/^\(\d+\)\s*/, ""); };
  }, [waiting]);

  const toggleSound = async () => {
    if (soundOn) {
      setSoundOn(false);
      try { localStorage.removeItem(SOUND_KEY); } catch { /* ignore */ }
      return;
    }
    setSoundOn(true);
    try { localStorage.setItem(SOUND_KEY, "1"); } catch { /* ignore */ }
    const ok = await ensureAudio();
    if (ok) playChime(ctxRef.current); // test chime so you know it works
  };

  const iconFor = (kind) => {
    if (kind === "doctor") return <Stethoscope className="w-4 h-4 text-blue-600" />;
    if (kind === "pharmacy") return <Pill className="w-4 h-4 text-pink-600" />;
    if (kind === "request") return <MessageSquarePlus className="w-4 h-4 text-amber-600" />;
    return <UserPlus className="w-4 h-4 text-emerald-600" />;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
      <div className={`rounded-2xl border p-3 ${waiting > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Bell className={`w-4 h-4 ${waiting > 0 ? "text-amber-600" : "text-gray-400"}`} />
            {waiting > 0 ? (
              <span className="text-gray-800">
                <strong>{waiting}</strong> waiting:
                {pending.doctors > 0 && <button onClick={onGoProviders} className="ml-2 underline text-blue-700">{pending.doctors} doctor{pending.doctors > 1 ? "s" : ""}</button>}
                {pending.pharmacies > 0 && <button onClick={onGoProviders} className="ml-2 underline text-pink-700">{pending.pharmacies} pharmac{pending.pharmacies > 1 ? "ies" : "y"}</button>}
                {pending.requests > 0 && <button onClick={onGoRequests} className="ml-2 underline text-amber-700">{pending.requests} request{pending.requests > 1 ? "s" : ""}</button>}
              </span>
            ) : (
              <span className="text-gray-500">Nothing waiting for you. New sign-ups appear here.</span>
            )}
          </div>
          <button
            onClick={toggleSound}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${soundOn ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-gray-600"}`}
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {soundOn ? (audioReady ? "Sound on" : "Sound on (click the page once)") : "Turn sound on"}
          </button>
        </div>

        {recent.length > 0 && (
          <div className="mt-2 space-y-1">
            {recent.map((r) => (
              <button
                key={`${r.key}-${r.at}`}
                onClick={() => (r.go === "providers" ? onGoProviders?.() : r.go === "requests" ? onGoRequests?.() : undefined)}
                className="w-full flex items-center gap-2 text-left text-xs bg-white border border-amber-100 rounded-lg px-2.5 py-1.5"
              >
                {iconFor(r.icon)}
                <span className="flex-1 text-gray-700">{r.text}</span>
                <span className="text-gray-400">just now</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
