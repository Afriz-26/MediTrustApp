import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Crown, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TIERS, formatBytes } from "@/lib/healthTiers";

// Bottom sheet comparing Pro vs Elite tiers.
export default function UpgradeSheet({ open, onClose, onSelect, currentTier = "free", usedBytes = 0 }) {
  const plans = [
    {
      ...TIERS.pro,
      icon: Zap,
      gradient: "from-blue-500 to-sky-500",
      features: [
        "1 GB secure storage",
        "Unlimited health logs",
        "Upload prescriptions & lab reports",
        "Longer file retention",
        "Priority support",
      ],
    },
    {
      ...TIERS.elite,
      icon: Crown,
      gradient: "from-violet-500 to-purple-500",
      popular: true,
      features: [
        "10 GB secure storage",
        "Everything in Pro",
        "Store full medical history",
        "Family member records",
        "Export & download anytime",
        "Premium priority support",
      ],
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            className="bg-white w-full max-w-md rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Upgrade Storage</h2>
                <p className="text-xs text-gray-500">You're using {formatBytes(usedBytes)}. Unlock more space.</p>
              </div>
              <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
            </div>

            <div className="space-y-3 mb-4">
              {plans.map((plan) => {
                const isCurrent = currentTier === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border-2 p-4 ${plan.popular ? "border-violet-400 bg-violet-50" : "border-gray-200"}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center`}>
                          <plan.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{plan.label}</p>
                          <p className="text-xs text-gray-500">{plan.limitLabel} storage</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-800">₹{plan.price}</p>
                        <p className="text-[10px] text-gray-400">one-time</p>
                      </div>
                    </div>
                    {plan.popular && <Badge className="bg-violet-100 text-violet-700 mb-3 text-[10px]">Most Popular</Badge>}
                    <ul className="space-y-1.5 mb-4">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => onSelect(plan)}
                      disabled={isCurrent}
                      className={`w-full h-11 rounded-xl font-semibold ${isCurrent ? "bg-gray-200 text-gray-500" : `bg-gradient-to-r ${plan.gradient} text-white`}`}
                    >
                      {isCurrent ? "Current Plan" : `Upgrade to ${plan.label} — ₹${plan.price}`}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">Your medical data stays private and secure. Upgrade is a one-time payment — no recurring charges.</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}