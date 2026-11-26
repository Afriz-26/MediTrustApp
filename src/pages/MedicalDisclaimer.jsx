import React from 'react';
import { AlertTriangle, Stethoscope, Pill, Bot } from 'lucide-react';
import { LegalLayout, Section, CompanyCard } from '@/components/common/LegalLayout';

export default function MedicalDisclaimer() {
  return (
    <LegalLayout title="Medical Disclaimer" icon={AlertTriangle} tone="amber">
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-red-800 mb-1">Important: read before using MediTrust</h2>
            <p className="text-sm text-red-700">
              MediTrust gives educational and informational assistance and platform services only. It does not provide
              diagnosis, treatment or prescriptions, and is not a substitute for professional medical advice. Always
              ask a qualified healthcare provider about any medical condition.
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-bold text-gray-800">The AI assistant is for education only</h2>
        </div>
        <p>The AI assistant gives general health information. It does not:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Diagnose conditions or tell you what illness you have.</li>
          <li>Prescribe or recommend specific medicines or doses.</li>
          <li>Replace a consultation with a licensed doctor.</li>
          <li>Know your medical history, allergies or the medicines you already take.</li>
        </ul>
        <p className="mt-2">Its answers can be incomplete or wrong. Do not make health decisions based only on what it says.</p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Stethoscope className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-800">See a licensed doctor for</h2>
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Diagnosis, treatment and prescriptions.</li>
          <li>Symptoms that are severe, lasting or getting worse.</li>
          <li>Questions about medicines, doses or side effects.</li>
          <li>Any decision about your health or a family member's health.</li>
        </ul>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Pill className="w-5 h-5 text-pink-600" />
          <h2 className="text-lg font-bold text-gray-800">Medicine information</h2>
        </div>
        <p>
          Medicine details shown in the app come from general datasets and are for awareness only. Brands, strengths and
          prices can differ. Confirm with a pharmacist, follow your doctor's prescription, check for allergies, and do
          not self-medicate with prescription-only medicines.
        </p>
      </div>

      <Section title="Emergencies">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
          If you have chest pain, trouble breathing, heavy bleeding, loss of consciousness, signs of a stroke or any other
          emergency, <strong>do not use this app</strong>. Call <strong>108</strong> (India) or go to the nearest hospital now.
        </div>
      </Section>

      <Section title="No warranty">
        <p>The information in the app is provided "as is". We do not guarantee that it is complete, accurate or up to date. You use it at your own risk.</p>
      </Section>

      <CompanyCard />
    </LegalLayout>
  );
}
