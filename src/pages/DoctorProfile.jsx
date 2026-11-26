import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Camera, Building2, MessageCircle, Phone, Video, BadgeCheck, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';

const specializations = [
  { id: 'general_physician', name: 'General Physician' },
  { id: 'cardiologist', name: 'Cardiologist' },
  { id: 'dermatologist', name: 'Dermatologist' },
  { id: 'neurologist', name: 'Neurologist' },
  { id: 'orthopedic', name: 'Orthopedic' },
  { id: 'pediatrician', name: 'Pediatrician' },
  { id: 'psychiatrist', name: 'Psychiatrist' },
  { id: 'gynecologist', name: 'Gynecologist' },
];

function DoctorProfileContent() {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [profile, setProfile] = useState({
    name: 'Dr. Demo Doctor',
    specialization: 'general_physician',
    qualification: 'MBBS, MD',
    experience_years: 10,
    license_number: 'MCI-12345',
    hospital_name: 'City Medical Center',
    hospital_address: '123 Health Street, Medical District',
    fees: {
      offline: 500,
      chat: 200,
      audio: 350,
      video: 450
    }
  });

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 pt-12 pb-20 px-4 rounded-b-3xl">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link to={createPageUrl('DoctorDashboard')} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
            <h1 className="text-xl font-bold text-white">{t('manageProfile')}</h1>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-16 max-w-md mx-auto">
        {/* Profile Picture */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <Avatar className="w-28 h-28 border-4 border-white shadow-xl">
              <AvatarImage src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop" />
              <AvatarFallback className="bg-emerald-100 text-emerald-600 text-2xl font-semibold">DR</AvatarFallback>
            </Avatar>
            <button className="absolute bottom-0 right-0 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
              <Camera className="w-5 h-5 text-white" />
            </button>
          </div>
        </motion.div>

        {/* Verification Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-6"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
            <BadgeCheck className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-blue-700">Verified Doctor</span>
          </div>
        </motion.div>

        {/* Basic Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
        >
          <h3 className="font-semibold text-gray-800 mb-4">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-600 text-sm">Full Name</Label>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-gray-600 text-sm">Specialization</Label>
              <Select
                value={profile.specialization}
                onValueChange={(value) => setProfile({ ...profile, specialization: value })}
              >
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {specializations.map(spec => (
                    <SelectItem key={spec.id} value={spec.id}>{spec.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-600 text-sm">Qualification</Label>
                <Input
                  value={profile.qualification}
                  onChange={(e) => setProfile({ ...profile, qualification: e.target.value })}
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-gray-600 text-sm">Experience (years)</Label>
                <Input
                  type="number"
                  value={profile.experience_years}
                  onChange={(e) => setProfile({ ...profile, experience_years: parseInt(e.target.value) })}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-600 text-sm">License Number</Label>
              <Input
                value={profile.license_number}
                onChange={(e) => setProfile({ ...profile, license_number: e.target.value })}
                className="mt-1 rounded-xl"
              />
            </div>
          </div>
        </motion.div>

        {/* Hospital Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
        >
          <h3 className="font-semibold text-gray-800 mb-4">Hospital / Clinic</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-600 text-sm">Hospital Name</Label>
              <Input
                value={profile.hospital_name}
                onChange={(e) => setProfile({ ...profile, hospital_name: e.target.value })}
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-gray-600 text-sm">Address</Label>
              <Input
                value={profile.hospital_address}
                onChange={(e) => setProfile({ ...profile, hospital_address: e.target.value })}
                className="mt-1 rounded-xl"
              />
            </div>
          </div>
        </motion.div>

        {/* Consultation Fees */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
        >
          <h3 className="font-semibold text-gray-800 mb-4">{t('setFees')}</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <Label className="text-gray-600 text-sm">Hospital Visit</Label>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">₹</span>
                <Input
                  type="number"
                  value={profile.fees.offline}
                  onChange={(e) => setProfile({ ...profile, fees: { ...profile.fees, offline: parseInt(e.target.value) } })}
                  className="w-24 rounded-lg"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-xl">
              <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <Label className="text-gray-600 text-sm">Chat Consultation</Label>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">₹</span>
                <Input
                  type="number"
                  value={profile.fees.chat}
                  onChange={(e) => setProfile({ ...profile, fees: { ...profile.fees, chat: parseInt(e.target.value) } })}
                  className="w-24 rounded-lg"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-emerald-50 rounded-xl">
              <div className="w-10 h-10 bg-emerald-200 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <Label className="text-gray-600 text-sm">Audio Call</Label>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">₹</span>
                <Input
                  type="number"
                  value={profile.fees.audio}
                  onChange={(e) => setProfile({ ...profile, fees: { ...profile.fees, audio: parseInt(e.target.value) } })}
                  className="w-24 rounded-lg"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-violet-50 rounded-xl">
              <div className="w-10 h-10 bg-violet-200 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <Label className="text-gray-600 text-sm">Video Call</Label>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">₹</span>
                <Input
                  type="number"
                  value={profile.fees.video}
                  onChange={(e) => setProfile({ ...profile, fees: { ...profile.fees, video: parseInt(e.target.value) } })}
                  className="w-24 rounded-lg"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full h-14 text-base font-semibold rounded-xl transition-all ${
              saved 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <BadgeCheck className="w-5 h-5 mr-2" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {t('save')} Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DoctorProfile() {
  return (
    <LanguageProvider>
      <DoctorProfileContent />
    </LanguageProvider>
  );
}