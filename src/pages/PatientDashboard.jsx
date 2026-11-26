
import { db } from '@/api/client';

import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  MessageCircle, Stethoscope, UserSearch, Building2,
  Calendar, FileText, Play, LogOut, Bell, ChevronRight, Pill,
  MapPin, Activity
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import features from '@/config/features';
import featureFlags from '@/config/features';
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import BottomNav from '@/components/common/BottomNav';

// Lazy-loaded heavy components – only mount when user requests them
const Logo = lazy(() => import('@/components/common/Logo'));
const Disclaimer = lazy(() => import('@/components/common/Disclaimer'));
const DemoVideoModal = lazy(() => import('@/components/common/DemoVideoModal'));

// Static feature list – no heavy data, just config
const getFeatures = (t) => [
  { flag: 'aiAssistant',     icon: MessageCircle,  title: 'Ask MediTrust AI',    desc: 'Get guided health information',          gradient: 'from-blue-500 to-sky-500',      page: 'ChatAssistant' },
  { flag: 'symptomChecker',  icon: Stethoscope,    title: t('symptomChecker'),   desc: 'Understand your symptoms',               gradient: 'from-emerald-500 to-teal-500',   page: 'SymptomChecker' },
  { flag: 'medicineChecker', icon: Stethoscope,    title: 'Medicine Checker',    desc: 'Verify medicine authenticity & details', gradient: 'from-indigo-500 to-blue-500',    page: 'VerifyMedicine' },
  { icon: UserSearch,     title: t('findDoctors'),      desc: features.video || features.audioChat ? 'Book online & offline visits' : 'Book in-person clinic visits', gradient: 'from-orange-500 to-amber-500', page: 'FindDoctors' },
  { flag: 'pharmacy',        icon: Building2,      title: t('pharmacies'),       desc: 'Find nearby pharmacies and order medicines', gradient: 'from-pink-500 to-rose-500', page: 'Pharmacies' },
  { flag: 'healthTracker',   icon: Activity,       title: 'Health Records',       desc: 'View and download saved prescriptions',  gradient: 'from-teal-500 to-cyan-500',      page: 'HealthTracker' },
].filter((f) => !f.flag || features[f.flag]);

// Lightweight feature card – no framer motion stagger, no heavy deps
function FeatureBtn({ icon: Icon, title, desc, gradient, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all"
    >
      <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-sm flex-shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 text-left">
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
    </button>
  );
}

function DashboardContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showDemo, setShowDemo] = useState(false);
  const [user, setUser] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [location, setLocation] = useState(() => {
    // Read synchronously so the "Set Your Location" prompt does not flash while the account loads
    try { return JSON.parse(localStorage.getItem('meditrust_location') || 'null'); } catch (_) { return null; }
  });
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        if (!await db.auth.isOnboarded()) {
          navigate(createPageUrl('Onboarding'));
          return;
        }
        const me = await db.auth.me();
        if (!me) throw new Error('Could not verify the signed-in patient account.');
        if (active) setUser(me);
        const loc = localStorage.getItem('meditrust_location');
        if (loc && active) setLocation(JSON.parse(loc));
      } catch (error) {
        console.error('Failed to load patient profile.', error);
        if (active) setProfileError(error.message || 'Could not load your profile.');
      }
    };
    loadProfile();
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    db.auth.me().then((me) => {
      db.entities.Notification.filter({ user_email: me.email }, { sort: '-created_date', limit: 50 })
        .then((page) => {
          const rows = page;
          setUnreadCount(rows.filter((n) => !n.is_read).length);
        })
        .catch((e) => console.error(e));
    }).catch((e) => console.error(e));
  }, []);

  const features = getFeatures(t);
  const flagsOn = featureFlags; // module-level import, not shadowed by the local list above

  const handleLogout = async () => {
    try { await db.auth.logout(); } catch (e) { console.error(e); }
    localStorage.removeItem('meditrust_onboarding_data');
    navigate(createPageUrl('Welcome'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 pb-20 md:pb-0">
      {profileError && <p role="alert" className="bg-red-50 px-4 py-3 text-center text-sm text-red-700">{profileError}</p>}
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 header-safe pb-24 px-6 rounded-b-[2.5rem]">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link to={createPageUrl('Onboarding')} aria-label="Profile" className="flex items-center gap-3 text-left">
              <Avatar className="w-12 h-12 border-2 border-white/50">
                <AvatarFallback className="bg-white/20 text-white font-semibold">
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white/80 text-sm">{t('welcome')}</p>
                <p className="text-white font-semibold">{user?.full_name || user?.name || 'Welcome'}</p>
                {location && (
                  <p className="text-white/70 text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {location.city}, {location.state}
                  </p>
                )}
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(createPageUrl('Notifications'))}
                className="relative w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"
              >
                <Bell className="w-5 h-5 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"
              >
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <Suspense fallback={null}>
            <div className="text-center">
              <Logo size="small" showTagline={false} />
              <p className="text-white/90 text-sm mt-2">{t('tagline')}</p>
            </div>
          </Suspense>
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div className="px-6 -mt-12 max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-2 grid grid-cols-2 gap-2">
          {[
            { icon: Calendar, title: 'Appointments', page: 'PatientAppointments' },
            { icon: FileText, title: 'Prescriptions', page: 'PatientPrescriptions' },
            { flag: 'pharmacy', icon: Pill, title: 'My medicine orders', page: 'PatientReservations' },
            { icon: Activity, title: 'Edit profile', page: 'Onboarding' },
          ].filter((link) => !link.flag || flagsOn[link.flag]).map((link, idx, arr) => (
            <Link
              key={idx}
              to={createPageUrl(link.page)}
              className={`min-w-0 flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all ${arr.length % 2 === 1 && idx === arr.length - 1 ? 'col-span-2' : ''}`}
            >
              <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-blue-500 to-sky-500 rounded-xl flex items-center justify-center">
                <link.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-medium text-gray-700 leading-tight">{link.title}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="px-6 py-6 max-w-md mx-auto space-y-3">
        {/* Location prompt */}
        {!location && (
          <button
            onClick={() => navigate(createPageUrl('SetLocation'))}
            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 group hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-800">Set Your Location</p>
              <p className="text-sm text-gray-500">Find local doctors & pharmacies</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        {/* Demo video */}
        <button
          onClick={() => setShowDemo(true)}
          className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-sky-50 rounded-2xl border border-blue-100 group hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-sky-500 rounded-xl flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-gray-800">{t('watchDemo')}</p>
            <p className="text-sm text-gray-500">Learn how to use the app</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Feature Buttons */}
        {features.map((f, idx) => (
          <FeatureBtn
            key={idx}
            icon={f.icon}
            title={f.title}
            desc={f.desc}
            gradient={f.gradient}
            onClick={() => navigate(createPageUrl(f.page))}
          />
        ))}

        {/* Disclaimer */}
        <Suspense fallback={null}>
          <div className="mt-2"><Disclaimer /></div>
        </Suspense>
      </div>

      {/* Lazy modals */}
      <Suspense fallback={null}>
        {showDemo && <DemoVideoModal isOpen={showDemo} onClose={() => setShowDemo(false)} />}
      </Suspense>

      {/* ── Footer ── */}
      <footer className="px-6 py-6 max-w-md mx-auto border-t border-gray-100 mt-4">
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link to={createPageUrl('About')} className="text-gray-500 hover:text-blue-600">About</Link>
          <span className="text-gray-300">·</span>
          <Link to={createPageUrl('Contact')} className="text-gray-500 hover:text-blue-600">Contact</Link>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">© {new Date().getFullYear()} Medi Trust. Health Care You Can Trust.</p>
      </footer>
      <BottomNav />
    </div>
  );
}

export default function PatientDashboard() {
  return (
    <LanguageProvider>
      <DashboardContent />
    </LanguageProvider>
  );
}
