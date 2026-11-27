import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Loader2, Search } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Badge } from '@/components/ui/badge';

// Demand report for the admin: which doctors / pharmacies / not-yet-onboarded providers
// patients are asking for, per city, ranked, with an Excel-friendly (CSV) export.
// Patient details appear on screen for the admin only. Exports hide patient identity.

const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'doctor', label: 'Doctors on MediTrust' },
  { id: 'pharmacy', label: 'Pharmacies on MediTrust' },
  { id: 'lead', label: 'Not onboarded yet' },
];
const PERIODS = [
  { id: 0, label: 'All time' },
  { id: 7, label: 'Last 7 days' },
  { id: 30, label: 'Last 30 days' },
  { id: 90, label: 'Last 90 days' },
];

const titleCase = (s = '') => s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '');
const maskName = (n = '') => {
  const parts = String(n).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Patient';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
};
const maskPhone = (p = '') => {
  const d = String(p).replace(/\D/g, '');
  return d.length >= 4 ? `XXXXXX${d.slice(-4)}` : '';
};

function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminDemand() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState(null);
  const [city, setCity] = useState('');
  const [kind, setKind] = useState('all');
  const [days, setDays] = useState(0);
  const [ask, setAsk] = useState('');
  const [understood, setUnderstood] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const q = (table, cols) => supabase.from(table).select(cols).limit(5000);
        const [appts, docs, res, pharms, leads, reqs, profs] = await Promise.all([
          q('appointments', 'id,patient_id,doctor_id,status,notes,created_at'),
          q('doctors', 'id,user_id,display_name,specialization,clinic_name,clinic_address,city'),
          q('reservations', 'id,patient_id,pharmacy_id,status,note,created_at'),
          q('pharmacies', 'id,user_id,name,address,city'),
          q('onboarding_leads', 'id,provider_type,name,phone,address,city,specialization,status,notes'),
          q('lead_requesters', 'lead_id,patient_id,created_at'),
          q('profiles', 'id,full_name,phone,city,role'),
        ]);
        for (const r of [appts, docs, res, pharms, leads, reqs, profs]) if (r.error) throw r.error;
        if (alive) setRaw({ appts: appts.data, docs: docs.data, res: res.data, pharms: pharms.data, leads: leads.data, reqs: reqs.data, profs: profs.data });
      } catch (e) {
        if (alive) setError(e.message || 'Could not load the report.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Build one entry per provider with all requests made to it.
  const entries = useMemo(() => {
    if (!raw) return [];
    const prof = new Map(raw.profs.map((p) => [p.id, p]));
    const out = [];
    for (const d of raw.docs) {
      const owner = prof.get(d.user_id);
      out.push({
        key: `doctor:${d.id}`, kind: 'doctor', name: d.display_name || 'Doctor',
        city: titleCase(d.city || owner?.city || ''), phone: owner?.phone || '',
        address: [d.clinic_name, d.clinic_address].filter(Boolean).join(', '), speciality: d.specialization || '',
        status: 'On MediTrust',
        requests: raw.appts.filter((a) => a.doctor_id === d.id).map((a) => ({ patientId: a.patient_id, date: a.created_at, status: a.status, reason: a.notes || '' })),
      });
    }
    for (const p of raw.pharms) {
      const owner = prof.get(p.user_id);
      out.push({
        key: `pharmacy:${p.id}`, kind: 'pharmacy', name: p.name || 'Pharmacy',
        city: titleCase(p.city || owner?.city || ''), phone: owner?.phone || '',
        address: p.address || '', speciality: 'Pharmacy', status: 'On MediTrust',
        requests: raw.res.filter((r) => r.pharmacy_id === p.id).map((r) => ({ patientId: r.patient_id, date: r.created_at, status: r.status, reason: r.note || '' })),
      });
    }
    for (const l of raw.leads) {
      out.push({
        key: `lead:${l.id}`, kind: 'lead', name: l.name, city: titleCase(l.city || ''), phone: l.phone || '',
        address: l.address || '', speciality: l.provider_type === 'pharmacy' ? 'Pharmacy' : (l.specialization || 'Doctor / clinic'),
        status: `Not onboarded (${l.status})`,
        requests: raw.reqs.filter((r) => r.lead_id === l.id).map((r) => ({ patientId: r.patient_id, date: r.created_at, status: 'asked for this provider', reason: '' })),
      });
    }
    return out;
  }, [raw]);

  const cities = useMemo(() => [...new Set(entries.map((e) => e.city).filter(Boolean))].sort(), [entries]);
  const patientById = useMemo(() => new Map((raw?.profs || []).map((p) => [p.id, p])), [raw]);

  const ranked = useMemo(() => {
    const since = days ? Date.now() - days * 86400000 : 0;
    return entries
      .filter((e) => (!city || e.city === city) && (kind === 'all' || e.kind === kind))
      .map((e) => {
        const reqs = e.requests.filter((r) => !since || new Date(r.date).getTime() >= since);
        return { ...e, reqs, total: reqs.length, patients: new Set(reqs.map((r) => r.patientId)).size, last: reqs.map((r) => r.date).sort().pop() || '' };
      })
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total || String(b.last).localeCompare(String(a.last)));
  }, [entries, city, kind, days]);

  const totalRequests = ranked.reduce((n, e) => n + e.total, 0);
  const uniquePatients = new Set(ranked.flatMap((e) => e.reqs.map((r) => r.patientId))).size;

  // Simple plain-words search. Not AI: it looks for a city, a type and a time period in the sentence.
  const runAsk = (e) => {
    e?.preventDefault();
    const t = ask.toLowerCase();
    const found = [];
    const c = cities.find((x) => t.includes(x.toLowerCase()));
    setCity(c || ''); if (c) found.push(`city: ${c}`);
    let k = 'all';
    if (/(not on|not onboard|onboard|lead|new provider|not yet)/.test(t)) k = 'lead';
    else if (/pharm|medical|chemist/.test(t)) k = 'pharmacy';
    else if (/doctor|clinic|hospital/.test(t)) k = 'doctor';
    setKind(k); if (k !== 'all') found.push(KINDS.find((x) => x.id === k).label);
    let d = 0;
    const m = t.match(/(\d+)\s*day/);
    if (m) d = Number(m[1]); else if (/week/.test(t)) d = 7; else if (/month/.test(t)) d = 30; else if (/today/.test(t)) d = 1;
    setDays(d); if (d) found.push(`last ${d} day${d > 1 ? 's' : ''}`);
    setSelected(null);
    setUnderstood(found.length ? `Showing: ${found.join(', ')}` : 'No city, type or period found in your words, so showing everything.');
  };

  const exportSummary = () => {
    const header = ['Rank', 'Provider', 'Type', 'City', 'Status', 'Phone', 'Address', 'Speciality', 'Requests', 'Different patients', 'Last request'];
    const body = ranked.map((e, i) => [i + 1, e.name, e.kind === 'lead' ? 'Not onboarded' : e.kind, e.city, e.status, e.phone, e.address, e.speciality, e.total, e.patients, fmtDate(e.last)]);
    const filt = [`City: ${city || 'all'}`, `Type: ${KINDS.find((k) => k.id === kind).label}`, `Period: ${PERIODS.find((p) => p.id === days)?.label || `${days} days`}`].join(' | ');
    downloadCsv(`meditrust-demand-${(city || 'all').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
      [['MediTrust demand summary'], [filt], [`Generated ${new Date().toISOString().slice(0, 10)}`], [], header, ...body]);
  };

  const exportProvider = (e) => {
    const header = ['Date', 'Status', 'Reason (written by patient)', 'Patient (shortened)', 'Phone (last 4 digits)'];
    const body = e.reqs.map((r) => {
      const p = patientById.get(r.patientId);
      return [fmtDate(r.date), r.status, r.reason, maskName(p?.full_name), maskPhone(p?.phone)];
    });
    downloadCsv(`meditrust-requests-${String(e.name).replace(/\W+/g, '-').toLowerCase()}.csv`,
      [[`MediTrust request report: ${e.name}`], [`${e.city} | ${e.status}`], [`Total requests: ${e.total}, different patients: ${e.patients}`], [], header, ...body]);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-blue-500 animate-spin" /></div>;
  if (error) return <p className="text-sm text-red-600 py-8 text-center">{error}</p>;

  if (selected) {
    const e = ranked.find((x) => x.key === selected);
    if (!e) return <button onClick={() => setSelected(null)} className="text-sm text-blue-600">Back</button>;
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-sm text-blue-600"><ArrowLeft className="w-4 h-4" /> Back to ranking</button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{e.name}</h2>
              <p className="text-sm text-gray-500">{[e.speciality, e.city, e.status].filter(Boolean).join(' · ')}</p>
              {e.phone && <p className="text-sm text-gray-600 mt-1">Phone: <a className="text-blue-600" href={`tel:${e.phone}`}>{e.phone}</a></p>}
              {e.address && <p className="text-sm text-gray-600">Address: {e.address}</p>}
            </div>
            <button onClick={() => exportProvider(e)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-medium">
              <Download className="w-3.5 h-3.5" /> Download this report (Excel)
            </button>
          </div>
          <p className="text-sm text-gray-700 mt-3"><b>{e.total}</b> requests from <b>{e.patients}</b> different patients</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100"><tr>
              {['Patient', 'Phone', 'Date', 'Status', 'Reason'].map((h) => <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {e.reqs.map((r, i) => {
                const p = patientById.get(r.patientId);
                return (
                  <tr key={i}>
                    <td className="px-4 py-2.5">{p?.full_name || '—'}</td>
                    <td className="px-4 py-2.5">{p?.phone || '—'}</td>
                    <td className="px-4 py-2.5">{fmtDate(r.date)}</td>
                    <td className="px-4 py-2.5 capitalize">{String(r.status).replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.reason || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={runAsk} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <label className="text-sm font-semibold text-gray-800">Ask in plain words</label>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="e.g. doctors in Tirupati last 30 days"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm" />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium">Show</button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Simple search, not AI: it looks for a city, a type (doctor, pharmacy, "not onboarded") and a period (week, month, 30 days) in your words. {understood}
        </p>
      </form>

      <div className="flex gap-2 flex-wrap">
        <select value={city} onChange={(e) => { setCity(e.target.value); setUnderstood(''); }} className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={kind} onChange={(e) => { setKind(e.target.value); setUnderstood(''); }} className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white">
          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <select value={days} onChange={(e) => { setDays(Number(e.target.value)); setUnderstood(''); }} className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white">
          {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          {![0, 7, 30, 90].includes(days) && <option value={days}>Last {days} days</option>}
        </select>
        <button onClick={exportSummary} disabled={!ranked.length} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-medium disabled:opacity-40">
          <Download className="w-3.5 h-3.5" /> Download ranking (Excel)
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Providers asked for', ranked.length], ['Total requests', totalRequests], ['Different patients', uniquePatients]].map(([l, v]) => (
          <div key={l} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-gray-800">{v}</p><p className="text-xs text-gray-500">{l}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {ranked.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">No requests match these filters yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {ranked.map((e, i) => (
              <button key={e.key} onClick={() => setSelected(e.key)} className="w-full text-left px-5 py-3 hover:bg-gray-50 flex items-center gap-3">
                <span className="w-6 text-sm text-gray-400">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{e.name}</p>
                  <p className="text-xs text-gray-500 truncate">{[e.speciality, e.city, e.phone].filter(Boolean).join(' · ')}</p>
                </div>
                <Badge className={`${e.kind === 'lead' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'} text-[10px]`}>{e.status}</Badge>
                <span className="text-xs text-gray-600 whitespace-nowrap">{e.total} requests · {e.patients} patients</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">
        "Reason" is only what the patient typed in their booking note. If they typed nothing it stays empty. Downloads show a shortened patient name and the last 4 phone digits only.
      </p>
    </div>
  );
}
