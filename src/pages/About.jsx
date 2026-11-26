import React from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Stethoscope, Pill, ShieldCheck, MapPin, ArrowLeft } from 'lucide-react';
import { LanguageProvider } from '@/components/ui/LanguageContext';
import { createPageUrl } from '@/utils';

function AboutContent() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 pt-12 pb-6 px-4 rounded-b-3xl">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <HeartPulse className="w-7 h-7" /> About Medi Trust
          </h1>
          <p className="text-white/80 text-sm mt-2">
            Health Care You Can Trust — connecting patients, doctors, and pharmacies across India.
          </p>
        </div>
      </div>

      <div className="px-4 py-8 max-w-3xl mx-auto prose prose-slate max-w-none">
        <p className="text-base leading-relaxed text-slate-700">
          Medi Trust is a guided digital healthcare platform built to make quality medical care
          accessible, affordable, and trustworthy for everyone in India. We connect three essential
          parts of the healthcare journey — patients, doctors, and pharmacies — in a single, easy-to-use
          app. Patients can search for nearby doctors and clinics on a live map, book offline or online
          consultations (chat, audio, or video), order medicines from local pharmacies, and keep a
          personal health log. Doctors get a dedicated dashboard to manage appointments, write digital
          prescriptions, and reach more patients. Pharmacies can accept medicine orders, manage
          inventory requests, and offer pickup or delivery.
        </p>

        <p className="text-base leading-relaxed text-slate-700 mt-4">
          The platform is designed for everyday Indians — from young professionals in metros to
          families in smaller towns — who deserve transparent, verified healthcare without long
          waits or confusing paperwork. Our AI educational assistant helps users understand symptoms
          and next steps in plain language, while every consultation is backed by licensed
          professionals. We use real-time location data from OpenStreetMap so you always see genuine
          doctors and pharmacies near you, and our onboarding team works to verify and bring new
          providers onto the platform as patients request them.
        </p>

        <p className="text-base leading-relaxed text-slate-700 mt-4">
          Medi Trust is built by a small product team passionate about using technology to close the
          healthcare gap in India. We believe trust is earned through transparency, verified
          providers, and putting patients in control of their own health records. Whether you need a
          quick consultation, a reliable pharmacy, or a place to keep your medical history, Medi Trust
          is here to help you take the next step with confidence.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 not-prose">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <Stethoscope className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="font-semibold text-slate-800">For Patients</h3>
            <p className="text-sm text-slate-600 mt-1">Find doctors, book consultations, order medicines, and track your health.</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <Pill className="w-6 h-6 text-rose-600 mb-2" />
            <h3 className="font-semibold text-slate-800">For Pharmacies</h3>
            <p className="text-sm text-slate-600 mt-1">Receive orders, manage pickup and delivery, and serve your local community.</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <ShieldCheck className="w-6 h-6 text-emerald-600 mb-2" />
            <h3 className="font-semibold text-slate-800">Verified Care</h3>
            <p className="text-sm text-slate-600 mt-1">Licensed doctors and verified pharmacies you can trust with your health.</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 not-prose">
          <Link
            to={createPageUrl('Contact')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            <MapPin className="w-4 h-4" /> Contact Us
          </Link>
          <Link
            to={createPageUrl('PatientDashboard')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function About() {
  return (
    <LanguageProvider>
      <AboutContent />
    </LanguageProvider>
  );
}