import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, Pill, CheckCircle, XCircle, Loader2, Search, Phone, Mail, MapPin, AlertTriangle, Navigation } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const PROVIDER_TYPES = [
  { id: 'doctors', label: 'Doctors', icon: Stethoscope, entity: 'DoctorProfile', kind: 'doctor' },
  { id: 'pharmacies', label: 'Pharmacies', icon: Pill, entity: 'PharmacyProfile', kind: 'pharmacy' },
];

const STATUS_FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const statusOf = (p) => p.verification_status || 'pending';

const statusBadge = (status) => {
  const colors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return <Badge className={`${colors[status] || colors.pending} text-[10px] capitalize`}>{status}</Badge>;
};

const daysAgo = (value) => {
  if (!value) return '';
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
};

const formatDate = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
};

// What is still missing from a profile. A doctor without a fee or schedule cannot be booked by patients.
const missingFields = (p, kind) => {
  const missing = [];
  if (kind === 'doctor') {
    if (!p.license_number) missing.push('registration number');
    if (p.consultation_fees?.offline == null) missing.push('consultation fee');
    if (!p.phone) missing.push('phone');
  } else {
    if (!p.license_number) missing.push('licence number');
    if (!p.phone) missing.push('phone');
    if (!p.address) missing.push('address');
  }
  if (p.lat == null || p.lng == null) missing.push('map location');
  return missing;
};

function Detail({ label, children }) {
  if (!children) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm text-gray-700 break-words">{children}</p>
    </div>
  );
}

export default function ProviderManagement() {
  const [activeType, setActiveType] = useState('doctors');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  const config = PROVIDER_TYPES.find((p) => p.id === activeType);

  const load = async () => {
    setLoading(true);
    try {
      const page = await db.entities[config.entity].list({ sort: '-created_date', limit: 300 });
      setProviders(page);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setNotice(''); load(); }, [activeType]);

  const decide = async (p, decision) => {
    const approving = decision === 'approved';
    const question = approving
      ? `Approve ${p.name}?\n\nThe first 10 providers automatically get a free 28-day trial when approved.`
      : `Reject ${p.name}? They will not be shown to patients.`;
    if (!window.confirm(question)) return;
    setUpdating(p.id);
    setNotice('');
    try {
      await db.entities[config.entity].update(p.id, {
        verification_status: decision,
        is_verified: approving,
      });
      setNotice(approving
        ? `${p.name} approved. If a free trial slot was available, their 28 days have started and they were notified.`
        : `${p.name} rejected.`);
      await load();
    } catch (e) {
      alert(`Failed to ${approving ? 'approve' : 'reject'}: ${e.message || 'Unknown error'}`);
    } finally {
      setUpdating(null);
    }
  };

  const counts = providers.reduce((acc, p) => {
    acc[statusOf(p)] = (acc[statusOf(p)] || 0) + 1;
    return acc;
  }, {});

  const filtered = providers.filter((p) => {
    if (statusFilter !== 'all' && statusOf(p) !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [p.name, p.email, p.city, p.phone, p.hospital_name, p.owner_name]
      .some((v) => (v || '').toLowerCase().includes(q));
  });

  const mapsUrl = (p) => (p.lat != null && p.lng != null ? `https://www.google.com/maps?q=${p.lat},${p.lng}` : '');

  return (
    <div className="space-y-4">
      {/* Type tabs */}
      <div className="flex gap-2">
        {PROVIDER_TYPES.map((pt) => (
          <button
            key={pt.id}
            onClick={() => { setActiveType(pt.id); setStatusFilter('pending'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeType === pt.id ? 'bg-slate-800 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <pt.icon className="w-4 h-4" />
            {pt.label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              statusFilter === f.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {f.label}{f.id !== 'all' ? ` (${counts[f.id] || 0})` : ` (${providers.length})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, email or city…"
          className="pl-10 h-11"
        />
      </div>

      {notice && (
        <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">{notice}</div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <config.icon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">{statusFilter === 'pending' ? 'Nothing waiting for approval.' : 'No providers found'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const missing = missingFields(p, config.kind);
            const status = statusOf(p);
            const fee = p.consultation_fees?.offline;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800">{p.name}</h3>
                      {statusBadge(status)}
                      {p.subscription_status === 'active' && (
                        <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                          Plan active{p.subscription_ends_at ? ` until ${formatDate(p.subscription_ends_at)}` : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Signed up {daysAgo(p.created_date)}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {status !== 'approved' && (
                      <button
                        onClick={() => decide(p, 'approved')}
                        disabled={updating === p.id}
                        className="flex items-center gap-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {updating === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Approve
                      </button>
                    )}
                    {status !== 'rejected' && (
                      <button
                        onClick={() => decide(p, 'rejected')}
                        disabled={updating === p.id}
                        className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                    )}
                  </div>
                </div>

                {/* Everything you need to decide */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                  {config.kind === 'doctor' ? (
                    <>
                      <Detail label="Speciality">{(p.specialization || '').replace('_', ' ')}</Detail>
                      <Detail label="Qualification">{p.qualification}</Detail>
                      <Detail label="Registration no.">{p.license_number}</Detail>
                      <Detail label="Experience">{p.experience_years ? `${p.experience_years} years` : ''}</Detail>
                      <Detail label="Clinic / hospital">{p.hospital_name}</Detail>
                      <Detail label="Consultation fee">{fee != null ? `₹${fee}` : ''}</Detail>
                    </>
                  ) : (
                    <>
                      <Detail label="Owner">{p.owner_name}</Detail>
                      <Detail label="Licence no.">{p.license_number}</Detail>
                      <Detail label="Opening hours">{p.operating_hours}</Detail>
                    </>
                  )}
                  <div className="col-span-2">
                    <Detail label="Address">{[config.kind === 'doctor' ? p.hospital_address : p.address, p.city, p.state].filter(Boolean).join(', ')}</Detail>
                  </div>
                </div>

                {/* Contact + location */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {p.phone && (
                    <a href={`tel:${p.phone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 text-xs text-gray-700 hover:bg-gray-100">
                      <Phone className="w-3 h-3" /> {p.phone}
                    </a>
                  )}
                  {p.email && !p.email.endsWith('@provider.meditrust.app') && (
                    <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 text-xs text-gray-700 hover:bg-gray-100 max-w-full truncate">
                      <Mail className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{p.email}</span>
                    </a>
                  )}
                  {mapsUrl(p) && (
                    <a href={mapsUrl(p)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-xs text-blue-700 hover:bg-blue-100">
                      <Navigation className="w-3 h-3" /> View pin on map
                    </a>
                  )}
                </div>

                {missing.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Missing: {missing.join(', ')}. {config.kind === 'doctor' && missing.includes('consultation fee') ? 'Patients cannot book without a fee.' : ''}</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
