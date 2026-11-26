import { db } from '@/api/client';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Loader2, Phone, Search, Mail, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const TITLES = { patients: 'Patients', doctors: 'Doctors', pharmacies: 'Pharmacies' };

const statusColor = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  accepted: 'bg-blue-100 text-blue-700',
  ready: 'bg-violet-100 text-violet-700',
  completed: 'bg-blue-100 text-blue-700',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  no_show: 'bg-gray-100 text-gray-600',
};

// Privacy: exports show a shortened name and only the last 4 digits of the phone.
// Full patient contact details should only be shared once the patient has agreed to that.
const maskName = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
};
const maskPhone = (phone = '') => {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 4 ? `XXXXXX${digits.slice(-4)}` : '';
};

function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '');
const lastActivity = (rows) => rows.map((r) => r.created_date).filter(Boolean).sort().pop() || '';

function Field({ icon: Icon, children }) {
  if (!children) return null;
  return (
    <p className="text-sm text-gray-600 flex items-start gap-2">
      {Icon && <Icon className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-800 text-sm">{title}</h3></div>
      {children}
    </div>
  );
}

function Table({ head, rows, empty }) {
  if (!rows.length) return <p className="px-5 py-8 text-center text-sm text-gray-400">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>{head.map((h) => <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-600">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((cells, i) => (
            <tr key={i} className="hover:bg-gray-50">{cells.map((c, j) => <td key={j} className="px-4 py-2.5 text-gray-700">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const StatusBadge = ({ s }) => (
  <Badge className={`${statusColor[s] || 'bg-gray-100 text-gray-600'} text-[10px] capitalize`}>{String(s || '').replace('_', ' ')}</Badge>
);

export default function AdminPeople({ kind }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ patients: [], doctors: [], pharmacies: [], appointments: [], reservations: [] });
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => { setSelected(null); setQuery(''); }, [kind]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [patients, doctors, pharmacies, appointments, reservations] = await Promise.all([
          db.entities.UserProfile.filter({ user_type: 'patient' }, { limit: 1000 }),
          db.entities.DoctorProfile.list({ limit: 1000 }),
          db.entities.PharmacyProfile.list({ limit: 1000 }),
          db.entities.Appointment.list({ sort: '-created_date', limit: 1000 }),
          db.entities.MedicinePreOrder.list({ sort: '-created_date', limit: 1000 }),
        ]);
        if (alive) setData({ patients, doctors, pharmacies, appointments, reservations });
      } catch (e) {
        if (alive) setError(e.message || 'Could not load data.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const patientByEmail = useMemo(() => new Map(data.patients.map((p) => [p.email, p])), [data.patients]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (...vals) => !q || vals.some((v) => String(v || '').toLowerCase().includes(q));

    if (kind === 'patients') {
      return data.patients
        .map((p) => {
          const appts = data.appointments.filter((a) => a.patient_email === p.email);
          const res = data.reservations.filter((r) => r.patient_email === p.email);
          return { ...p, appts, res, total: appts.length + res.length, last: lastActivity([...appts, ...res]) };
        })
        .filter((p) => match(p.name, p.email, p.phone, p.city))
        .sort((a, b) => b.total - a.total || String(b.last).localeCompare(String(a.last)));
    }
    if (kind === 'doctors') {
      return data.doctors
        .map((d) => {
          const appts = data.appointments.filter((a) => a.doctor_id === d.id);
          return { ...d, appts, pending: appts.filter((a) => a.status === 'pending').length, total: appts.length };
        })
        .filter((d) => match(d.name, d.specialization, d.hospital_name, d.city, d.phone))
        .sort((a, b) => b.pending - a.pending || b.total - a.total);
    }
    return data.pharmacies
      .map((p) => {
        const res = data.reservations.filter((r) => r.pharmacy_id === p.id);
        return { ...p, res, pending: res.filter((r) => r.status === 'pending').length, total: res.length };
      })
      .filter((p) => match(p.name, p.owner_name, p.city, p.phone))
      .sort((a, b) => b.pending - a.pending || b.total - a.total);
  }, [kind, data, query]);

  const exportProvider = (item) => {
    const header = ['Date', 'Status', 'Type', 'Token', 'Patient (shortened)', 'Phone (last 4 digits)'];
    const body = kind === 'doctors'
      ? item.appts.map((a) => [fmtDate(a.date), a.status, a.appointment_type, a.token_number || '', maskName(a.patient_name || a.patient_email), maskPhone(patientByEmail.get(a.patient_email)?.phone)])
      : item.res.map((r) => [fmtDate(r.preferred_date || r.created_date), r.status, 'pickup', '', maskName(r.patient_name || r.patient_email), maskPhone(r.patient_phone)]);
    const title = [[`MediTrust request report: ${item.name}`], [`Generated ${new Date().toISOString().slice(0, 10)}`], [`Total requests: ${body.length}`], []];
    downloadCsv(`meditrust-${kind}-${String(item.name).replace(/\W+/g, '-').toLowerCase()}.csv`, [...title, header, ...body]);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-blue-500 animate-spin" /></div>;
  if (error) return <p className="text-sm text-red-600 py-8 text-center">{error}</p>;

  // ───────── detail view ─────────
  if (selected) {
    const item = [...rows, ...data.patients, ...data.doctors, ...data.pharmacies].find((r) => r.id === selected);
    if (!item) {
      return <button onClick={() => setSelected(null)} className="text-sm text-blue-600">Back to {TITLES[kind]}</button>;
    }
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-sm text-blue-600">
          <ArrowLeft className="w-4 h-4" /> Back to {TITLES[kind]}
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{item.name || item.email}</h2>
              {kind === 'doctors' && <p className="text-sm text-gray-500">{item.specialization}{item.qualification ? ` · ${item.qualification}` : ''}</p>}
              {kind === 'pharmacies' && item.owner_name && <p className="text-sm text-gray-500">Owner: {item.owner_name}</p>}
            </div>
            {kind !== 'patients' && (
              <button onClick={() => exportProvider(item)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-medium">
                <Download className="w-3.5 h-3.5" /> Export request report (CSV)
              </button>
            )}
          </div>
          <Field icon={Phone}>{item.phone && <a className="text-blue-600" href={`tel:${item.phone}`}>{item.phone}</a>}</Field>
          <Field icon={Mail}>{kind !== 'pharmacies' || !String(item.email).endsWith('@provider.meditrust.app') ? item.email : ''}</Field>
          <Field icon={MapPin}>{[kind === 'doctors' ? item.hospital_name : '', kind === 'doctors' ? item.hospital_address : item.address, item.city, item.state].filter(Boolean).join(', ')}</Field>
          {kind === 'doctors' && (
            <div className="text-sm text-gray-600 space-y-1 pt-1">
              <p>Clinic fee: {item.consultation_fees?.offline != null ? `₹${item.consultation_fees.offline}` : 'Not set'}</p>
              <p>Registration no.: {item.license_number || 'Not provided'} · Experience: {item.experience_years || 0} yrs</p>
              <p>Languages: {(item.languages || []).join(', ') || 'Not set'}</p>
            </div>
          )}
          {kind === 'pharmacies' && (
            <div className="text-sm text-gray-600 space-y-1 pt-1">
              <p>Licence no.: {item.license_number || 'Not provided'}</p>
              <p>Hours: {item.operating_hours || 'Not set'}</p>
            </div>
          )}
          {kind === 'patients' && (
            <p className="text-sm text-gray-600">Joined: {fmtDate(item.created_date)}</p>
          )}
          {kind !== 'patients' && (
            <div className="flex gap-2 flex-wrap pt-1">
              <Badge className="bg-slate-100 text-slate-700 text-[10px] capitalize">Verification: {item.verification_status || 'pending'}</Badge>
              <Badge className="bg-slate-100 text-slate-700 text-[10px]">Plan: {item.subscription_status === 'active' ? `active${item.subscription_ends_at ? ` until ${fmtDate(item.subscription_ends_at)}` : ''}` : 'none'}</Badge>
            </div>
          )}
        </div>

        {kind === 'patients' && (
          <>
            <Panel title={`Doctor requests (${item.appts.length})`}>
              <Table head={['Doctor', 'Date', 'Status', 'Token']} empty="No doctor requests yet"
                rows={item.appts.map((a) => [a.doctor_name, fmtDate(a.date), <StatusBadge key={a.id} s={a.status} />, a.token_number || '—'])} />
            </Panel>
            <Panel title={`Medicine reservations (${item.res.length})`}>
              <Table head={['Pharmacy', 'Date', 'Status']} empty="No medicine reservations yet"
                rows={item.res.map((r) => [r.pharmacy_name, fmtDate(r.preferred_date || r.created_date), <StatusBadge key={r.id} s={r.status} />])} />
            </Panel>
          </>
        )}

        {kind === 'doctors' && (
          <Panel title={`Requests to this doctor (${item.appts.length}, ${item.pending} pending)`}>
            <Table head={['Patient', 'Phone', 'Date', 'Status', 'Token']} empty="No requests yet"
              rows={item.appts.map((a) => [a.patient_name || a.patient_email, patientByEmail.get(a.patient_email)?.phone || '—', fmtDate(a.date), <StatusBadge key={a.id} s={a.status} />, a.token_number || '—'])} />
          </Panel>
        )}

        {kind === 'pharmacies' && (
          <Panel title={`Reservations at this pharmacy (${item.res.length}, ${item.pending} pending)`}>
            <Table head={['Patient', 'Phone', 'Date', 'Status']} empty="No reservations yet"
              rows={item.res.map((r) => [r.patient_name || r.patient_email, r.patient_phone || '—', fmtDate(r.preferred_date || r.created_date), <StatusBadge key={r.id} s={r.status} />])} />
          </Panel>
        )}
      </div>
    );
  }

  // ───────── list view ─────────
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-800">{TITLES[kind]} ({rows.length})</h2>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, city"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Nothing here yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map((r) => (
              <button key={r.id} onClick={() => setSelected(r.id)} className="w-full text-left px-5 py-3 hover:bg-gray-50 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{r.name || r.email}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {kind === 'patients' && [r.phone, r.city].filter(Boolean).join(' · ')}
                    {kind === 'doctors' && [r.specialization, r.hospital_name, r.city].filter(Boolean).join(' · ')}
                    {kind === 'pharmacies' && [r.owner_name, r.city, r.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {kind !== 'patients' && r.pending > 0 && <Badge className="bg-amber-100 text-amber-700 text-[10px]">{r.pending} pending</Badge>}
                {kind !== 'patients' && <Badge className={`${r.verification_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'} text-[10px] capitalize`}>{r.verification_status || 'pending'}</Badge>}
                <span className="text-xs text-gray-500 whitespace-nowrap">{r.total} {kind === 'patients' ? 'requests' : 'requests'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
