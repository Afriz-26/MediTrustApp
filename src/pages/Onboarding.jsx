import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, Camera, Upload, Sparkles, AlertCircle, Loader2, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import MobileDrawerSelect from '@/components/common/MobileDrawerSelect';
import { LanguageProvider } from '@/components/ui/LanguageContext';

const SPECIALIZATIONS = [
  'general_physician', 'cardiologist', 'dermatologist', 'neurologist',
  'orthopedic', 'pediatrician', 'psychiatrist', 'gynecologist',
  'ophthalmologist', 'ent', 'endocrinologist', 'gastroenterologist',
  'oncologist', 'nephrologist', 'pulmonologist', 'rheumatologist',
];

const fmtSpecialization = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/**
 * @typedef {{
 *   full_name?: string, name?: string, phone?: string, gender?: string,
 *   city?: string, state?: string, address?: string, hospital_address?: string,
 *   medical_history?: string[], specialization?: string,
 *   experience_years?: string | number, hospital_name?: string,
 *   license_number?: string, consultation_fees?: { offline?: number | null },
 *   owner_name?: string, operating_hours?: string
 * }} OnboardingProfile
 */

// ── Step Progress Bar ─────────────────────────────────────────────────────────
function StepIndicator({ currentStep, totalSteps }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
            i < currentStep
              ? 'bg-emerald-500 text-white'
              : i === currentStep
              ? 'bg-blue-600 text-white ring-4 ring-blue-100'
              : 'bg-gray-200 text-gray-400'
          }`}>
            {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div className={`w-8 h-0.5 mx-1 ${i < currentStep ? 'bg-emerald-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
// Defined at module level on purpose: a component declared inside another component is re-created on every
// keystroke, which makes inputs lose focus after each character.
const Field = ({ label, required, error, children }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium text-gray-700">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
    {children}
    {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
  </div>
);

function OnboardingContent() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [editingMode, setEditingMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [errors, setErrors] = useState({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    // Common
    fullName: '', age: '', gender: '', phone: '', email: '',
    city: '', state: '', address: '',
    // Patient
    emergencyContact: '', existingConditions: '',
    // Doctor
    specialization: '', experienceYears: '', hospitalName: '', registrationId: '',
    offlineFee: '',
    // Pharmacy
    pharmacyName: '', ownerName: '', licenseNumber: '',
    openingTime: '', closingTime: '',
  });

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setLoadError('');
      try {
        const me = await db.auth.me();
        if (!me?.email) throw new Error('Sign in before completing your profile.');
        const role = me.role;
        if (!['patient', 'doctor', 'pharmacy'].includes(role)) {
          throw new Error('This account does not have a supported profile type.');
        }

        const [isOnboarded, profiles] = await Promise.all([
          db.auth.isOnboarded(),
          db.entities.UserProfile.filter({ email: me.email }, { limit: 1 }),
        ]);
        /** @type {OnboardingProfile} */
        const profile = profiles[0] || {};
        /** @type {OnboardingProfile} */
        let roleProfile = {};
        if (role === 'doctor') {
          const rows = await db.entities.DoctorProfile.filter({ email: me.email }, { limit: 1 });
          roleProfile = rows[0] || {};
        } else if (role === 'pharmacy') {
          const rows = await db.entities.PharmacyProfile.filter({ email: me.email }, { limit: 1 });
          roleProfile = rows[0] || {};
        }

        if (!active) return;
        setUserRole(role);
        setEditingMode(isOnboarded);
        setForm((prev) => ({
          ...prev,
          fullName: profile.full_name || profile.name || me.full_name || '',
          phone: profile.phone || roleProfile.phone || '',
          email: me.email,
          gender: profile.gender || '',
          city: profile.city || roleProfile.city || '',
          state: profile.state || roleProfile.state || '',
          address: roleProfile.hospital_address || roleProfile.address || '',
          existingConditions: (profile.medical_history || []).join(', '),
          specialization: roleProfile.specialization || '',
          experienceYears: roleProfile.experience_years || '',
          hospitalName: roleProfile.hospital_name || '',
          registrationId: roleProfile.license_number || '',
          offlineFee: roleProfile.consultation_fees?.offline ?? '',
          pharmacyName: roleProfile.name || '',
          ownerName: roleProfile.owner_name || '',
          licenseNumber: roleProfile.license_number || '',
          openingTime: roleProfile.operating_hours?.split(' - ')[0] || '',
          closingTime: roleProfile.operating_hours?.split(' - ')[1] || '',
        }));
      } catch (error) {
        console.error('Failed to load onboarding profile.', error);
        if (active) setLoadError(error.message || 'Could not load your profile.');
      }
    };
    loadProfile();
    return () => { active = false; };
  }, [loadAttempt]);

  // ── Step config ──
  const patientSteps = ['Personal', 'Contact', 'Medical', 'Review'];
  const doctorSteps = ['Personal', 'Professional', 'Fees & Contact', 'Review'];
  const pharmacySteps = ['Pharmacy', 'Operations', 'Review'];

  const steps = userRole === 'doctor' ? doctorSteps : userRole === 'pharmacy' ? pharmacySteps : patientSteps;
  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps - 1;

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateStep = () => {
    const e = {};
    if (currentStep === 0) {
      if (userRole === 'pharmacy') {
        if (!form.pharmacyName.trim()) e.pharmacyName = 'Required';
        if (!form.ownerName.trim()) e.ownerName = 'Required';
        if (!form.phone.trim()) e.phone = 'Required';
        if (!form.licenseNumber.trim()) e.licenseNumber = 'Required';
      } else {
        if (!form.fullName.trim()) e.fullName = 'Required';
        if (!editingMode && (!form.age || form.age < 1)) e.age = 'Required';
        if (!editingMode && !form.gender) e.gender = 'Required';
        if (!form.phone.trim()) e.phone = 'Required';
      }
    }
    if (currentStep === 1) {
      if (userRole === 'patient') {
        if (!form.city.trim()) e.city = 'Required';
        if (!form.state.trim()) e.state = 'Required';
      } else if (userRole === 'doctor') {
        if (!form.specialization) e.specialization = 'Required';
        if (!form.experienceYears || form.experienceYears < 1) e.experienceYears = 'Required';
        if (!form.hospitalName.trim()) e.hospitalName = 'Required';
        if (!form.registrationId.trim()) e.registrationId = 'Required';
      } else if (userRole === 'pharmacy') {
        if (!form.city.trim()) e.city = 'Required';
        if (!form.state.trim()) e.state = 'Required';
        if (!form.address.trim()) e.address = 'Required';
        if (!form.openingTime) e.openingTime = 'Required';
        if (!form.closingTime) e.closingTime = 'Required';
      }
    }
    if (currentStep === 2 && userRole === 'doctor') {
      if (!form.city.trim()) e.city = 'Required';
      if (!form.state.trim()) e.state = 'Required';
      if (!form.offlineFee || form.offlineFee < 1) e.offlineFee = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (isLastStep) {
      handleSubmit();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setSubmitError('');
    try {
      const me = await db.auth.me();
      if (!me?.email) throw new Error('Your sign-in session expired. Please sign in again.');
      if (me.role !== userRole) throw new Error('The account type changed. Refresh the page and try again.');
      const email = me.email;
      const city = form.city.trim();
      const state = form.state.trim();
      const fullAddress = form.address.trim() || [city, state].filter(Boolean).join(', ');

      // Upsert UserProfile
      const profilePage = await db.entities.UserProfile.filter({ email }, { limit: 1 });
      const profileData = {
        email,
        name: userRole === 'pharmacy' ? form.pharmacyName : form.fullName,
        phone: form.phone,
        gender: form.gender || undefined,
        city,
        state,
        ...(userRole === 'patient' && form.existingConditions ? {
          medical_history: form.existingConditions.split(',').map(s => s.trim()).filter(Boolean),
        } : {}),
      };
      if (profilePage.length > 0) {
        await db.entities.UserProfile.update(profilePage[0].id, profileData);
      } else {
        await db.entities.UserProfile.create(profileData);
      }

      // Save role-specific profile
      if (userRole === 'doctor') {
        const docPage = await db.entities.DoctorProfile.filter({ email }, { limit: 1 });
        const doctorData = {
          email,
          name: form.fullName,
          specialization: form.specialization,
          experience_years: parseInt(form.experienceYears) || 0,
          license_number: form.registrationId,
          hospital_name: form.hospitalName,
          hospital_address: fullAddress,
          city,
          state,
          consultation_fees: { offline: Number(form.offlineFee) },
          is_verified: false,
        };
        if (docPage.length > 0) {
          await db.entities.DoctorProfile.update(docPage[0].id, doctorData);
        } else {
          await db.entities.DoctorProfile.create(doctorData);
        }
      } else if (userRole === 'pharmacy') {
        const pharmPage = await db.entities.PharmacyProfile.filter({ email }, { limit: 1 });
        const pharmacyData = {
          email,
          name: form.pharmacyName,
          owner_name: form.ownerName,
          license_number: form.licenseNumber,
          address: fullAddress,
          city,
          state,
          phone: form.phone,
          operating_hours: `${form.openingTime} - ${form.closingTime}`,
          is_verified: false,
        };
        if (pharmPage.length > 0) {
          await db.entities.PharmacyProfile.update(pharmPage[0].id, pharmacyData);
        } else {
          await db.entities.PharmacyProfile.create(pharmacyData);
        }
      }

      setSubmitted(true);
      setTimeout(() => {
        const dashboard = userRole === 'doctor' ? 'DoctorDashboard'
          : userRole === 'pharmacy' ? 'PharmacyDashboard' : 'PatientDashboard';
        navigate(createPageUrl(dashboard));
      }, 2000);
    } catch (error) {
      console.error('Failed to save onboarding profile.', error);
      setSubmitError(error.message || 'Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      if (editingMode) {
        const dashboard = userRole === 'doctor' ? 'DoctorDashboard'
          : userRole === 'pharmacy' ? 'PharmacyDashboard' : 'PatientDashboard';
        navigate(createPageUrl(dashboard));
      } else {
        navigate(createPageUrl('Welcome'));
      }
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const isAuthed = await db.auth.isAuthenticated();
      if (isAuthed) {
        const me = await db.auth.me();
        const email = me.email;
        const purge = async (entity, field) => {
          try {
            const purgePage = await db.entities[entity].filter({ [field]: email }, { limit: 100 });
            const rows = purgePage;
            for (const r of rows) await db.entities[entity].delete(r.id);
          } catch (_) {}
        };
        await purge('UserProfile', 'email');
        await purge('DoctorProfile', 'email');
        await purge('PharmacyProfile', 'email');
      }
    } catch (_) {}
    localStorage.removeItem('meditrust_role');
    localStorage.removeItem('meditrust_demo_user');
    localStorage.removeItem('meditrust_onboarding_completed');
    localStorage.removeItem('meditrust_onboarding_data');
    localStorage.removeItem('meditrust_subscription_plan');
    localStorage.removeItem('meditrust_location');
    setDeleting(false);
    setDeleteOpen(false);
    try { await db.auth.logout(); } catch (_) {}
    navigate(createPageUrl('Welcome'));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
          <Sparkles className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {editingMode ? 'Profile Updated!' : 'All Set!'}
          </h2>
          <p className="text-gray-500">Taking you to your dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (!userRole && loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="rounded-xl">Retry</Button>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  const headerGradient = userRole === 'doctor'
    ? 'from-emerald-600 via-teal-500 to-cyan-500'
    : userRole === 'pharmacy'
    ? 'from-pink-600 via-rose-500 to-red-500'
    : 'from-blue-600 via-sky-500 to-emerald-500';

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Header */}
      <div className={`bg-gradient-to-r ${headerGradient} pt-12 pb-10 px-4 rounded-b-3xl`}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={handleBack} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {editingMode ? 'Edit Profile' : 'Complete Your Profile'}
          </h1>
          <p className="text-white/80 text-sm mt-1">
            {userRole === 'doctor' ? 'Help patients find and trust you'
              : userRole === 'pharmacy' ? 'Set up your pharmacy for customers'
              : 'Fill in your details to get started'}
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 py-6 max-w-lg mx-auto">
        <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />

        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-5">
            {steps[currentStep]} — Step {currentStep + 1} of {totalSteps}
          </h3>

          {/* ── Step Content ── */}
          <div className="min-h-[300px]">
            {/* ── PATIENT Step 0: Personal Info ── */}
            {userRole === 'patient' && currentStep === 0 && (
              <div className="space-y-4">
                <Field label="Full Name" required error={errors.fullName}>
                  <Input autoFocus value={form.fullName} onChange={e => update('fullName', e.target.value)}
                    placeholder="Enter your full name" className="rounded-xl h-12" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Age" required={!editingMode} error={errors.age}>
                    <Input type="number" value={form.age} onChange={e => update('age', e.target.value)}
                      placeholder="Age" className="rounded-xl h-12" />
                  </Field>
                  <Field label="Gender" required={!editingMode} error={errors.gender}>
                    <MobileDrawerSelect
                      value={form.gender}
                      onChange={v => update('gender', v)}
                      placeholder="Select"
                      title="Select Gender"
                      triggerClassName="rounded-xl h-12"
                      options={[
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />
                  </Field>
                </div>
                <Field label="Phone Number" required error={errors.phone}>
                  <Input value={form.phone} onChange={e => update('phone', e.target.value)}
                    placeholder="+91 98765 43210" type="tel" className="rounded-xl h-12" />
                </Field>
                <Field label="Email">
                  <Input value={form.email} disabled className="rounded-xl h-12 bg-gray-50" />
                </Field>
              </div>
            )}

            {/* ── PATIENT Step 1: Contact ── */}
            {userRole === 'patient' && currentStep === 1 && (
              <div className="space-y-4">
                <Field label="City" required error={errors.city}>
                  <Input value={form.city} onChange={e => update('city', e.target.value)}
                    placeholder="e.g. Mumbai" className="rounded-xl h-12" />
                </Field>
                <Field label="State" required error={errors.state}>
                  <Input value={form.state} onChange={e => update('state', e.target.value)}
                    placeholder="e.g. Maharashtra" className="rounded-xl h-12" />
                </Field>
                <Field label="Address">
                  <Textarea value={form.address} onChange={e => update('address', e.target.value)}
                    placeholder="Full address" className="rounded-xl" rows={3} />
                </Field>
              </div>
            )}

            {/* ── PATIENT Step 2: Medical ── */}
            {userRole === 'patient' && currentStep === 2 && (
              <div className="space-y-4">
                <Field label="Emergency Contact (optional)">
                  <Input value={form.emergencyContact} onChange={e => update('emergencyContact', e.target.value)}
                    placeholder="+91 98765 43210" type="tel" className="rounded-xl h-12" />
                </Field>
                <Field label="Existing Conditions (optional)">
                  <Textarea value={form.existingConditions} onChange={e => update('existingConditions', e.target.value)}
                    placeholder="e.g. Diabetes, Hypertension, Asthma..." className="rounded-xl" rows={3} />
                </Field>
              </div>
            )}

            {/* ── PATIENT Step 3: Review ── */}
            {userRole === 'patient' && currentStep === 3 && (
              <ReviewStep
                fields={[
                  ['Full Name', form.fullName],
                  ['Age', form.age],
                  ['Gender', form.gender],
                  ['Phone', form.phone],
                  ['Email', form.email],
                  ['City', form.city],
                  ['State', form.state],
                  ['Address', form.address],
                  ['Emergency Contact', form.emergencyContact],
                  ['Conditions', form.existingConditions],
                ]}
              />
            )}

            {/* ── DOCTOR Step 0: Personal Info ── */}
            {userRole === 'doctor' && currentStep === 0 && (
              <div className="space-y-4">
                <Field label="Full Name" required error={errors.fullName}>
                  <Input autoFocus value={form.fullName} onChange={e => update('fullName', e.target.value)}
                    placeholder="Dr. Full Name" className="rounded-xl h-12" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Age" required={!editingMode} error={errors.age}>
                    <Input type="number" value={form.age} onChange={e => update('age', e.target.value)}
                      className="rounded-xl h-12" />
                  </Field>
                  <Field label="Gender" required={!editingMode} error={errors.gender}>
                    <MobileDrawerSelect
                      value={form.gender}
                      onChange={v => update('gender', v)}
                      placeholder="Select"
                      title="Select Gender"
                      triggerClassName="rounded-xl h-12"
                      options={[
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />
                  </Field>
                </div>
                <Field label="Phone Number" required error={errors.phone}>
                  <Input value={form.phone} onChange={e => update('phone', e.target.value)}
                    placeholder="+91 98765 43210" type="tel" className="rounded-xl h-12" />
                </Field>
                <Field label="Email">
                  <Input value={form.email} disabled className="rounded-xl h-12 bg-gray-50" />
                </Field>
              </div>
            )}

            {/* ── DOCTOR Step 1: Professional ── */}
            {userRole === 'doctor' && currentStep === 1 && (
              <div className="space-y-4">
                <Field label="Specialization" required error={errors.specialization}>
                  <MobileDrawerSelect
                    value={form.specialization}
                    onChange={v => update('specialization', v)}
                    placeholder="Select specialization"
                    title="Select Specialization"
                    triggerClassName="rounded-xl h-12"
                    options={SPECIALIZATIONS.map(s => ({ value: s, label: fmtSpecialization(s) }))}
                  />
                </Field>
                <Field label="Years of Experience" required error={errors.experienceYears}>
                  <Input type="number" value={form.experienceYears} onChange={e => update('experienceYears', e.target.value)}
                    className="rounded-xl h-12" />
                </Field>
                <Field label="Hospital / Clinic Name" required error={errors.hospitalName}>
                  <Input value={form.hospitalName} onChange={e => update('hospitalName', e.target.value)}
                    placeholder="e.g. Apollo Hospital" className="rounded-xl h-12" />
                </Field>
                <Field label="Medical Registration ID" required error={errors.registrationId}>
                  <Input value={form.registrationId} onChange={e => update('registrationId', e.target.value)}
                    placeholder="e.g. MCI-2024-12345" className="rounded-xl h-12" />
                </Field>
              </div>
            )}

            {/* ── DOCTOR Step 2: Fees & Contact ── */}
            {userRole === 'doctor' && currentStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Offline visit fee (₹)</p>
                <Field label="Offline Visit" required error={errors.offlineFee}>
                  <Input type="number" min="1" value={form.offlineFee} onChange={e => update('offlineFee', e.target.value)}
                    className="rounded-xl h-12" />
                </Field>
                <Field label="City" required error={errors.city}>
                  <Input value={form.city} onChange={e => update('city', e.target.value)}
                    placeholder="e.g. Mumbai" className="rounded-xl h-12" />
                </Field>
                <Field label="State" required error={errors.state}>
                  <Input value={form.state} onChange={e => update('state', e.target.value)}
                    placeholder="e.g. Maharashtra" className="rounded-xl h-12" />
                </Field>
                <Field label="Address">
                  <Textarea value={form.address} onChange={e => update('address', e.target.value)}
                    placeholder="Clinic/hospital address" className="rounded-xl" rows={2} />
                </Field>
                <div className="pt-2">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Profile Photo</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-blue-400 transition-colors cursor-pointer">
                    <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Tap to upload</p>
                    <p className="text-xs text-gray-400">JPG, PNG (max 5MB)</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── DOCTOR Step 3: Review ── */}
            {userRole === 'doctor' && currentStep === 3 && (
              <ReviewStep
                fields={[
                  ['Full Name', form.fullName],
                  ['Specialization', form.specialization ? fmtSpecialization(form.specialization) : ''],
                  ['Experience', form.experienceYears + ' years'],
                  ['Hospital', form.hospitalName],
                  ['Reg. ID', form.registrationId],
                  ['Offline Fee', '₹' + (form.offlineFee || '0')],
                  ['City', form.city],
                  ['State', form.state],
                ]}
              />
            )}

            {/* ── PHARMACY Step 0: Pharmacy Info ── */}
            {userRole === 'pharmacy' && currentStep === 0 && (
              <div className="space-y-4">
                <Field label="Pharmacy Name" required error={errors.pharmacyName}>
                  <Input autoFocus value={form.pharmacyName} onChange={e => update('pharmacyName', e.target.value)}
                    placeholder="e.g. MediPlus Pharmacy" className="rounded-xl h-12" />
                </Field>
                <Field label="Owner Name" required error={errors.ownerName}>
                  <Input value={form.ownerName} onChange={e => update('ownerName', e.target.value)}
                    className="rounded-xl h-12" />
                </Field>
                <Field label="Phone Number" required error={errors.phone}>
                  <Input value={form.phone} onChange={e => update('phone', e.target.value)}
                    placeholder="+91 98765 43210" type="tel" className="rounded-xl h-12" />
                </Field>
                <Field label="License Number" required error={errors.licenseNumber}>
                  <Input value={form.licenseNumber} onChange={e => update('licenseNumber', e.target.value)}
                    placeholder="e.g. DL-2024-001234" className="rounded-xl h-12" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Age (optional)">
                    <Input type="number" value={form.age} onChange={e => update('age', e.target.value)}
                      placeholder="Age" className="rounded-xl h-12" />
                  </Field>
                  <Field label="Gender (optional)">
                    <Select value={form.gender} onValueChange={v => update('gender', v)}>
                      <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Email">
                  <Input value={form.email} disabled className="rounded-xl h-12 bg-gray-50" />
                </Field>
              </div>
            )}

            {/* ── PHARMACY Step 1: Operations ── */}
            {userRole === 'pharmacy' && currentStep === 1 && (
              <div className="space-y-4">
                <Field label="City" required error={errors.city}>
                  <Input value={form.city} onChange={e => update('city', e.target.value)}
                    className="rounded-xl h-12" />
                </Field>
                <Field label="State" required error={errors.state}>
                  <Input value={form.state} onChange={e => update('state', e.target.value)}
                    className="rounded-xl h-12" />
                </Field>
                <Field label="Full Address" required error={errors.address}>
                  <Textarea value={form.address} onChange={e => update('address', e.target.value)}
                    className="rounded-xl" rows={2} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Opening Time" required error={errors.openingTime}>
                    <Input type="time" value={form.openingTime} onChange={e => update('openingTime', e.target.value)}
                      className="rounded-xl h-12" />
                  </Field>
                  <Field label="Closing Time" required error={errors.closingTime}>
                    <Input type="time" value={form.closingTime} onChange={e => update('closingTime', e.target.value)}
                      className="rounded-xl h-12" />
                  </Field>
                </div>
                <div className="pt-2">
                  <p className="text-sm text-gray-600">Medicine reservations are for pharmacy pickup. Delivery is not available in this version.</p>
                </div>
                <div className="pt-2">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">License Upload</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-blue-400 transition-colors cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Tap to upload license</p>
                    <p className="text-xs text-gray-400">PDF, JPG (max 5MB)</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── PHARMACY Step 2: Review ── */}
            {userRole === 'pharmacy' && currentStep === 2 && (
              <ReviewStep
                fields={[
                  ['Pharmacy Name', form.pharmacyName],
                  ['Owner Name', form.ownerName],
                  ['Age', form.age],
                  ['Gender', form.gender],
                  ['Phone', form.phone],
                  ['License', form.licenseNumber],
                  ['City', form.city],
                  ['State', form.state],
                  ['Hours', form.openingTime + ' - ' + form.closingTime],
                ]}
              />
            )}
          </div>

          {/* Navigation */}
          {submitError && <p role="alert" className="mt-4 text-sm text-red-600">{submitError}</p>}
          <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={handleBack} className="flex-1 rounded-xl h-12">
              {currentStep === 0 ? 'Cancel' : 'Back'}
            </Button>
            <Button onClick={handleNext} disabled={isSaving} className="flex-1 rounded-xl h-12 bg-gradient-to-r from-blue-600 to-sky-500 font-semibold">
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <>{isLastStep ? (editingMode ? 'Save Changes' : 'Complete Setup') : 'Next'}{!isLastStep && <ArrowRight className="w-4 h-4 ml-1" />}</>
              )}
            </Button>
          </div>

          {/* Account deletion — only in settings / edit mode, double-confirmed */}
          {editingMode && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <button type="button" className="flex items-center gap-2 text-sm text-red-600 font-medium">
                    <Trash2 className="w-4 h-4" /> Delete my account
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete account permanently?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes your profile, saved medical data, and preferences from MediTrust. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <Button onClick={handleDeleteAccount} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                      {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</> : 'Yes, delete forever'}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ── Review Step ───────────────────────────────────────────────────────────────
function ReviewStep({ fields }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <p className="text-sm text-gray-500 mb-2">Review your details before submitting:</p>
      {fields.map(([label, value], i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
          <span className="text-sm text-gray-500">{label}</span>
          <span className="text-sm font-medium text-gray-800 text-right max-w-[60%] truncate">
            {value || '—'}
          </span>
        </div>
      ))}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-3">
        <p className="text-xs text-blue-700 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          You can edit these details later from Profile → Edit Profile
        </p>
      </div>
    </motion.div>
  );
}

export default function Onboarding() {
  return (
    <LanguageProvider>
      <OnboardingContent />
    </LanguageProvider>
  );
}