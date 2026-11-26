
import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, FileText, CheckCircle, Loader2, User, Pill, Eye, Download,
  Stethoscope, AlertTriangle, ShieldCheck, ClipboardList, StickyNote
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LanguageProvider } from '@/components/ui/LanguageContext';
import { downloadPrescription } from '@/lib/prescriptionDownload';

// Quick-pick chips: one tap fills the field. Doctors can still type anything.
const FREQUENCY_CHIPS = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'At bedtime', 'As needed (SOS)'];
const DURATION_CHIPS = ['3 days', '5 days', '7 days', '10 days', '2 weeks', '1 month'];
const INSTRUCTION_CHIPS = ['After food', 'Before food', 'With plenty of water', 'At bedtime'];

// Names only, to speed up typing. The doctor decides everything else.
const MEDICINE_SUGGESTIONS = [
  'Paracetamol', 'Dolo 650', 'Ibuprofen', 'Diclofenac', 'Cetirizine', 'Levocetirizine', 'Montelukast', 'Azithromycin',
  'Amoxicillin', 'Amoxicillin + Clavulanic acid', 'Cefixime', 'Doxycycline', 'Metronidazole', 'Ciprofloxacin',
  'Pantoprazole', 'Omeprazole', 'Ranitidine', 'Domperidone', 'Ondansetron', 'ORS', 'Metformin', 'Amlodipine',
  'Atorvastatin', 'Telmisartan', 'Losartan', 'Vitamin D3', 'Vitamin B-complex', 'Iron + Folic acid', 'Calcium', 'Cough syrup',
];

const emptyMedicine = () => ({ name: '', dosage: '', frequency: '', duration: '', instructions: '' });

function Chips({ options, value, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
            value === o ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ step, icon: Icon, title, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm font-bold flex items-center justify-center">{step}</div>
        <Icon className="w-5 h-5 text-emerald-600" />
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

function WritePrescriptionContent() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issued, setIssued] = useState(null);
  const [patientInfo, setPatientInfo] = useState({ name: '', email: '' });
  const [doctor, setDoctor] = useState(null);
  const [prescription, setPrescription] = useState({
    diagnosis: '',
    medicines: [emptyMedicine()],
    additional_notes: '',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPatientInfo({
      name: params.get('patientName') || '',
      email: params.get('patientEmail') || '',
    });
    (async () => {
      try {
        const me = await db.auth.me();
        const docPage = await db.entities.DoctorProfile.filter({ email: me.email }, { limit: 1 });
        setDoctor({ ...(docPage[0] || {}), _fallbackName: me.full_name || '', _email: me.email });
      } catch (e) {
        console.warn('Could not load doctor profile.', e);
      }
    })();
  }, []);

  const addMedicine = () => setPrescription((p) => ({ ...p, medicines: [...p.medicines, emptyMedicine()] }));
  const removeMedicine = (index) => setPrescription((p) => ({ ...p, medicines: p.medicines.filter((_, i) => i !== index) }));
  const updateMedicine = (index, field, value) => setPrescription((p) => ({
    ...p,
    medicines: p.medicines.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
  }));

  const filledMedicines = prescription.medicines.filter((m) => m.name.trim() !== '');
  const canSubmit = prescription.diagnosis.trim() !== '' && filledMedicines.length > 0 && !isSubmitting;

  const doctorName = doctor?.name || doctor?._fallbackName || 'Doctor';

  const buildRx = (extra = {}) => ({
    id: '',
    created_date: new Date().toISOString(),
    doctor_name: doctorName,
    doctor_specialization: (doctor?.specialization || '').replace('_', ' '),
    doctor_license: doctor?.license_number || '',
    doctor_qualification: doctor?.qualification || '',
    doctor_clinic: doctor?.hospital_name || '',
    doctor_clinic_address: doctor?.hospital_address || '',
    doctor_city: doctor?.city || '',
    patient_name: patientInfo.name || 'Patient',
    patient_email: patientInfo.email || '',
    diagnosis: prescription.diagnosis.trim(),
    medicines: filledMedicines,
    additional_notes: prescription.additional_notes.trim(),
    ...extra,
  });

  const handlePreview = () => downloadPrescription(buildRx(), { preview: true });

  const handleSubmit = async () => {
    if (!window.confirm('Issue this prescription?\n\nIt will be sent to the patient and cannot be edited afterwards.')) return;
    setIsSubmitting(true);
    try {
      const me = await db.auth.me();
      const created = await db.entities.Prescription.create({
        patient_email: patientInfo.email,
        patient_name: patientInfo.name,
        doctor_email: me.email,
        doctor_name: doctorName,
        doctor_specialization: doctor?.specialization || '',
        doctor_license: doctor?.license_number || '',
        diagnosis: prescription.diagnosis.trim(),
        medicines: filledMedicines,
        additional_notes: prescription.additional_notes.trim(),
        pharmacy_status: 'pending',
      });
      setIssued(buildRx({ id: created?.id || '' }));
    } catch (e) {
      alert('Failed to create prescription: ' + (e.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (issued) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg"
        >
          <CheckCircle className="w-12 h-12 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Prescription issued</h2>
        <p className="text-gray-500 text-center mb-6 max-w-sm">
          {patientInfo.name || 'The patient'} has been notified and can view or download it from their prescriptions.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => downloadPrescription(issued)} className="rounded-xl px-6">
            <Download className="w-4 h-4 mr-2" />
            Save a PDF copy
          </Button>
          <Button
            onClick={() => navigate(createPageUrl('DoctorAppointments'))}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl px-8"
          >
            Back to Appointments
          </Button>
        </div>
      </div>
    );
  }

  const missingRegistration = doctor && !doctor.license_number;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-sky-500 px-4 pt-safe pb-14">
        <div className="max-w-2xl mx-auto pt-4">
          <div className="flex items-center gap-3 mb-4">
            <Link to={createPageUrl('DoctorAppointments')} className="p-2 -ml-2" aria-label="Back">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
            <div>
              <h1 className="font-bold text-white text-xl">Write prescription</h1>
              <p className="text-white/80 text-xs">A professional e-prescription the patient can download as a PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/15 backdrop-blur rounded-2xl p-3">
            <div className="w-11 h-11 rounded-xl bg-white/25 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold truncate">{/^dr\.?\s/i.test(doctorName) ? doctorName : `Dr. ${doctorName}`}</p>
              <p className="text-white/80 text-xs truncate">
                {[doctor?.qualification, (doctor?.specialization || '').replace('_', ' ')].filter(Boolean).join(' · ') || 'Doctor'}
                {doctor?.license_number ? ` · Reg. ${doctor.license_number}` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto -mt-8">
        {missingRegistration && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Your registration number is missing, so it will not appear on the prescription.{' '}
              <Link to={createPageUrl('DoctorProfile')} className="underline font-medium">Add it in your profile</Link>.
            </span>
          </div>
        )}

        {/* 1 Patient */}
        <SectionCard step="1" icon={User} title="Patient">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
              {(patientInfo.name || 'P').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800">{patientInfo.name || 'Patient name'}</p>
              <p className="text-sm text-gray-500 truncate">{patientInfo.email || 'patient@email.com'}</p>
            </div>
            <div className="ml-auto text-right text-xs text-gray-400">
              {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </SectionCard>

        {/* 2 Diagnosis */}
        <SectionCard step="2" icon={ClipboardList} title="Diagnosis" delay={0.05}>
          <Textarea
            value={prescription.diagnosis}
            onChange={(e) => setPrescription({ ...prescription, diagnosis: e.target.value })}
            placeholder="e.g. Acute viral fever with throat infection"
            className="rounded-xl border-gray-200 min-h-[80px]"
          />
        </SectionCard>

        {/* 3 Medicines */}
        <SectionCard step="3" icon={Pill} title="Medicines" delay={0.1}>
          <datalist id="medicine-suggestions">
            {MEDICINE_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
          </datalist>
          <div className="space-y-4">
            {prescription.medicines.map((med, index) => (
              <div key={index} className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-emerald-800 text-sm">℞ {index + 1}</span>
                  {prescription.medicines.length > 1 && (
                    <button type="button" onClick={() => removeMedicine(index)} className="text-red-500 hover:text-red-600 p-1" aria-label={`Remove medicine ${index + 1}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <Input
                    list="medicine-suggestions"
                    placeholder="Medicine name"
                    value={med.name}
                    onChange={(e) => updateMedicine(index, 'name', e.target.value)}
                    className="rounded-lg bg-white"
                  />
                  <Input
                    placeholder="Dosage (e.g. 500 mg, 5 ml)"
                    value={med.dosage}
                    onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                    className="rounded-lg bg-white"
                  />
                  <div>
                    <Input
                      placeholder="How often"
                      value={med.frequency}
                      onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                      className="rounded-lg bg-white"
                    />
                    <Chips options={FREQUENCY_CHIPS} value={med.frequency} onPick={(v) => updateMedicine(index, 'frequency', v)} />
                  </div>
                  <div>
                    <Input
                      placeholder="For how long"
                      value={med.duration}
                      onChange={(e) => updateMedicine(index, 'duration', e.target.value)}
                      className="rounded-lg bg-white"
                    />
                    <Chips options={DURATION_CHIPS} value={med.duration} onPick={(v) => updateMedicine(index, 'duration', v)} />
                  </div>
                  <div>
                    <Input
                      placeholder="Instructions (optional)"
                      value={med.instructions}
                      onChange={(e) => updateMedicine(index, 'instructions', e.target.value)}
                      className="rounded-lg bg-white"
                    />
                    <Chips options={INSTRUCTION_CHIPS} value={med.instructions} onPick={(v) => updateMedicine(index, 'instructions', v)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={addMedicine} className="w-full mt-4 rounded-xl border-dashed border-emerald-300 text-emerald-700">
            <Plus className="w-4 h-4 mr-1" />
            Add another medicine
          </Button>
        </SectionCard>

        {/* 4 Notes */}
        <SectionCard step="4" icon={StickyNote} title="Advice and notes" delay={0.15}>
          <Textarea
            value={prescription.additional_notes}
            onChange={(e) => setPrescription({ ...prescription, additional_notes: e.target.value })}
            placeholder="e.g. Drink plenty of fluids. Review after 5 days if fever continues."
            className="rounded-xl border-gray-200 min-h-[80px]"
          />
        </SectionCard>

        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800">
            This prescription is issued electronically through MediTrust with your name and registration number.
            The patient is notified and can download a PDF. It cannot be edited after you issue it, so use Preview first.
          </p>
        </div>
      </div>

      {/* Sticky actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 p-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={!canSubmit}
            className="h-14 rounded-xl px-5 font-semibold"
          >
            <Eye className="w-5 h-5 mr-2" />
            Preview
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 h-14 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Issuing...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                Issue prescription
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WritePrescription() {
  return (
    <LanguageProvider>
      <WritePrescriptionContent />
    </LanguageProvider>
  );
}
