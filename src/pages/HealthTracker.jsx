
import { db } from '@/api/client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, FileText, Download, Activity, Pill, Clock, Folder, Upload, Trash2, ChevronRight, Lock, X, Check,
  Stethoscope, BookOpen, BarChart2, Crown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { LanguageProvider } from '@/components/ui/LanguageContext';
import features from '@/config/features';
import StorageUsageBar from '@/components/health/StorageUsageBar';
import UpgradeSheet from '@/components/health/UpgradeSheet';
import { readTier, getTier, computeUsedBytes, formatBytes } from '@/lib/healthTiers';
import FileLink from '@/components/health/FileLink';
import { DataError } from '@/components/common/DataState';
import { downloadPrescription } from '@/lib/prescriptionDownload';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const TAB_TRACKER = 'tracker';
const TAB_RECORDS = 'records';
const isMockBackend = import.meta.env.VITE_USE_MOCK === 'true';

const SEVERITY_COLORS = {
  mild: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  severe: 'bg-red-100 text-red-700',
};

const LOG_TYPE_META = {
  symptom: { label: 'Symptom', icon: Activity, color: 'bg-rose-100 text-rose-700', gradient: 'from-rose-500 to-pink-500' },
  medicine: { label: 'Medicine Taken', icon: Pill, color: 'bg-blue-100 text-blue-700', gradient: 'from-blue-500 to-sky-500' },
  note: { label: 'Note', icon: BookOpen, color: 'bg-amber-100 text-amber-700', gradient: 'from-amber-500 to-orange-400' },
  visit_summary: { label: 'Doctor Visit', icon: Stethoscope, color: 'bg-violet-100 text-violet-700', gradient: 'from-violet-500 to-purple-500' },
};

const FILE_TYPE_META = {
  prescription: { label: 'Prescription', icon: FileText, color: 'bg-teal-100 text-teal-700' },
  lab_report: { label: 'Lab Report', icon: BarChart2, color: 'bg-indigo-100 text-indigo-700' },
  other: { label: 'Other', icon: Folder, color: 'bg-gray-100 text-gray-700' },
};

// ─── Quick Add Modal ──────────────────────────────────────────────────────────
function AddLogModal({ onClose, onSave, userEmail }) {
  const [type, setType] = useState('symptom');
  const [form, setForm] = useState({ title: '', description: '', date: new Date().toISOString().split('T')[0], severity: 'mild', medicine_name: '', medicine_dose: '', medicine_taken: false, doctor_name: '', reminder_time: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    setSaveError('');
    try {
      await db.entities.HealthLog.create({ ...form, log_type: type, patient_email: userEmail });
      onSave();
    } catch (error) {
      console.error('Failed to save health log.', error);
      setSaveError(error.message || 'Failed to save health log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} className="bg-white w-full max-w-md rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">Add Health Log</h2>
          <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
        </div>

        {/* Type selector */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries(LOG_TYPE_META).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium ${type === key ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-100 text-gray-600'}`}
            >
              <val.icon className="w-4 h-4" />
              {val.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400"
            placeholder="Title *"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
          />
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400"
            type="date"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
          />
          <textarea
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400 h-20 resize-none"
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />

          {type === 'symptom' && (
            <div className="flex gap-2">
              {['mild', 'moderate', 'severe'].map(s => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, severity: s })}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border-2 transition-all ${form.severity === s ? SEVERITY_COLORS[s] + ' border-current' : 'border-gray-100 text-gray-500'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {type === 'medicine' && (
            <>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400"
                placeholder="Medicine Name"
                value={form.medicine_name}
                onChange={e => setForm({ ...form, medicine_name: e.target.value })}
              />
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400"
                placeholder="Dose (e.g. 500mg)"
                value={form.medicine_dose}
                onChange={e => setForm({ ...form, medicine_dose: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.medicine_taken} onChange={e => setForm({ ...form, medicine_taken: e.target.checked })} />
                Marked as taken
              </label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  value={form.reminder_time}
                  onChange={e => setForm({ ...form, reminder_time: e.target.value })}
                />
                <span className="text-xs text-gray-500">Set reminder</span>
              </div>
            </>
          )}

          {type === 'visit_summary' && (
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400"
              placeholder="Doctor Name"
              value={form.doctor_name}
              onChange={e => setForm({ ...form, doctor_name: e.target.value })}
            />
          )}
        </div>

        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        <Button
          onClick={handleSave}
          disabled={saving || !form.title}
          className="w-full mt-5 h-12 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl font-semibold"
        >
          {saving ? 'Saving...' : 'Save Log'}
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Upload Record Modal ──────────────────────────────────────────────────────
function UploadRecordModal({ onClose, onSave, userEmail, remainingBytes, storageFull, onLimitReached }) {
  const [fileType, setFileType] = useState('prescription');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sizeError, setSizeError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef();

  const handleFile = (f) => {
    setFile(f);
    setSizeError('');
    if (f && f.size > remainingBytes) {
      setSizeError(`This file (${formatBytes(f.size)}) exceeds your remaining space (${formatBytes(remainingBytes)}). Please upgrade to upload more.`);
    }
  };

  const handleSave = async () => {
    if (!title) return;
    if (file && file.size > remainingBytes) {
      onLimitReached && onLimitReached();
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      let file_url = '';
      let file_size = 0;
      if (file) {
        const res = await db.integrations.Core.UploadPrivateFile({ file });
        file_url = res.file_uri;
        file_size = file.size;
      }
      await db.entities.HealthLog.create({
        patient_email: userEmail,
        log_type: 'note',
        title,
        date: new Date().toISOString().split('T')[0],
        file_url,
        file_type: fileType,
        file_size,
      });
      onSave();
    } catch (error) {
      console.error('Failed to upload health record.', error);
      setUploadError(error.message || 'Failed to save this record.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} className="bg-white w-full max-w-md rounded-t-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">Upload Health Record</h2>
          <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {Object.entries(FILE_TYPE_META).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setFileType(key)}
              className={`p-3 rounded-xl border-2 text-xs font-medium text-center transition-all ${fileType === key ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-gray-100 text-gray-600'}`}
            >
              {val.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-400"
            placeholder="Record Title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center gap-2 hover:border-teal-300 hover:bg-teal-50 transition-all"
          >
            <Upload className="w-8 h-8 text-teal-500" />
            <p className="text-sm font-medium text-gray-700">{file ? file.name : 'Tap to upload PDF / Image'}</p>
            <p className="text-xs text-gray-400">Optional – PDF, JPG, PNG</p>
          </button>
          {sizeError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <Lock className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{sizeError}</p>
            </div>
          )}
          {uploadError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {uploadError}
              <Button type="button" size="sm" variant="outline" className="ml-2" onClick={handleSave}>Retry</Button>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        </div>

        <Button
          onClick={handleSave}
          disabled={uploading || !title}
          className="w-full mt-5 h-12 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl font-semibold"
        >
          {uploading ? 'Uploading...' : 'Save Record'}
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Weekly Chart ─────────────────────────────────────────────────────────────
function WeeklyChart({ logs }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const data = days.map((day, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    return {
      day,
      symptoms: logs.filter(l => l.date === dateStr && l.log_type === 'symptom').length,
      medicines: logs.filter(l => l.date === dateStr && l.log_type === 'medicine').length,
    };
  });

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="font-semibold text-gray-700 mb-3 text-sm">Weekly Activity</p>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} barSize={10}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip />
          <Bar dataKey="symptoms" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Symptoms" />
          <Bar dataKey="medicines" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Medicines" />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 justify-center mt-2">
        <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-3 rounded bg-rose-400 inline-block" /> Symptoms</span>
        <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-3 rounded bg-blue-400 inline-block" /> Medicines</span>
      </div>
    </div>
  );
}

// ─── Log Card ─────────────────────────────────────────────────────────────────
function LogCard({ log, onDelete }) {
  const meta = LOG_TYPE_META[log.log_type] || LOG_TYPE_META.note;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center flex-shrink-0`}>
        <meta.icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <p className="font-semibold text-gray-800 text-sm">{log.title}</p>
          <button onClick={() => onDelete(log.id)} className="text-gray-300 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{log.date}</p>
        {log.description && <p className="text-xs text-gray-600 mt-1">{log.description}</p>}
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge className={`text-xs border-0 ${meta.color}`}>{meta.label}</Badge>
          {log.severity && <Badge className={`text-xs border-0 ${SEVERITY_COLORS[log.severity]}`}>{log.severity}</Badge>}
          {log.medicine_name && <Badge className="text-xs border-0 bg-blue-50 text-blue-600">{log.medicine_name} {log.medicine_dose}</Badge>}
          {log.medicine_taken && <Badge className="text-xs border-0 bg-green-100 text-green-700"><Check className="w-3 h-3 mr-1" />Taken</Badge>}
          {log.reminder_time && <Badge className="text-xs border-0 bg-orange-50 text-orange-600"><Clock className="w-3 h-3 mr-1" />{log.reminder_time}</Badge>}
          {log.doctor_name && <Badge className="text-xs border-0 bg-violet-50 text-violet-600">{log.doctor_name}</Badge>}
        </div>
      </div>
    </div>
  );
}

// ─── Record Card ──────────────────────────────────────────────────────────────
function RecordCard({ log, onDelete }) {
  const fileMeta = FILE_TYPE_META[log.file_type] || FILE_TYPE_META.other;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-3">
      <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <fileMeta.icon className="w-6 h-6 text-gray-500" />
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <p className="font-semibold text-gray-800 text-sm">{log.title}</p>
          {log.prescription ? (
            <button type="button" className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-1.5 text-sm" onClick={() => downloadPrescription(log.prescription)}>
              <Download className="w-4 h-4 mr-1" /> Download
            </button>
          ) : (
            <button onClick={() => onDelete(log.id)} className="text-gray-300 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">{log.date}</p>
        {log.prescription && (
          <p className="text-xs text-gray-600 mt-1">
            {log.prescription.doctor_name || 'Doctor'}{log.prescription.diagnosis ? ` · ${log.prescription.diagnosis}` : ''}
          </p>
        )}
        <div className="flex gap-2 mt-2">
          <Badge className={`text-xs border-0 ${fileMeta.color}`}>{fileMeta.label}</Badge>
          {log.file_url && (
            <FileLink fileUri={log.file_url} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
function HealthTrackerContent() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => isMockBackend
    && new URLSearchParams(window.location.search).get('tab') !== TAB_RECORDS
    ? TAB_TRACKER
    : TAB_RECORDS);
  const [logs, setLogs] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tierError, setTierError] = useState('');
  const [showAddLog, setShowAddLog] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [recordSection, setRecordSection] = useState('all'); // all | prescription | lab_report | visit
  const [tier, setTier] = useState('free');
  const [showUpgrade, setShowUpgrade] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setTierError('');
    try {
      const me = await db.auth.me();
      if (!me?.email) throw new Error('Could not verify the signed-in patient account.');
      setUserEmail(me.email);
      try {
        setTier(await readTier(me.email));
      } catch (tierError) {
        console.error('Failed to load health tracker tier.', tierError);
        setTier('free');
        setTierError('Your plan details could not be loaded. Health records are still available.');
      }
      const [data, prescriptionData] = await Promise.all([
        isMockBackend
          ? db.entities.HealthLog.filter({ patient_email: me.email }, '-date', 50)
          : Promise.resolve([]),
        db.entities.Prescription.filter({ patient_email: me.email }, { sort: '-created_date', limit: 100 }),
      ]);
      setLogs(data);
      setPrescriptions(prescriptionData);
    } catch (error) {
      console.error('Failed to load health tracker records.', error);
      setLoadError(error.message || 'Failed to load your health records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const usedBytes = computeUsedBytes(logs);
  const tierInfo = getTier(tier);
  const remainingBytes = Math.max(0, tierInfo.limit - usedBytes);
  const storageFull = usedBytes >= tierInfo.limit;

  const handleDelete = async (id) => {
    try {
      await db.entities.HealthLog.delete(id);
      setLogs((current) => current.filter((log) => log.id !== id));
    } catch (error) {
      console.error('Failed to delete health record.', error);
      setLoadError(error.message || 'Failed to delete this record.');
    }
  };

  const trackerLogs = logs.filter(l => ['symptom', 'medicine', 'visit_summary', 'note'].includes(l.log_type) && !l.file_url);
  const prescriptionRecords = prescriptions.map((prescription) => ({
    id: `prescription_${prescription.id}`,
    title: prescription.diagnosis ? `Prescription - ${prescription.diagnosis}` : `Prescription from ${prescription.doctor_name || 'doctor'}`,
    date: prescription.created_date ? String(prescription.created_date).slice(0, 10) : '',
    file_type: 'prescription',
    prescription,
  }));
  const recordLogs = [
    ...logs.filter(l => l.file_url || l.log_type === 'note'),
    ...prescriptionRecords,
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const filteredRecords = recordSection === 'all'
    ? recordLogs
    : recordSection === 'visit'
    ? logs.filter(l => l.log_type === 'visit_summary')
    : recordLogs.filter(l => l.file_type === recordSection);

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-blue-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 pt-12 pb-6 px-4 rounded-b-3xl sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{isMockBackend ? 'Health Tracker & Records' : 'Health Records'}</h1>
              <p className="text-white/80 text-xs flex items-center gap-1"><Lock className="w-3 h-3" /> Private & Secure</p>
            </div>
          </div>
          {/* Tabs */}
          {isMockBackend && <div className="flex bg-white/20 rounded-xl p-1">
            <button
              onClick={() => setTab(TAB_TRACKER)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_TRACKER ? 'bg-white text-teal-700' : 'text-white'}`}
            >
              Health Tracker
            </button>
            <button
              onClick={() => setTab(TAB_RECORDS)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_RECORDS ? 'bg-white text-teal-700' : 'text-white'}`}
            >
              My Records
            </button>
          </div>}
        </div>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto space-y-4">
        {tierError && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {tierError}
            <Button type="button" size="sm" variant="outline" className="ml-3 rounded-xl" onClick={loadLogs}>Retry</Button>
          </div>
        )}
        {/* Privacy Notice */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
          <Lock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            <strong>Privacy Notice:</strong> Prescriptions are saved to your account records. Medi Trust does not diagnose.
          </p>
        </div>

        {/* ── TRACKER TAB ── */}
        {isMockBackend && tab === TAB_TRACKER && (
          <>
            <WeeklyChart logs={logs} />

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Symptoms', count: logs.filter(l => l.log_type === 'symptom').length, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Medicines', count: logs.filter(l => l.log_type === 'medicine').length, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Visits', count: logs.filter(l => l.log_type === 'visit_summary').length, color: 'text-violet-600', bg: 'bg-violet-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            <Button
              onClick={() => setShowAddLog(true)}
              className="w-full h-12 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" /> Add New Log
            </Button>

            {loading ? <p role="status" className="text-center text-gray-400 text-sm py-8">Loading...</p> : loadError ? (
              <DataError message={loadError} onRetry={loadLogs} />
            ) : trackerLogs.length === 0 && (
              <div className="text-center py-10">
                <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No logs yet. Tap "Add New Log" to start tracking.</p>
              </div>
            )}
            {!loading && !loadError && <div className="space-y-3">
              {trackerLogs.map(log => (
                <LogCard key={log.id} log={log} onDelete={handleDelete} />
              ))}
            </div>}
          </>
        )}

        {/* ── RECORDS TAB ── */}
        {tab === TAB_RECORDS && (
          <>
            {isMockBackend && <StorageUsageBar used={usedBytes} limit={tierInfo.limit} tierLabel={tierInfo.label} />}

            {isMockBackend && features.premiumHealth && tier === 'free' && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="w-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl p-4 flex items-center gap-3 text-white shadow-md"
              >
                <Crown className="w-6 h-6 flex-shrink-0" />
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">Upgrade for more storage</p>
                  <p className="text-xs text-white/80">Pro ₹99 (1 GB) · Elite ₹150 (10 GB)</p>
                </div>
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {isMockBackend && <div className="relative">
              <Button
                onClick={() => storageFull && features.premiumHealth ? setShowUpgrade(true) : setShowUpload(true)}
                disabled={storageFull && !features.premiumHealth}
                className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl font-semibold"
              >
                <Upload className="w-5 h-5 mr-2" /> {storageFull && features.premiumHealth ? 'Storage Full — Upgrade' : storageFull ? 'Storage Full' : 'Upload New Record'}
              </Button>
              {storageFull && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Lock className="w-5 h-5 text-white/80" />
                </div>
              )}
            </div>}

            {isMockBackend && <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: 'all', label: 'All Records' },
                { key: 'prescription', label: 'Prescriptions' },
                { key: 'lab_report', label: 'Lab Reports' },
                { key: 'visit', label: 'My Visits' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setRecordSection(s.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${recordSection === s.key ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>}

            {loading ? <p role="status" className="text-center text-gray-400 text-sm py-8">Loading...</p> : loadError ? (
              <DataError message={loadError} onRetry={loadLogs} />
            ) : filteredRecords.length === 0 && (
              <div className="text-center py-10">
                <Folder className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No records here yet.</p>
              </div>
            )}
            {!loading && !loadError && <div className="space-y-3">
              {filteredRecords.map(log => (
                <RecordCard key={log.id} log={log} onDelete={handleDelete} />
              ))}
            </div>}
          </>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddLog && (
          <AddLogModal
            userEmail={userEmail}
            onClose={() => setShowAddLog(false)}
            onSave={() => { setShowAddLog(false); loadLogs(); }}
          />
        )}
        {showUpload && (
          <UploadRecordModal
            userEmail={userEmail}
            remainingBytes={remainingBytes}
            storageFull={storageFull}
            onLimitReached={() => { setShowUpload(false); setShowUpgrade(true); }}
            onClose={() => setShowUpload(false)}
            onSave={() => { setShowUpload(false); loadLogs(userEmail); }}
          />
        )}
      </AnimatePresence>

      {features.premiumHealth && (
        <UpgradeSheet
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          currentTier={tier}
          usedBytes={usedBytes}
          onSelect={(plan) => {
            setShowUpgrade(false);
            navigate(createPageUrl('HealthTrackerPremium') + '?tier=' + plan.id);
          }}
        />
      )}
    </div>
  );
}

export default function HealthTracker() {
  return (
    <LanguageProvider>
      <HealthTrackerContent />
    </LanguageProvider>
  );
}