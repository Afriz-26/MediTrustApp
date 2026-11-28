import React, { useEffect, useState } from 'react';
import { Download, Share, X, PlusSquare } from 'lucide-react';

// Friendly "Install MediTrust" banner.
// - Android / Chrome: shows an Install button that opens the phone's own install dialog.
// - iPhone / iPad: Apple has no install pop-up, so we show the two taps needed (Share, then Add to Home Screen).
// - Hidden once the app is installed, and stays hidden for a few days after the user closes it.

const DISMISS_KEY = 'meditrust_install_dismissed_at';
const DISMISS_DAYS = 7;

const isStandalone = () =>
  (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' && navigator.standalone === true);

const isIos = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || iPadOs;
};

const recentlyDismissed = () => {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return t && Date.now() - t < DISMISS_DAYS * 86400000;
  } catch (_) { return false; }
};

export default function InstallPrompt() {
  const [mode, setMode] = useState(null); // null | 'android' | 'ios'

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return undefined;
    let timer;
    const showAndroid = () => { timer = setTimeout(() => setMode('android'), 2500); };

    if (window.__deferredInstall) showAndroid();
    window.addEventListener('meditrust-install-ready', showAndroid);
    const onInstalled = () => setMode(null);
    window.addEventListener('appinstalled', onInstalled);

    if (isIos()) timer = setTimeout(() => setMode('ios'), 2500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('meditrust-install-ready', showAndroid);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_) { /* ignore */ }
    setMode(null);
  };

  const install = async () => {
    const evt = window.__deferredInstall;
    if (!evt) return dismiss();
    evt.prompt();
    try { await evt.userChoice; } catch (_) { /* ignore */ }
    window.__deferredInstall = null;
    setMode(null);
  };

  if (!mode) return null;

  return (
    <div
      role="dialog"
      aria-label="Install MediTrust"
      className="fixed inset-x-0 z-[60] px-3"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <div className="mx-auto max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-3 flex items-start gap-3">
        <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">Install MediTrust</p>
          {mode === 'android' ? (
            <p className="text-xs text-slate-500 mt-0.5">Add it to your home screen to open it like a normal app. It's free.</p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Tap <Share className="inline w-3.5 h-3.5 -mt-0.5" /> <b>Share</b> in Safari, then{' '}
              <PlusSquare className="inline w-3.5 h-3.5 -mt-0.5" /> <b>Add to Home Screen</b>.
            </p>
          )}
          {mode === 'android' && (
            <button onClick={install} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">
              <Download className="w-3.5 h-3.5" /> Install app
            </button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Close" className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
