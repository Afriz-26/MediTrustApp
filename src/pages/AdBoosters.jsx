
import { BOOSTER_PRICES } from '@/config/pricing';
import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Zap, TrendingUp, Star, Megaphone,
  CheckCircle, Clock, Calendar, ChevronRight, Sparkles, Loader2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageProvider } from '@/components/ui/LanguageContext';

import { verifyAndRecordPayment, computeBoosterDates, generateOrderId, generatePaymentId, notifyPaymentSuccess } from '@/lib/paymentUtils';

// ── Booster types ────────────────────────────────────────────────────────────
const BOOSTERS = [
  {
    id: 'featured_profile',
    icon: Star,
    gradient: 'from-amber-500 to-orange-500',
    name: 'Featured Listing',
    description: 'Appear at the very top of search results',
    badge: 'Sponsored',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'search_booster',
    icon: TrendingUp,
    gradient: 'from-blue-500 to-sky-500',
    name: 'Priority Ranking',
    description: 'Boost visibility in local area search',
    badge: 'Top Rated',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'premium_visibility',
    icon: Sparkles,
    gradient: 'from-violet-500 to-purple-500',
    name: 'Highlight Badge',
    description: 'Show "Recommended" badge on your profile card',
    badge: 'Recommended',
    badgeColor: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'homepage_promotion',
    icon: Megaphone,
    gradient: 'from-rose-500 to-pink-500',
    name: 'Homepage Banner',
    description: 'Display your profile on the patient home screen',
    badge: 'Premium',
    badgeColor: 'bg-rose-100 text-rose-700',
    premium: true,
  },
];

// ── Pricing tiers ────────────────────────────────────────────────────────────
const DURATIONS = [
  { id: 'd7',  label: '7 days',  price: BOOSTER_PRICES.d7,  unit: '7 days',  icon: Clock },
  { id: 'd14', label: '14 days', price: BOOSTER_PRICES.d14, unit: '14 days', icon: Calendar },
  { id: 'd30', label: '30 days', price: BOOSTER_PRICES.d30, unit: '30 days', icon: Zap },
];

// ── Main Component ────────────────────────────────────────────────────────────
function AdBoostersContent() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState('doctor');
  const [userEmail, setUserEmail] = useState('');
  const [selectedBooster, setSelectedBooster] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState('d7');
  const [activeBoosters, setActiveBoosters] = useState([]);
  const [justActivated, setJustActivated] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await db.auth.me();
        setUserEmail(me.email || '');
        // Determine role from UserProfile
        try {
          const page = await db.entities.UserProfile.filter({ email: me.email }, { limit: 1 });
          if (page.length > 0) {
            const ut = page[0].user_type;
            if (ut === 'doctor') setUserRole('doctor');
            else if (ut === 'pharmacy') setUserRole('pharmacy');
          }
        } catch (_) {}
        // Load active boosters from DB
        if (me.email) {
          try {
            const boosters = await db.entities.AdBooster.filter({
              provider_email: me.email,
              status: 'active',
            }, '-created_date', 50);
            setActiveBoosters(boosters || []);
          } catch (_) {}
        }
      } catch (_) {}
    })();
  }, []);

  const dashboardPage = userRole === 'doctor' ? 'DoctorDashboard' : 'PharmacyDashboard';

  const getExpiry = (booster) => {
    if (!booster?.end_date) return null;
    const end = new Date(booster.end_date);
    const now = new Date();
    const diffMs = end - now;
    if (diffMs <= 0) return 'Expired';
    const diffHrs = Math.ceil(diffMs / 3600000);
    if (diffHrs < 24) return `${diffHrs}h remaining`;
    const diffDays = Math.ceil(diffMs / 86400000);
    return `${diffDays}d remaining`;
  };

  const handleActivate = async () => {
    if (!selectedBooster || !userEmail) return;
    setProcessing(true);
    try {
      const duration = DURATIONS.find(d => d.id === selectedDuration);
      const { start_date, end_date } = computeBoosterDates(selectedDuration);
      const gatewayOrderId = generateOrderId();
      const gatewayPaymentId = generatePaymentId();

      // Step 1: Create AdBooster record
      const booster = await db.entities.AdBooster.create({
        provider_email: userEmail,
        provider_type: userRole === 'doctor' ? 'doctor' : 'pharmacy',
        booster_type: selectedBooster,
        amount: duration.price,
        start_date,
        end_date,
        impressions: 0,
        clicks: 0,
        status: 'active',
        payment_id: '',
      });

      // Step 2: Create Payment audit record
      const { payment } = await verifyAndRecordPayment({
        userEmail,
        amount: duration.price,
        paymentType: 'ad_booster',
        linkedEntityId: booster.id,
        linkedEntityType: 'AdBooster',
        gatewayPaymentId,
        gatewayOrderId,
        description: `${BOOSTERS.find(b => b.id === selectedBooster)?.name} — ${duration.label}`,
      });

      // Step 3: Link payment to booster
      if (payment) {
        await db.entities.AdBooster.update(booster.id, { payment_id: payment.id });
      }

      // Step 4: Notify
      await notifyPaymentSuccess(
        userEmail,
        'Booster Activated',
        `Your ${BOOSTERS.find(b => b.id === selectedBooster)?.name} is now active until ${end_date}.`,
        `/${dashboardPage}`
      );

      // Refresh active boosters
      const boosters = await db.entities.AdBooster.filter({
        provider_email: userEmail,
        status: 'active',
      }, '-created_date', 50);
      setActiveBoosters(boosters || []);

      setJustActivated(selectedBooster);
      setSelectedBooster(null);
      setTimeout(() => setJustActivated(null), 3000);
    } catch (e) {
      alert('Activation failed: ' + (e.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const selectedPrice = DURATIONS.find(d => d.id === selectedDuration)?.price;
  const isActive = (boosterId) => activeBoosters.some(b => b.booster_type === boosterId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 pt-12 pb-8 px-4 rounded-b-3xl">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link to={createPageUrl(dashboardPage)} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Promote Your Profile</h1>
          <p className="text-white/85 text-sm mt-1">
            {userRole === 'doctor'
              ? 'Reach more patients with temporary ranking boosts'
              : 'Increase your pharmacy orders with visibility boosts'}
          </p>
        </div>
      </div>

      <div className="px-4 py-6 max-w-xl mx-auto space-y-6">

        {/* Demo notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">💳 Payment:</span> A booster starts only after MediTrust confirms your payment.
          </p>
        </div>

        {/* Success toast */}
        <AnimatePresence>
          {justActivated && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-green-50 border border-green-300 rounded-2xl p-4 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Booster Activated!</p>
                <p className="text-xs text-green-700">Your profile ranking has been boosted. It will return to normal after expiry.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Booster Cards */}
        <div>
          <h2 className="font-bold text-gray-800 mb-3">Choose a Booster</h2>
          <div className="space-y-3">
            {BOOSTERS.map(booster => {
              const active = isActive(booster.id);
              const activeRecord = activeBoosters.find(b => b.booster_type === booster.id);
              const selected = selectedBooster === booster.id;

              return (
                <button
                  key={booster.id}
                  onClick={() => setSelectedBooster(selected ? null : booster.id)}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                    active
                      ? 'border-green-400 bg-green-50'
                      : selected
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 bg-gradient-to-br ${booster.gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <booster.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{booster.name}</p>
                        <Badge className={`text-xs ${booster.badgeColor}`}>{booster.badge}</Badge>
                        {booster.premium && (
                          <Badge className="text-xs bg-rose-100 text-rose-700">Premium</Badge>
                        )}
                        {active && (
                          <Badge className="text-xs bg-green-100 text-green-700">● Active — {getExpiry(activeRecord)}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{booster.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${
                      selected ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                    }`}>
                      {selected && <div className="w-full h-full rounded-full bg-white scale-50" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration selector */}
        <AnimatePresence>
          {selectedBooster && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              <h2 className="font-bold text-gray-800 mb-3">Select Duration</h2>
              <div className="grid grid-cols-3 gap-3">
                {DURATIONS.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDuration(d.id)}
                    className={`p-4 rounded-2xl border-2 text-center transition-all ${
                      selectedDuration === d.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <d.icon className={`w-5 h-5 mx-auto mb-1 ${selectedDuration === d.id ? 'text-orange-500' : 'text-gray-400'}`} />
                    <p className="font-bold text-gray-800 text-sm">{d.label}</p>
                    <p className="text-lg font-bold text-orange-600">₹{d.price}</p>
                    <p className="text-xs text-gray-500">/{d.unit}</p>
                    {d.savings && (
                      <p className="text-xs text-green-600 font-medium mt-1">{d.savings}</p>
                    )}
                  </button>
                ))}
              </div>

              <Button
                onClick={handleActivate}
                disabled={processing}
                className="w-full mt-4 h-12 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                {processing ? 'Processing...' : `Activate Booster — ₹${selectedPrice}`}
                {!processing && <ChevronRight className="w-4 h-4 ml-2" />}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active boosters summary */}
        {activeBoosters.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Active Boosters
            </h3>
            <div className="space-y-2">
              {activeBoosters.map(ab => {
                const booster = BOOSTERS.find(b => b.id === ab.booster_type);
                if (!booster) return null;
                return (
                  <div key={ab.id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 bg-gradient-to-br ${booster.gradient} rounded-lg flex items-center justify-center`}>
                        <booster.icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-gray-800 text-sm">{booster.name}</span>
                    </div>
                    <span className="text-xs text-green-700 font-medium">{getExpiry(ab)}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">Boosts expire automatically. Your ranking returns to normal after expiry.</p>
          </div>
        )}

        {/* Info block */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">How Ad Boosters work</p>
          <ul className="space-y-1 text-xs text-blue-700">
            <li>• Boosters are independent from subscription plans</li>
            <li>• Active boosts show a "Sponsored" or badge on your profile</li>
            <li>• Ranking reverts automatically after the booster expires</li>
            <li>• Multiple boosters can be active at the same time</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function AdBoosters() {
  return (
    <LanguageProvider>
      <AdBoostersContent />
    </LanguageProvider>
  );
}