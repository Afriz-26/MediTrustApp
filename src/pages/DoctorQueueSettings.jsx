
import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Timer, Calendar, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageProvider } from '@/components/ui/LanguageContext';

import { getDoctorSchedule, saveDoctorSchedule, DEFAULT_SCHEDULE } from '@/lib/doctorSchedule';

const DAYS = [
  { num: 1, label: 'Mon' },
  { num: 2, label: 'Tue' },
  { num: 3, label: 'Wed' },
  { num: 4, label: 'Thu' },
  { num: 5, label: 'Fri' },
  { num: 6, label: 'Sat' },
  { num: 0, label: 'Sun' },
];

function QueueSettingsContent() {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [scheduleId, setScheduleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    (async () => {
      try {
        const me = await db.auth.me();
        if (!me?.email) throw new Error('Could not verify the signed-in doctor account.');
        const existing = await getDoctorSchedule(me.email);
        if (active && existing) {
          const { id, ...data } = existing;
          setSchedule({ ...DEFAULT_SCHEDULE, ...data });
          setScheduleId(id);
        }
      } catch (error) {
        console.error('Failed to load appointment schedule.', error);
        if (active) setLoadError(error.message || 'Could not load your appointment schedule.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadAttempt]);

  const update = (key, value) => setSchedule((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day) => {
    setSchedule((prev) => {
      const days = prev.working_days || [];
      return { ...prev, working_days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort() };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const me = await db.auth.me();
      if (!me?.email) throw new Error('Could not verify the signed-in doctor account.');
      const { working_days, morning_start, morning_end, evening_start, evening_end, slot_duration_minutes } = schedule;
      await saveDoctorSchedule(me.email, {
        working_days, morning_start, morning_end, evening_start, evening_end, slot_duration_minutes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Failed to save appointment schedule.', e);
      alert('Failed to save schedule: ' + (e.message || 'Unknown error'));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-sky-50">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="rounded-xl">Retry</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button onClick={() => navigate(createPageUrl('DoctorDashboard'))} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-800">Appointment Schedule</h1>
            <p className="text-xs text-gray-400">Configure available visit times</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto space-y-4">
        {/* Working Days */}
        <SettingCard icon={Calendar} title="Working Days" color="blue">
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d) => (
              <button key={d.num} onClick={() => toggleDay(d.num)}
                className={`w-12 h-12 rounded-xl border-2 text-sm font-bold transition-all ${schedule.working_days?.includes(d.num) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-400'}`}>
                {d.label}
              </button>
            ))}
          </div>
        </SettingCard>

        {/* Morning Hours */}
        <SettingCard icon={Clock} title="Morning Session" color="emerald">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Start</Label>
              <Input type="time" value={schedule.morning_start || ''} onChange={(e) => update('morning_start', e.target.value)} className="rounded-xl h-11" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">End</Label>
              <Input type="time" value={schedule.morning_end || ''} onChange={(e) => update('morning_end', e.target.value)} className="rounded-xl h-11" />
            </div>
          </div>
        </SettingCard>

        {/* Evening Hours */}
        <SettingCard icon={Clock} title="Evening Session (optional)" color="violet">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Start</Label>
              <Input type="time" value={schedule.evening_start || ''} onChange={(e) => update('evening_start', e.target.value)} className="rounded-xl h-11" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">End</Label>
              <Input type="time" value={schedule.evening_end || ''} onChange={(e) => update('evening_end', e.target.value)} className="rounded-xl h-11" />
            </div>
          </div>
        </SettingCard>

        {/* Slot Duration */}
        <SettingCard icon={Timer} title="Consultation Time per Patient" color="blue">
          <div className="flex gap-2">
            {[10, 15, 20, 30].map((m) => (
              <button key={m} onClick={() => update('slot_duration_minutes', m)}
                className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${schedule.slot_duration_minutes === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'}`}>
                {m} min
              </button>
            ))}
          </div>
        </SettingCard>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-1">Queue tokens are not enabled yet</p>
          <p className="text-xs text-blue-700">Visit times are saved here. Unique tokens, walk-in check-in, and live queue calling require a server-side queue function that has not been deployed.</p>
        </div>

        {/* Save */}
        <Button onClick={handleSave} disabled={saving}
          className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl font-semibold text-white">
          {saving ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2" /> Saving...</>
            : saved ? <><CheckCircle className="w-5 h-5 mr-2" /> Settings Saved!</>
            : <><Save className="w-5 h-5 mr-2" /> Save Schedule</>}
        </Button>
      </div>
    </div>
  );
}

function SettingCard({ icon: Icon, title, color, children }) {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-600',
    violet: 'bg-violet-100 text-violet-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
  };
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function DoctorQueueSettings() {
  return (
    <LanguageProvider>
      <QueueSettingsContent />
    </LanguageProvider>
  );
}