
import { db } from '@/api/client';

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CreditCard, Lock, Crown, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LanguageProvider } from "@/components/ui/LanguageContext";

import { syncTierToProfile } from "@/lib/healthTiers";
import { verifyAndRecordPayment, generateOrderId, generatePaymentId, notifyPaymentSuccess } from "@/lib/paymentUtils";

function PremiumContent() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null); // { id, label, price, limitLabel }
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "" });
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tier = params.get("tier"); // "pro" | "elite"
    const plans = {
      pro: { id: "pro", label: "Pro", price: 99, limitLabel: "1 GB" },
      elite: { id: "elite", label: "Elite", price: 150, limitLabel: "10 GB" },
    };
    if (plans[tier]) setPlan(plans[tier]);
    db.auth.me().then((me) => setUserEmail(me.email || "")).catch((e) => console.error(e));
  }, []);

  const handlePay = async () => {
    if (!card.number || !card.expiry || !card.cvc) return alert("Please enter card details");
    setPaying(true);
    try {
      // Create subscription record
      const sub = await db.entities.HealthTrackerSubscription.create({
        user_email: userEmail,
        tier: plan.id,
        amount: plan.price,
        payment_id: "",
        status: "pending",
        purchased_date: new Date().toISOString(),
      });
      // Create Payment audit record via unified payment module
      const { payment } = await verifyAndRecordPayment({
        userEmail,
        amount: plan.price,
        paymentType: "health_tracker",
        linkedEntityId: sub.id,
        linkedEntityType: "HealthTrackerSubscription",
        gatewayOrderId: generateOrderId(),
        gatewayPaymentId: generatePaymentId(),
        description: `Health Tracker ${plan.label} upgrade`,
      });
      // Link payment and mark as paid
      if (payment) {
        await db.entities.HealthTrackerSubscription.update(sub.id, {
          payment_id: payment.id,
          status: "paid",
        });
      }
      // Persist tier to profile
      await syncTierToProfile(plan.id, userEmail);
      // Notify user
      await notifyPaymentSuccess(
        userEmail,
        "Health Tracker Upgraded",
        `You're now on the ${plan.label} plan with ${plan.limitLabel} storage. Upload more records anytime!`,
        "/HealthTracker"
      );
      setDone(true);
    } catch (e) {
      console.error("Failed to upgrade health tracker plan.", e);
      alert("Payment failed: " + (e.message || "Unknown error"));
    } finally {
      setPaying(false);
    }
  };

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex flex-col items-center justify-center p-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="w-24 h-24 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full flex items-center justify-center mb-5">
          <Crown className="w-12 h-12 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Upgrade Successful!</h2>
        <p className="text-gray-500 text-center mb-5 text-sm max-w-sm">
          You're now on the <strong>{plan.label}</strong> plan with <strong>{plan.limitLabel}</strong> of secure storage. Upload all your prescriptions and reports with confidence.
        </p>
        <Button onClick={() => navigate(createPageUrl("HealthTracker"))}
          className="bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl px-8">
          Back to Health Tracker
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white pb-10">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
          <h1 className="font-semibold text-gray-800">Upgrade Health Tracker</h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto space-y-4">
        {/* Plan summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              {plan.id === "elite" ? <Crown className="w-6 h-6 text-white" /> : <Zap className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h3 className="font-bold text-gray-800">{plan.label} Plan</h3>
              <p className="text-xs text-gray-500">{plan.limitLabel} secure storage</p>
            </div>
            <Badge className="ml-auto bg-violet-100 text-violet-700">One-time</Badge>
          </div>
          <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
            <span className="font-bold text-gray-800">Total</span>
            <span className="text-3xl font-bold text-violet-600">₹{plan.price}</span>
          </div>
        </div>

        {/* Card form */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-800">Card Details</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Card Number</label>
              <Input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })}
                placeholder="4242 4242 4242 4242" className="h-12 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Expiry</label>
                <Input value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                  placeholder="MM/YY" className="h-12 rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">CVC</label>
                <Input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                  placeholder="123" className="h-12 rounded-xl" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
            <Lock className="w-3 h-3" /> Test mode — no real charge. Use any test card details.
          </div>
        </div>

        <Button onClick={handlePay} disabled={paying}
          className="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl font-semibold">
          {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay ₹${plan.price} & Unlock`}
        </Button>
      </div>
    </div>
  );
}

export default function HealthTrackerPremium() {
  return (
    <LanguageProvider>
      <PremiumContent />
    </LanguageProvider>
  );
}