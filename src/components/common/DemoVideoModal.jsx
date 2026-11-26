import React, { useState, useEffect } from 'react';
import { Shield, MessageCircle, Stethoscope, Calendar, Pill, Activity, SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../ui/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Disclaimer from './Disclaimer';

const demoFeatures = [
  { icon: MessageCircle, title: 'AI Assistant', desc: 'Get guided health information with web search', color: 'from-blue-500 to-sky-500' },
  { icon: Stethoscope, title: 'Symptom Checker', desc: 'Understand your symptoms educationally', color: 'from-emerald-500 to-teal-500' },
  { icon: Calendar, title: 'Book Appointments', desc: 'Online & offline consultations with doctors', color: 'from-orange-500 to-amber-500' },
  { icon: Pill, title: 'Order Medicines', desc: 'Verify & order from nearby pharmacies', color: 'from-pink-500 to-rose-500' },
  { icon: Activity, title: 'Health Tracker', desc: 'Log symptoms, medicines & health records', color: 'from-violet-500 to-purple-500' },
];

// Animated demo sequence — each step shows a feature with smooth transitions.
const demoSteps = [
  { icon: Shield, title: 'Welcome to MediTrust', subtitle: 'Health Care You Can Trust', color: 'from-blue-600 via-sky-500 to-emerald-500' },
  { icon: MessageCircle, title: 'AI Health Assistant', subtitle: 'Ask questions · Get web-searched answers', color: 'from-blue-500 to-sky-500' },
  { icon: Stethoscope, title: 'Symptom Checker', subtitle: 'Understand symptoms · Find the right specialist', color: 'from-emerald-500 to-teal-500' },
  { icon: Calendar, title: 'Book Appointments', subtitle: 'Offline visits · Chat · Audio · Video', color: 'from-orange-500 to-amber-500' },
  { icon: Pill, title: 'Order Medicines', subtitle: 'Verify authenticity · Nearby pharmacies', color: 'from-pink-500 to-rose-500' },
  { icon: Activity, title: 'Health Tracker', subtitle: 'Log symptoms · Upload records · Stay healthy', color: 'from-violet-500 to-purple-500' },
];

function AnimatedDemo({ onClose }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= demoSteps.length) return;
    const timer = setTimeout(() => {
      if (step < demoSteps.length - 1) {
        setStep((s) => s + 1);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [step]);

  const current = demoSteps[Math.min(step, demoSteps.length - 1)];

  return (
    <div className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-emerald-900 rounded-2xl aspect-video flex items-center justify-center overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-20 -left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl"
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-20 -right-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl"
          animate={{ x: [0, -40, 0], y: [0, -20, 0] }}
          transition={{ duration: 7, repeat: Infinity }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 text-center px-6"
        >
          <div className={`w-20 h-20 mx-auto mb-5 bg-gradient-to-br ${current.color} rounded-3xl flex items-center justify-center shadow-2xl`}>
            <current.icon className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">{current.title}</h3>
          <p className="text-white/70 text-sm">{current.subtitle}</p>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {demoSteps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`}
          />
        ))}
      </div>

      {/* Skip button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-20 flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 text-xs backdrop-blur-sm transition-colors"
      >
        <SkipForward className="w-3 h-3" /> Skip
      </button>
    </div>
  );
}

export default function DemoVideoModal({ isOpen, onClose }) {
  const { t } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800">
            {t('watchDemo')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Animated Demo — auto-playing feature tour */}
          <AnimatedDemo onClose={onClose} />

          {/* Features Overview */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">App Features</h3>
            <div className="space-y-2">
              {demoFeatures.map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                >
                  <div className={`w-9 h-9 bg-gradient-to-br ${feature.color} rounded-lg flex items-center justify-center`}>
                    <feature.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{feature.title}</p>
                    <p className="text-xs text-gray-500">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <Disclaimer />
        </div>
      </DialogContent>
    </Dialog>
  );
}