import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, Volume2, VolumeX } from "lucide-react";
import { db } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";

// Plays a chime and shows a banner when a NEW notification arrives, on every dashboard (patient, doctor, pharmacy, admin).
// Works while the app is open (including as an installed PWA). Notifications are written by the database, so the text
// always matches what is stored. Checking every 20 seconds keeps the load small on the free plan.
// Closed-app push notifications need a separate push service and are not part of this component.
const POLL_MS = 20000;
const MUTE_KEY = "meditrust_sound_muted";

function playChime(ctx) {
  const now = ctx.currentTime;
  [988, 1319].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + i * 0.15;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

export default function NotificationListener() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [banner, setBanner] = useState(null);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
  });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const ctxRef = useRef(null);
  const seenRef = useRef(null); // ids already seen; null until the first check, so old notifications stay silent
  const hideTimer = useRef(null);

  // Browsers only allow sound after a tap/click. Any tap in the app unlocks it.
  useEffect(() => {
    const unlock = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!ctxRef.current) ctxRef.current = new AudioCtx();
        if (ctxRef.current.state === "suspended") ctxRef.current.resume();
      } catch { /* sound is optional */ }
    };
    document.addEventListener("pointerdown", unlock);
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  const check = useCallback(async () => {
    try {
      const me = await db.auth.me();
      if (!me?.email) return;
      const rows = await db.entities.Notification.filter({ user_email: me.email }, { sort: "-created_date", limit: 20 });
      if (seenRef.current === null) {
        seenRef.current = new Set(rows.map((n) => n.id));
        return;
      }
      const fresh = rows.filter((n) => !seenRef.current.has(n.id) && !n.is_read);
      rows.forEach((n) => seenRef.current.add(n.id));
      if (fresh.length === 0) return;

      const latest = fresh[0];
      setBanner({ id: latest.id, title: latest.title, message: latest.message, link: latest.link, more: fresh.length - 1 });
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setBanner(null), 9000);

      if (!mutedRef.current) {
        if (ctxRef.current && ctxRef.current.state === "running") playChime(ctxRef.current);
        try { navigator.vibrate?.([120, 60, 120]); } catch { /* not supported */ }
      }
    } catch (e) {
      console.warn("Notification check failed.", e);
    }
  }, []);

  // Start when signed in; reset when signed out so the next account starts clean.
  useEffect(() => {
    if (!isAuthenticated) {
      seenRef.current = null;
      setBanner(null);
      return undefined;
    }
    check();
    const timer = setInterval(check, POLL_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated, check]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try { next ? localStorage.setItem(MUTE_KEY, "1") : localStorage.removeItem(MUTE_KEY); } catch { /* ignore */ }
  };

  const open = () => {
    const link = banner?.link;
    setBanner(null);
    navigate(link && link.startsWith("/") ? link : "/Notifications");
  };

  if (!isAuthenticated || !banner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center px-3 pt-3 pointer-events-none" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
      <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden">
        <div className="flex items-start gap-3 p-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <button onClick={open} className="flex-1 min-w-0 text-left">
            <p className="font-semibold text-gray-900 text-sm">{banner.title}</p>
            <p className="text-sm text-gray-600 leading-snug">{banner.message}</p>
            {banner.more > 0 && <p className="text-xs text-emerald-700 mt-1">+{banner.more} more. Tap to see all.</p>}
          </button>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button onClick={() => setBanner(null)} aria-label="Dismiss" className="p-1 rounded-lg text-gray-400 hover:bg-gray-50">
              <X className="w-4 h-4" />
            </button>
            <button onClick={toggleMute} aria-label={muted ? "Turn sound on" : "Mute sound"} className="p-1 rounded-lg text-gray-400 hover:bg-gray-50">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
