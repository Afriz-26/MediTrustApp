
import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Check, Crown, Sparkles, Ticket, FileText,
  BadgeCheck, Stethoscope, Building2, Users, Star, Zap, BarChart2, Loader2, ShieldCheck, Clock
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageProvider } from '@/components/ui/LanguageContext';

import features from '@/config/features';
import { DOCTOR_PLAN_PRICES, PHARMACY_PLAN_PRICES, YEARLY_DISCOUNT, MANUAL_PAYMENT, AVAILABLE_PLANS } from '@/config/pricing';
import { startOnlinePayment } from '@/lib/payments';

// Plan ids are internal (basic / moderate / pro). Users see them as Basic / Pro / Elite.
// Only plans listed as available in src/config/pricing.js can be bought. Everything a plan promises must exist.

// ── Doctor Plans ──────────────────────────────────────────────────────────────
const doctorPlans = [
  {
    id: 'basic',
    name: 'Basic',
    price: DOCTOR_PLAN_PRICES.basic,
    icon: BadgeCheck,
    gradient: 'from-blue-500 to-sky-500',
    tagline: 'Everything a clinic needs to start',
    benefits: [
      'Listed in Find Doctors for patients near you',
      'Offline appointment booking with token numbers',
      'Digital prescriptions patients can download',
      'Verified doctor badge',
      'Notifications for new bookings',
    ],
  },
  {
    id: 'moderate',
    name: 'Pro',
    price: DOCTOR_PLAN_PRICES.moderate,
    icon: Sparkles,
    gradient: 'from-violet-500 to-purple-500',
    tagline: 'Coming soon',
    benefits: [
      'Everything in Basic',
      'Priority position in search (planned)',
      'Ratings & patient feedback (planned)',
      'Booking analytics (planned)',
    ],
  },
  {
    id: 'pro',
    name: 'Elite',
    price: DOCTOR_PLAN_PRICES.pro,
    icon: Crown,
    gradient: 'from-amber-500 to-orange-500',
    tagline: 'Coming soon',
    benefits: [
      'Everything in Pro',
      'Online consultations (planned)',
      'Multi-doctor clinic accounts (planned)',
      'Priority support (planned)',
    ],
  },
];

// ── Pharmacy Plans ────────────────────────────────────────────────────────────
const pharmacyPlans = [
  {
    id: 'basic',
    name: 'Basic',
    price: PHARMACY_PLAN_PRICES.basic,
    icon: BadgeCheck,
    gradient: 'from-teal-500 to-emerald-500',
    tagline: 'Get listed and receive pickup reservations',
    benefits: [
      'Listed in the pharmacy section for nearby patients',
      'Receive medicine pickup reservations',
      'Manage your stock and prices',
      'Verified pharmacy badge',
      'Notifications for new reservations',
    ],
  },
  {
    id: 'moderate',
    name: 'Pro',
    price: PHARMACY_PLAN_PRICES.moderate,
    icon: Sparkles,
    gradient: 'from-cyan-500 to-blue-500',
    tagline: 'Coming soon',
    benefits: [
      'Everything in Basic',
      'Priority position in search (planned)',
      'Customer ratings & reviews (planned)',
      'Sales and demand analytics (planned)',
    ],
  },
  {
    id: 'pro',
    name: 'Elite',
    price: PHARMACY_PLAN_PRICES.pro,
    icon: Crown,
    gradient: 'from-orange-500 to-rose-500',
    tagline: 'Coming soon',
    benefits: [
      'Everything in Pro',
      'Featured pharmacy badge (planned)',
      'Multi-branch accounts (planned)',
      'Priority support (planned)',
    ],
  },
];

// Map plan IDs to subscription tier enum values
const PLAN_TIER_MAP = { basic: 'basic', moderate: 'pro', pro: 'elite' };

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, isSelected, onSelect, billingCycle }) {
  const available = AVAILABLE_PLANS[plan.id] !== false;
  const displayPrice = billingCycle === 'yearly' ? Math.round(plan.price * 12 * (1 - YEARLY_DISCOUNT)) : plan.price;
  const priceSuffix = billingCycle === 'yearly' ? '/year' : '/month';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-white rounded-2xl p-6 border-2 transition-all shadow-sm ${
        !available ? 'border-gray-100 opacity-75' : isSelected ? 'border-purple-500 shadow-xl' : 'border-gray-100 hover:border-gray-200'
      }`}
    >
      {available ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-1 text-xs font-semibold shadow">
            Available now
          </Badge>
        </div>
      ) : (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-gray-200 text-gray-600 px-4 py-1 text-xs font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3" /> Coming soon
          </Badge>
        </div>
      )}

      <div className={`w-12 h-12 bg-gradient-to-br ${plan.gradient} rounded-xl flex items-center justify-center mb-4 shadow-md`}>
        <plan.icon className="w-6 h-6 text-white" />
      </div>

      <h3 className="text-xl font-bold text-gray-800 mb-0.5">{plan.name}</h3>
      <p className="text-xs text-gray-500 mb-3">{plan.tagline}</p>

      <div className="flex items-baseline gap-1 mb-5">
        <span className="text-3xl font-bold text-gray-900">₹{displayPrice.toLocaleString()}</span>
        <span className="text-gray-400 text-sm">{priceSuffix}</span>
      </div>

      <div className="space-y-2.5 mb-6">
        {plan.benefits.map((benefit, i) => (
          <div key={i} className="flex items-start gap-2">
            <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${available ? 'text-green-500' : 'text-gray-300'}`} />
            <span className={`text-sm ${available ? 'text-gray-700' : 'text-gray-400'}`}>{benefit}</span>
          </div>
        ))}
      </div>

      <Button
        onClick={() => available && onSelect(plan)}
        disabled={!available}
        className={`w-full h-11 rounded-xl font-semibold ${
          !available
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : isSelected
              ? `bg-gradient-to-r ${plan.gradient} text-white`
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {!available ? 'Coming soon' : isSelected ? '✓ Selected' : 'Choose Plan'}
      </Button>
    </motion.div>
  );
}

// ── Main Content ─────────────────────────────────────────────────────────────
function SubscriptionPlansContent() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [userRole, setUserRole] = useState('doctor');
  const [userEmail, setUserEmail] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(null); // plan object on success
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'

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
        } catch (e) { console.error(e); }
      } catch (e) { console.error(e); }
    })();
  }, []);

  const isDoctor = userRole === 'doctor';
  const plans = isDoctor ? doctorPlans : pharmacyPlans;
  const dashboardPage = isDoctor ? 'DoctorDashboard' : 'PharmacyDashboard';

  const heading = isDoctor
    ? 'For Doctors: Run Your Clinic Queue'
    : 'For Pharmacies: Receive Pickup Reservations';

  const subheading = isDoctor
    ? 'Be found by patients nearby, take bookings with tokens, and issue digital prescriptions'
    : 'Be found by patients nearby and manage medicine reservations for pickup';

  const planAmount = (plan) => (billingCycle === 'yearly' ? Math.round(plan.price * 12 * (1 - YEARLY_DISCOUNT)) : plan.price);

  const handleSelect = async (plan) => {
    if (AVAILABLE_PLANS[plan.id] === false) return;
    setSelectedPlan(plan.id);
    setProcessing(true);
    try {
      const tier = PLAN_TIER_MAP[plan.id] || 'basic';
      const amount = planAmount(plan);
      // A plan is created as PENDING. It becomes active only after payment is confirmed:
      // by an admin during the pilot, or by the payment server once online payments are enabled.
      const subscription = await db.entities.Subscription.create({
        provider_email: userEmail,
        provider_type: isDoctor ? 'doctor' : 'pharmacy',
        tier,
        amount,
        billing_cycle: billingCycle,
        status: 'pending',
        start_date: '',
        end_date: '',
        payment_id: '',
        description: `${plan.name} plan requested`,
      });
      const reference = `SUB-${String(subscription.id).slice(-6).toUpperCase()}`;
      if (!features.onlinePayments) {
        setSuccess({ ...plan, billingCycle, amount, pending: true, reference });
        return;
      }
      await startOnlinePayment({
        purpose: 'subscription', amount, description: `${plan.name} subscription`,
        linkedEntityType: 'Subscription', linkedEntityId: subscription.id,
      });
      setSuccess({ ...plan, billingCycle, amount, pending: false, reference });
    } catch (e) {
      console.error('Subscription purchase failed', e);
      alert(e.message || 'Something went wrong. Please try again.');
      setSelectedPlan(null);
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex flex-col items-center justify-center p-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="w-24 h-24 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full flex items-center justify-center mb-5">
          <Check className="w-12 h-12 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">{success.pending ? 'Request received' : `${success.name} Plan Activated!`}</h2>
        <p className="text-gray-500 text-center mb-2 text-sm max-w-sm">
          {success.pending
            ? `Your ${success.name} plan request is saved. It becomes active after MediTrust confirms your payment of ₹${success.amount}. Quote reference ${success.reference}. ${MANUAL_PAYMENT.upiId ? `Pay to UPI ID ${MANUAL_PAYMENT.upiId} (${MANUAL_PAYMENT.payeeName}).` : 'MediTrust will contact you with the payment details.'}`
            : `Your subscription is now active. Enjoy the features to grow your ${isDoctor ? 'practice' : 'pharmacy'}.`}
        </p>
        <div className="flex items-center gap-1.5 mb-5 text-xs text-gray-400">
          <ShieldCheck className="w-4 h-4 text-violet-500" />
          {success.pending ? 'Waiting for payment confirmation' : 'Payment verified & recorded'}
        </div>
        <Button onClick={() => navigate(createPageUrl(dashboardPage))}
          className="bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl px-8">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  const valuePoints = isDoctor
    ? [
        { icon: Users,     color: 'bg-blue-100 text-blue-600',   title: 'Be found nearby',       desc: 'Patients in your area can find and book you' },
        { icon: Ticket,    color: 'bg-violet-100 text-violet-600', title: 'Fewer crowded waiting rooms', desc: 'Patients get a token and arrive when it is their turn' },
        { icon: FileText,  color: 'bg-amber-100 text-amber-600',  title: 'Digital prescriptions', desc: 'Issue clear prescriptions patients can download' },
      ]
    : [
        { icon: Building2,  color: 'bg-teal-100 text-teal-600',   title: 'Be found nearby',      desc: 'Patients in your area can find your pharmacy' },
        { icon: Star,       color: 'bg-orange-100 text-orange-600', title: 'Pickup reservations', desc: 'Patients reserve medicines and collect them in person' },
        { icon: Zap,        color: 'bg-rose-100 text-rose-600',   title: 'Simple stock tools',   desc: 'Mark what is available and set your prices' },
      ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-purple-50 pb-20">
      {/* Header */}
      <div className={`pt-12 pb-8 px-4 rounded-b-3xl ${
        isDoctor
          ? 'bg-gradient-to-r from-blue-600 via-violet-500 to-purple-600'
          : 'bg-gradient-to-r from-teal-600 via-emerald-500 to-cyan-500'
      }`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <Link to={createPageUrl(dashboardPage)} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              {isDoctor
                ? <Stethoscope className="w-5 h-5 text-white" />
                : <Building2 className="w-5 h-5 text-white" />
              }
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{heading}</h1>
          <p className="text-white/85 text-sm leading-relaxed">{subheading}</p>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
        {/* How it works */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">💳 How it works:</span> Choose a plan to send your request. Your plan becomes active after MediTrust confirms your payment.
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="inline-flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billingCycle === 'monthly' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billingCycle === 'yearly' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500'}`}
            >
              Yearly <span className="text-green-500 text-xs ml-1">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4">Select a Plan</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSelected={selectedPlan === plan.id}
                onSelect={handleSelect}
                billingCycle={billingCycle}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Prices are per provider. Tax, if applicable, is added at payment.</p>
        </div>

        {/* Patient access note */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Patient Access is Always Free</p>
            <p className="text-sm text-green-700 mt-0.5">
              Patients on Medi Trust are never charged. Subscription plans are only for doctors and pharmacies.
            </p>
          </div>
        </div>

        {/* Value messaging */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Why subscribe?</h3>
          <div className="space-y-4">
            {valuePoints.map((vp, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${vp.color.split(' ')[0]}`}>
                  <vp.icon className={`w-5 h-5 ${vp.color.split(' ')[1]}`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{vp.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{vp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Processing overlay */}
      {processing && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-3" />
            <p className="text-sm text-gray-600">Sending your request...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPlans() {
  return (
    <LanguageProvider>
      <SubscriptionPlansContent />
    </LanguageProvider>
  );
}
