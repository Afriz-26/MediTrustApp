// Supabase adapter. Gives the app the same `db` interface the pages already use,
// but backed by the real Supabase project. Pages are not changed.
//
// Rules this file follows:
//  - Row Level Security (RLS) in the database decides who can see what. This file never
//    tries to enforce security; it only translates shapes (email <-> ids, field names).
//  - Writes that change booking/reservation state go through the database RPCs.
//  - Doctors/pharmacies seen by other users get a synthetic email (<id>@provider.meditrust.app)
//    because real login emails of providers are never exposed to patients.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(URL, KEY, {
  auth: {
    storage: typeof window === 'undefined' ? undefined : window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ───────────────────────── helpers ─────────────────────────
const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Request failed');
  return data;
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYNTH_RE = /^([0-9a-f-]{36})@provider\.meditrust\.app$/i;
const synth = (id) => `${id}@provider.meditrust.app`;
const fromSynth = (email) => (SYNTH_RE.exec(email || '') || [])[1] || null;

export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}
export function parseTime(s) {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(s).trim());
  if (!m) return String(s);
  let h = Number(m[1]);
  const mer = (m[3] || '').toUpperCase();
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}:00`;
}
const tokenLabel = (n) => (n ? `MT-${String(n).padStart(3, '0')}` : undefined);
const dateOnly = (d) => (d ? String(d).slice(0, 10) : null);

const matches = (row, q) =>
  Object.entries(q || {}).every(([k, v]) => {
    if (v === undefined) return true;
    if (k === '$or') return v.some((s) => matches(row, s));
    if (v && typeof v === 'object' && !Array.isArray(v)) return true; // operators not supported: ignore
    return row[k] === v;
  });

const sortLimit = (rows, o, lim) => {
  const opts = typeof o === 'object' && o ? o : { sort: o, limit: lim };
  let out = rows;
  if (opts.sort) {
    const desc = String(opts.sort).startsWith('-');
    const f = String(opts.sort).replace(/^-/, '');
    out = [...rows].sort((a, b) => {
      const x = a[f], y = b[f];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * (desc ? -1 : 1);
    });
  }
  return opts.limit ? out.slice(0, opts.limit) : out;
};

// session + profile cache so `me()` is cheap
let cachedMe = null;
let cachedAt = 0;
supabase.auth.onAuthStateChange(() => { cachedMe = null; cachedAt = 0; ownIds.reset(); });

async function sessionUser() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

async function me() {
  if (cachedMe && Date.now() - cachedAt < 20000) return cachedMe;
  const u = await sessionUser();
  if (!u) return null;
  const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
  cachedMe = {
    id: u.id,
    email: u.email,
    full_name: p?.full_name || u.user_metadata?.full_name || '',
    role: p?.role || u.user_metadata?.role || 'patient',
    user_type: p?.role || 'patient',
  };
  cachedAt = Date.now();
  return cachedMe;
}

// The signed-in user's own doctor / pharmacy row ids (cached per session)
const ownIds = {
  doctor: undefined,
  pharmacy: undefined,
  reset() { this.doctor = undefined; this.pharmacy = undefined; },
  async doctorId() {
    if (this.doctor !== undefined) return this.doctor;
    const u = await sessionUser();
    if (!u) return null;
    const { data } = await supabase.from('doctors').select('id').eq('user_id', u.id).maybeSingle();
    this.doctor = data?.id || null;
    return this.doctor;
  },
  async pharmacyId() {
    if (this.pharmacy !== undefined) return this.pharmacy;
    const u = await sessionUser();
    if (!u) return null;
    const { data } = await supabase.from('pharmacies').select('id').eq('user_id', u.id).maybeSingle();
    this.pharmacy = data?.id || null;
    return this.pharmacy;
  },
};

async function resolveDoctorId(email) {
  const s = fromSynth(email);
  if (s) return s;
  const m = await me();
  if (m && email && email === m.email) return ownIds.doctorId();
  return null;
}
async function resolvePharmacyId(email) {
  const s = fromSynth(email);
  if (s) return s;
  const m = await me();
  if (m && email && email === m.email) return ownIds.pharmacyId();
  return null;
}

// Polling-based "realtime": re-fetch every 30s while the tab is visible, emit create/update/delete events.
function makePoller(entity) {
  return (cb) => {
    let known = null;
    let stopped = false;
    const tick = async () => {
      if (stopped || (typeof document !== 'undefined' && document.hidden)) return;
      try {
        const rows = await entity.list();
        const next = new Map(rows.map((r) => [r.id, JSON.stringify(r)]));
        if (known) {
          rows.forEach((r) => {
            if (!known.has(r.id)) cb({ type: 'create', data: r });
            else if (known.get(r.id) !== next.get(r.id)) cb({ type: 'update', data: r });
          });
          known.forEach((_v, id) => { if (!next.has(id)) cb({ type: 'delete', data: { id } }); });
        }
        known = next;
      } catch (_) { /* ignore transient errors */ }
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => { stopped = true; clearInterval(t); };
  };
}

function entity(impl) {
  const e = {
    list: async (o, lim) => sortLimit(await impl.readAll(), o, lim),
    filter: async (q = {}, o, lim) => sortLimit((await (impl.readFiltered ? impl.readFiltered(q, o, lim) : impl.readAll())).filter((r) => matches(r, q)), o, lim),
    get: async (id) => (await impl.readAll()).find((r) => r.id === id) || null,
    create: async (data) => impl.create(data),
    update: async (id, data) => impl.update(id, data),
    delete: async (id) => (impl.remove ? impl.remove(id) : {}),
    deleteSession: async (id) => {
      if (!impl.deleteSession) throw new Error('Deleting chat sessions is not supported by this backend.');
      return impl.deleteSession(id);
    },
    updateMany: async (q, data) => {
      const rows = await e.filter(q);
      for (const r of rows) await impl.update(r.id, data);
      return { updated: rows.length };
    },
  };
  e.subscribe = makePoller(e);
  return e;
}

// Entities that exist in the app but are not part of v1 (flags off): empty and harmless.
const inertEntity = () => entity({
  readAll: async () => [],
  create: async (d) => ({ id: `local_${Date.now()}`, created_date: new Date().toISOString(), ...d }),
  update: async (id, d) => ({ id, ...d }),
});

// ───────────────────────── subscriptions (active dates for providers) ─────────────────────────
async function activeUntilByUser() {
  const { data } = await supabase.from('subscriptions').select('provider_user_id, starts_at, ends_at');
  const now = Date.now();
  const map = new Map();
  (data || []).forEach((s) => {
    if (new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() >= now) {
      const prev = map.get(s.provider_user_id);
      if (!prev || new Date(s.ends_at) > new Date(prev)) map.set(s.provider_user_id, s.ends_at);
    }
  });
  return map;
}

// ───────────────────────── UserProfile ─────────────────────────
const profileFromRows = (p, pd) => ({
  id: p.id, email: p.email, name: p.full_name || '', full_name: p.full_name || '', user_type: p.role,
  phone: p.phone || '', city: p.city || '', state: p.state || '', lat: p.lat, lng: p.lng,
  preferred_language: p.language || 'en',
  gender: pd?.gender || '', blood_group: pd?.blood_group || '', date_of_birth: pd?.date_of_birth || '',
  allergies: pd?.allergies || [], medical_history: pd?.medical_history || [],
  created_date: p.created_at,
});

const UserProfile = entity({
  readAll: async () => {
    const rows = unwrap(await supabase.from('profiles').select('*, patient_details(*)').limit(1000));
    return rows.map((p) => profileFromRows(p, Array.isArray(p.patient_details) ? p.patient_details[0] : p.patient_details));
  },
  create: async (data) => {
    const m = await me();
    return UserProfile.update(m.id, data);
  },
  update: async (id, data) => {
    // Pages save the chosen location as location_lat/location_lng; store them as the profile's lat/lng.
    data = { ...data, ...(data.location_lat !== undefined ? { lat: data.location_lat, lng: data.location_lng } : {}) };
    const prof = {};
    if (data.name !== undefined || data.full_name !== undefined) prof.full_name = data.name ?? data.full_name;
    ['phone', 'city', 'state', 'lat', 'lng'].forEach((k) => { if (data[k] !== undefined) prof[k] = data[k]; });
    if (data.preferred_language !== undefined) prof.language = data.preferred_language;
    if (Object.keys(prof).length) unwrap(await supabase.from('profiles').update(prof).eq('id', id));

    const det = {};
    ['gender', 'blood_group', 'date_of_birth', 'allergies', 'medical_history'].forEach((k) => {
      if (data[k] !== undefined && data[k] !== '') det[k] = data[k];
    });
    if (Object.keys(det).length) unwrap(await supabase.from('patient_details').upsert({ user_id: id, ...det }));

    // keep a provider's own location in sync with their profile location
    const loc = {};
    ['city', 'state', 'lat', 'lng'].forEach((k) => { if (data[k] !== undefined) loc[k] = data[k]; });
    if (Object.keys(loc).length) {
      await supabase.from('doctors').update(loc).eq('user_id', id);
      await supabase.from('pharmacies').update(loc).eq('user_id', id);
    }
    cachedMe = null;
    return { id, ...data };
  },
});

// ───────────────────────── DoctorProfile ─────────────────────────
const doctorFromRow = (d, { email, activeUntil, isPublic, phone }) => ({
  id: d.id,
  email,
  phone: phone || '',
  name: d.display_name,
  specialization: d.specialization,
  qualification: d.qualification || '',
  experience_years: d.experience_years || 0,
  license_number: d.registration_number || '',
  hospital_name: d.clinic_name || '',
  hospital_address: d.clinic_address || '',
  city: d.city || '', state: d.state || '', lat: d.lat, lng: d.lng,
  consultation_fees: { offline: d.fee_offline ?? null, ...(d.fee_video != null ? { video: d.fee_video } : {}) },
  languages: d.languages || [],
  rating: null,
  walk_in_reserve_pct: d.walk_in_reserve_pct ?? 0,
  is_verified: isPublic ? true : d.verification === 'approved',
  verification_status: isPublic ? 'approved' : d.verification,
  subscription_status: isPublic || activeUntil ? 'active' : 'none',
  subscription_ends_at: activeUntil || null,
  created_date: d.created_at,
});

async function readDoctors() {
  const m = await me();
  const out = new Map();
  const pub = unwrap(await supabase.from('doctors_public').select('*').limit(500));
  pub.forEach((d) => out.set(d.id, doctorFromRow(d, { email: synth(d.id), isPublic: true })));
  if (m && ['doctor', 'admin'].includes(m.role)) {
    const [rows, active] = await Promise.all([
      supabase.from('doctors').select('*, profiles(email, phone)').limit(1000).then(unwrap),
      activeUntilByUser(),
    ]);
    rows.forEach((d) => {
      const email = m.role === 'doctor' ? m.email : (d.profiles?.email || synth(d.id));
      out.set(d.id, doctorFromRow(d, { email, activeUntil: active.get(d.user_id), phone: d.profiles?.phone }));
    });
  }
  return [...out.values()];
}

const doctorToRow = (data) => {
  const r = {};
  if (data.name !== undefined) r.display_name = data.name;
  if (data.specialization !== undefined) r.specialization = data.specialization;
  if (data.qualification !== undefined) r.qualification = data.qualification;
  if (data.experience_years !== undefined) r.experience_years = data.experience_years;
  if (data.license_number !== undefined) r.registration_number = data.license_number;
  if (data.hospital_name !== undefined) r.clinic_name = data.hospital_name;
  if (data.hospital_address !== undefined) r.clinic_address = data.hospital_address;
  ['city', 'state', 'lat', 'lng', 'languages'].forEach((k) => { if (data[k] !== undefined) r[k] = data[k]; });
  if (data.consultation_fees) {
    if (data.consultation_fees.offline !== undefined) r.fee_offline = data.consultation_fees.offline;
    if (data.consultation_fees.video) r.fee_video = data.consultation_fees.video;
  }
  if (data.walk_in_reserve_pct !== undefined) r.walk_in_reserve_pct = data.walk_in_reserve_pct;
  if (data.verification_status !== undefined) r.verification = data.verification_status;
  else if (data.is_verified === true) r.verification = 'approved';
  return r;
};

const DoctorProfile = entity({
  readAll: readDoctors,
  create: async (data) => {
    const m = await me();
    const { data: p } = await supabase.from('profiles').select('city,state,lat,lng').eq('id', m.id).maybeSingle();
    const row = { ...doctorToRow(data), user_id: m.id };
    ['city', 'state', 'lat', 'lng'].forEach((k) => { if (row[k] == null && p?.[k] != null) row[k] = p[k]; });
    delete row.verification; // set by the database
    const created = unwrap(await supabase.from('doctors').insert(row).select().single());
    ownIds.reset();
    return { ...data, id: created.id };
  },
  update: async (id, data) => {
    const row = doctorToRow(data);
    if (Object.keys(row).length) unwrap(await supabase.from('doctors').update(row).eq('id', id));
    return { id, ...data };
  },
});

// ───────────────────────── PharmacyProfile ─────────────────────────
const pharmacyFromRow = (p, { email, activeUntil, isPublic }) => ({
  id: p.id, email, name: p.name, owner_name: p.owner_name || '',
  license_number: p.license_number || '',
  address: p.address || '', city: p.city || '', state: p.state || '', lat: p.lat, lng: p.lng,
  phone: p.phone || '', operating_hours: p.operating_hours || '', rating: null,
  is_verified: isPublic ? true : p.verification === 'approved',
  verification_status: isPublic ? 'approved' : p.verification,
  subscription_status: isPublic || activeUntil ? 'active' : 'none',
  subscription_ends_at: activeUntil || null,
  created_date: p.created_at,
});

async function readPharmacies() {
  const m = await me();
  const out = new Map();
  const pub = unwrap(await supabase.from('pharmacies_public').select('*').limit(500));
  pub.forEach((p) => out.set(p.id, pharmacyFromRow(p, { email: synth(p.id), isPublic: true })));
  if (m && ['pharmacy', 'admin'].includes(m.role)) {
    const [rows, active] = await Promise.all([
      supabase.from('pharmacies').select('*, profiles(email)').limit(1000).then(unwrap),
      activeUntilByUser(),
    ]);
    rows.forEach((p) => {
      const email = m.role === 'pharmacy' ? m.email : (p.profiles?.email || synth(p.id));
      out.set(p.id, pharmacyFromRow(p, { email, activeUntil: active.get(p.user_id) }));
    });
  }
  return [...out.values()];
}

const pharmacyToRow = (data) => {
  const r = {};
  if (data.name !== undefined) r.name = data.name;
  if (data.owner_name !== undefined) r.owner_name = data.owner_name;
  if (data.license_number !== undefined) r.license_number = data.license_number;
  ['address', 'city', 'state', 'lat', 'lng', 'phone', 'operating_hours'].forEach((k) => { if (data[k] !== undefined) r[k] = data[k]; });
  if (data.verification_status !== undefined) r.verification = data.verification_status;
  else if (data.is_verified === true) r.verification = 'approved';
  return r;
};

const PharmacyProfile = entity({
  readAll: readPharmacies,
  create: async (data) => {
    const m = await me();
    const { data: p } = await supabase.from('profiles').select('city,state,lat,lng').eq('id', m.id).maybeSingle();
    const row = { ...pharmacyToRow(data), user_id: m.id };
    ['city', 'state', 'lat', 'lng'].forEach((k) => { if (row[k] == null && p?.[k] != null) row[k] = p[k]; });
    delete row.verification;
    const created = unwrap(await supabase.from('pharmacies').insert(row).select().single());
    ownIds.reset();
    return { ...data, id: created.id };
  },
  update: async (id, data) => {
    const row = pharmacyToRow(data);
    if (Object.keys(row).length) unwrap(await supabase.from('pharmacies').update(row).eq('id', id));
    return { id, ...data };
  },
});

// ───────────────────────── DoctorSchedule ─────────────────────────
const DoctorSchedule = entity({
  readAll: async () => [],
  readFiltered: async (q) => {
    const docId = await resolveDoctorId(q.doctor_email);
    if (!docId) return [];
    const rows = unwrap(await supabase.from('doctor_schedules').select('*').eq('doctor_id', docId));
    if (!rows.length) return [];
    const { data: doc } = await supabase.from('doctors').select('walk_in_reserve_pct').eq('id', docId).maybeSingle();
    const days = [...new Set(rows.map((r) => r.weekday))].sort((a, b) => a - b);
    const first = rows.filter((r) => r.weekday === days[0]).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    const [am, pm] = first;
    return [{
      id: docId, doctor_email: q.doctor_email, working_days: days,
      morning_start: String(am.start_time).slice(0, 5), morning_end: String(am.end_time).slice(0, 5),
      evening_start: pm ? String(pm.start_time).slice(0, 5) : '', evening_end: pm ? String(pm.end_time).slice(0, 5) : '',
      slot_duration_minutes: am.slot_minutes, max_per_slot: 1, daily_token_start: 1,
      walk_in_reserve_pct: doc?.walk_in_reserve_pct ?? 0, is_active: true, blocked_dates: [],
    }];
  },
  create: async (data) => DoctorSchedule.update(null, data),
  update: async (_id, data) => {
    const docId = await ownIds.doctorId();
    if (!docId) throw new Error('Complete your doctor profile before setting a schedule.');
    const rows = [];
    (data.working_days || []).forEach((wd) => {
      if (data.morning_start && data.morning_end) rows.push({ doctor_id: docId, weekday: wd, start_time: parseTime(data.morning_start), end_time: parseTime(data.morning_end), slot_minutes: data.slot_duration_minutes || 30 });
      if (data.evening_start && data.evening_end) rows.push({ doctor_id: docId, weekday: wd, start_time: parseTime(data.evening_start), end_time: parseTime(data.evening_end), slot_minutes: data.slot_duration_minutes || 30 });
    });
    unwrap(await supabase.from('doctor_schedules').delete().eq('doctor_id', docId));
    if (rows.length) unwrap(await supabase.from('doctor_schedules').insert(rows));
    if (data.walk_in_reserve_pct !== undefined) unwrap(await supabase.from('doctors').update({ walk_in_reserve_pct: data.walk_in_reserve_pct }).eq('id', docId));
    return { id: docId, ...data };
  },
});

// ───────────────────────── Appointment ─────────────────────────
const apptFromRow = (r, m, myDocId) => ({
  id: r.id,
  patient_id: r.patient_id,
  patient_email: r.patient_email, patient_name: r.patient_name || '',
  doctor_id: r.doctor_id,
  doctor_email: myDocId && r.doctor_id === myDocId ? m.email : synth(r.doctor_id),
  doctor_name: r.doctor_name, specialization: r.specialization,
  appointment_type: r.mode, date: r.appt_date, time_slot: fmtTime(r.slot_time),
  status: r.status, token_number: tokenLabel(r.token_no), fee: r.fee_at_booking ?? null,
  payment_status: r.payment_status === 'paid' ? 'paid' : 'unpaid', notes: r.notes || '',
  onboarding_status: 'onboarded', created_date: r.created_at,
});

const Appointment = entity({
  readAll: async () => {
    const [m, myDocId] = await Promise.all([me(), ownIds.doctorId()]);
    if (!m) return [];
    const rows = unwrap(await supabase.from('v_appointments').select('*').order('created_at', { ascending: false }).limit(500));
    return rows.map((r) => apptFromRow(r, m, myDocId));
  },
  readFiltered: async (q) => {
    // A patient checking another doctor's free slots: only slot times are visible, never other patients' data.
    const other = fromSynth(q.doctor_email);
    if (other && q.date) {
      const slots = unwrap(await supabase.rpc('taken_slots', { p_doctor: other, p_date: q.date }));
      return (slots || []).map((t, i) => ({ id: `slot_${i}`, doctor_email: q.doctor_email, date: q.date, time_slot: fmtTime(t), status: 'pending' }));
    }
    return Appointment.list();
  },
  create: async (data) => {
    if (data.onboarding_status === 'pending_onboard' || String(data.doctor_email || '').startsWith('osm_')) {
      // Provider is not on MediTrust yet: the "request" is recorded through ProviderRequest instead.
      return { id: `request_${Date.now()}`, ...data };
    }
    const doctorId = await resolveDoctorId(data.doctor_email);
    if (!doctorId) throw new Error('This doctor is not available for booking.');
    const id = unwrap(await supabase.rpc('book_appointment', {
      p_doctor: doctorId, p_date: data.date, p_slot: parseTime(data.time_slot),
      p_mode: data.appointment_type === 'video' ? 'video' : 'offline', p_notes: data.notes || null,
    }));
    return { id, ...data, status: 'pending' };
  },
  update: async (id, data) => {
    if (data.status && UUID_RE.test(id)) {
      unwrap(await supabase.rpc('update_appointment_status', { p_id: id, p_new: data.status }));
    }
    return { id, ...data };
  },
});

// ───────────────────────── Prescription ─────────────────────────
const Prescription = entity({
  readAll: async () => {
    const [m, myDocId] = await Promise.all([me(), ownIds.doctorId()]);
    if (!m) return [];
    const rows = unwrap(await supabase.from('v_prescriptions').select('*').order('created_at', { ascending: false }).limit(500));
    return rows.map((r) => ({
      id: r.id, appointment_id: r.appointment_id,
      patient_email: r.patient_email, patient_name: r.patient_name || '',
      doctor_email: myDocId && r.doctor_id === myDocId ? m.email : synth(r.doctor_id),
      doctor_name: r.doctor_name, doctor_specialization: r.doctor_specialization || '', doctor_license: r.doctor_license || '',
      doctor_qualification: r.doctor_qualification || '', doctor_clinic: r.doctor_clinic || '',
      doctor_clinic_address: r.doctor_clinic_address || '', doctor_city: r.doctor_city || '',
      diagnosis: r.diagnosis || '', medicines: r.items || [], additional_notes: r.notes || '',
      pharmacy_status: 'pending', created_date: r.created_at,
    }));
  },
  create: async (data) => {
    const docId = await ownIds.doctorId();
    if (!docId) throw new Error('Only a doctor can write prescriptions.');
    const appts = await Appointment.filter({ patient_email: data.patient_email });
    const usable = appts
      .filter((a) => ['confirmed', 'arrived', 'in_consultation', 'completed'].includes(a.status))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (!usable) throw new Error('A prescription needs a confirmed appointment with this patient first.');
    const created = unwrap(await supabase.from('prescriptions').insert({
      appointment_id: usable.id, doctor_id: docId, patient_id: usable.patient_id,
      diagnosis: data.diagnosis || null, items: data.medicines || [], notes: data.additional_notes || null,
    }).select().single());
    return { id: created.id, ...data };
  },
  update: async (id, data) => ({ id, ...data }), // pharmacy_status is tracked on reservations now
});

// ───────────────────────── Notification ─────────────────────────
const Notification = entity({
  readAll: async () => {
    const m = await me();
    if (!m) return [];
    const rows = unwrap(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200));
    return rows.map((n) => ({ id: n.id, user_email: m.email, title: n.title, message: n.message, type: n.type, link: n.link, is_read: n.is_read, created_date: n.created_at }));
  },
  create: async (d) => {
    const m = await me();
    if (!m) throw new Error('Sign in before creating a notification.');
    let userId = d.user_id;
    if (!userId && d.user_email === m.email) userId = m.id;
    if (!userId && d.user_email) {
      const profile = unwrap(await supabase.from('profiles').select('id').eq('email', d.user_email).maybeSingle());
      userId = profile?.id;
    }
    if (!userId) throw new Error('Could not find the account for this notification.');
    unwrap(await supabase.from('notifications').insert({
      user_id: userId,
      title: d.title,
      message: d.message,
      type: d.type || 'general',
      link: d.link || null,
      is_read: Boolean(d.is_read),
    }));
    return { ...d };
  },
  update: async (id, data) => {
    if (data.is_read !== undefined && UUID_RE.test(id)) unwrap(await supabase.from('notifications').update({ is_read: data.is_read }).eq('id', id));
    return { id, ...data };
  },
  remove: async (id) => { if (UUID_RE.test(id)) unwrap(await supabase.from('notifications').delete().eq('id', id)); return {}; },
});

// ───────────────────────── Medicine + PharmacyInventory ─────────────────────────
const medicineFromRow = (r) => ({
  id: r.id, name: r.name, generic_name: r.generic_name || '', strength: r.strength || '', form: r.form || '',
  manufacturer: r.manufacturer || '', rx_only: r.rx_only, prescription_required: r.rx_only,
  source: r.source || 'catalog', reviewed: r.reviewed !== false, created_date: r.created_at,
});

const Medicine = entity({
  readAll: async () => unwrap(await supabase.from('medicines').select('*').order('name').limit(2000)).map(medicineFromRow),
  // A pharmacy can add a medicine that is missing from the list. The database always saves it as prescription-only
  // until an admin reviews it, so this cannot be used to sell prescription medicines over the counter through the app.
  create: async (d) => {
    const row = {
      name: String(d.name || '').trim(), generic_name: d.generic_name || null, strength: d.strength || null,
      form: d.form || null, manufacturer: d.manufacturer || null,
    };
    if (row.name.length < 2) throw new Error('Enter the medicine name.');
    const { data: created, error } = await supabase.from('medicines').insert(row).select().single();
    if (error) {
      throw new Error(/duplicate key|unique/i.test(error.message)
        ? 'This medicine is already in the list. Search for it and add it.'
        : error.message);
    }
    medNames = null; medRx = null; medInfo = null; // refresh the name cache
    return medicineFromRow(created);
  },
  update: async (id, d) => ({ id, ...d }),
});

let medNames = null;
let medRx = null;
let medInfo = null;
async function medicineNames() {
  if (!medNames) {
    const rows = unwrap(await supabase.from('medicines').select('id,name,rx_only,strength,form,generic_name').limit(2000));
    medNames = new Map(rows.map((r) => [r.id, r.name]));
    medRx = new Map(rows.map((r) => [r.id, !!r.rx_only]));
    medInfo = new Map(rows.map((r) => [r.id, { strength: r.strength || '', form: r.form || '', generic: r.generic_name || '' }]));
  }
  return medNames;
}

const PharmacyInventory = entity({
  readAll: async () => [],
  readFiltered: async (q) => {
    const pid = await resolvePharmacyId(q.pharmacy_email);
    if (!pid) return [];
    const m = await me();
    const own = (await ownIds.pharmacyId()) === pid;
    const names = await medicineNames();
    const table = own ? 'pharmacy_inventory' : 'inventory_public';
    const rows = unwrap(await supabase.from(table).select('*').eq('pharmacy_id', pid).limit(1000));
    return rows.map((r) => ({
      id: r.id || `${r.pharmacy_id}:${r.medicine_id}`, pharmacy_id: r.pharmacy_id,
      pharmacy_email: own ? m.email : q.pharmacy_email,
      medicine_id: r.medicine_id, medicine_name: names.get(r.medicine_id) || 'Medicine', rx_only: medRx?.get(r.medicine_id) === true,
      medicine_strength: medInfo?.get(r.medicine_id)?.strength || '', medicine_form: medInfo?.get(r.medicine_id)?.form || '', generic_name: medInfo?.get(r.medicine_id)?.generic || '',
      price: r.price, mrp: r.mrp ?? null, in_stock: r.available, stock_quantity: r.stock_quantity ?? null, expiry_date: '',
      last_updated: r.updated_at,
    }));
  },
  create: async (d) => {
    const pid = await ownIds.pharmacyId();
    if (!pid) throw new Error('Complete your pharmacy profile first.');
    const mrp = Number(d.mrp);
    if (!Number.isFinite(mrp) || mrp <= 0) throw new Error('Enter the MRP printed on the pack.');
    const price = d.price === undefined || d.price === null || d.price === '' ? mrp : Number(d.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a valid selling price.');
    if (price > mrp) throw new Error('Your selling price cannot be higher than the MRP.');
    const { data: created, error } = await supabase.from('pharmacy_inventory').insert({
      pharmacy_id: pid, medicine_id: d.medicine_id, available: d.in_stock !== false, price, mrp, stock_quantity: d.stock_quantity ?? null,
    }).select().single();
    if (error) throw new Error(/duplicate key/i.test(error.message) ? 'This medicine is already in your stock list.' : error.message);
    return { ...d, id: created.id, pharmacy_id: pid, price, mrp };
  },
  update: async (id, d) => {
    const row = { updated_at: new Date().toISOString() };
    if (d.mrp !== undefined) row.mrp = d.mrp;
    if (d.price !== undefined) row.price = d.price === '' ? null : d.price;
    if (d.in_stock !== undefined) row.available = d.in_stock;
    if (d.stock_quantity !== undefined) row.stock_quantity = d.stock_quantity;
    const { error: updateError } = await supabase.from('pharmacy_inventory').update(row).eq('id', id);
    if (updateError) {
      throw new Error(/inventory_price_within_mrp/.test(updateError.message)
        ? 'Your selling price cannot be higher than the MRP.'
        : updateError.message);
    }
    return { id, ...d };
  },
  remove: async (id) => { unwrap(await supabase.from('pharmacy_inventory').delete().eq('id', id)); return {}; },
});

// ───────────────────────── MedicinePreOrder (= pickup reservations) ─────────────────────────
const MedicinePreOrder = entity({
  readAll: async () => {
    const rows = unwrap(await supabase.from('v_reservations').select('*').order('created_at', { ascending: false }).limit(500));
    return rows.map((r) => {
      const meds = (r.items || []).map((i) => ({ medicine_id: i.medicine_id, medicine_name: i.medicine_name, quantity: i.quantity, price: i.price, stock_status: 'in_stock' }));
      return {
        id: r.id, pharmacy_id: r.pharmacy_id, patient_email: r.patient_email, patient_name: r.patient_name || '', patient_phone: r.patient_phone || '',
        pharmacy_name: r.pharmacy_name, osm_name: r.pharmacy_name, osm_address: r.pharmacy_address || '', osm_lat: r.lat, osm_lng: r.lng,
        order_type: 'pickup', preferred_date: dateOnly(r.pickup_date), preferred_time_slot: '', medicines: meds,
        total_amount: meds.length && meds.every((item) =>
          item.price != null && item.price !== '' && Number.isFinite(Number(item.price)))
          ? meds.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
          : null,
        status: r.status, pharmacy_notes: '', onboarding_status: 'onboarded', payment_status: 'unpaid', created_date: r.created_at,
      };
    });
  },
  create: async (d) => {
    let query = supabase.from('pharmacies_public').select('id,name,address');
    if (d.pharmacy_id) query = query.eq('id', d.pharmacy_id);
    else query = query.eq('name', d.pharmacy_name);
    const pubs = unwrap(await query);
    const pick = d.pharmacy_id
      ? pubs[0]
      : pubs.find((p) => (p.address || '') === (d.osm_address || '')) || (pubs.length === 1 ? pubs[0] : null);
    if (!pick) throw new Error('This pharmacy is not accepting reservations yet.');
    const note = [d.preferred_time_slot && `Preferred time: ${d.preferred_time_slot}`].filter(Boolean).join(' ') || null;
    // Attach the patient's most recent prescription; the database only accepts it for prescription-only medicines if it is real, theirs and under 30 days old.
    const prescriptions = await Prescription.list();
    const latestRx = prescriptions.length ? prescriptions[0].id : null;
    const id = unwrap(await supabase.rpc('reserve_medicines', {
      p_pharmacy: pick.id,
      p_items: (d.medicines || []).map((m) => ({ medicine_id: m.medicine_id, quantity: m.quantity })),
      p_pickup_date: d.preferred_date || null, p_note: note, p_prescription: latestRx,
    }));
    return { id, ...d, status: 'pending' };
  },
  update: async (id, d) => {
    if (!d.status) throw new Error('Only reservation status changes are supported by the server.');
    if (!UUID_RE.test(id)) throw new Error('This reservation cannot be updated because it has no server record.');
    unwrap(await supabase.rpc('update_reservation_status', { p_id: id, p_new: d.status }));
    return { id, ...d };
  },
});

// ───────────────────────── ProviderRequest (patients asking a clinic/pharmacy to join) ─────────────────────────
const LEAD_FROM_APP = { pending: 'new', contacted: 'called', approved: 'verified', onboarded: 'live', rejected: 'declined' };
const LEAD_TO_APP = {
  new: 'pending', called: 'contacted', interested: 'invited', docs_received: 'invited',
  verified: 'invited', live: 'onboarded', declined: 'rejected',
};
const LEAD_VALID = ['new', 'called', 'interested', 'docs_received', 'verified', 'live', 'declined'];

const ProviderRequest = entity({
  readAll: async () => {
    const m = await me();
    if (m?.role === 'admin') {
      const rows = unwrap(await supabase.from('onboarding_leads').select('*').order('created_at', { ascending: false }).limit(500));
      return rows.map((l) => ({
        id: l.id, request_type: l.provider_type, name: l.name, osm_name: l.name, phone: l.phone || '', address: l.address || '', osm_address: l.address || '', city: l.city || '',
        osm_id: l.osm_id, external_provider_id: l.osm_id, lat: l.lat, lng: l.lng, tags: { specialization: l.specialization },
        status: LEAD_TO_APP[l.status] || l.status, notes: l.notes || '', linked_provider_id: l.doctor_id || l.pharmacy_id || null, created_date: l.created_at,
      }));
    }
    const rows = unwrap(await supabase.from('v_my_requests').select('*').limit(500));
    return rows.map((l) => ({
      id: l.id, request_type: l.provider_type, name: l.name, osm_id: l.osm_id, external_provider_id: l.osm_id,
      requested_by_email: m?.email, status: LEAD_TO_APP[l.status] || l.status, created_date: l.created_at,
    }));
  },
  create: async (d) => {
    const id = unwrap(await supabase.rpc('request_provider', {
      p_type: d.request_type || d.type, p_name: d.osm_name || d.name, p_osm_id: d.osm_id ? String(d.osm_id) : null, p_phone: d.phone || null,
      p_address: d.osm_address || d.address || null, p_city: d.city || null, p_specialization: d.osm_tags?.specialization || d.tags?.specialization || null,
      p_lat: d.osm_lat ?? d.lat ?? null, p_lng: d.osm_lng ?? d.lng ?? null,
    }));
    return { id, ...d };
  },
  update: async (id, d) => {
    const raw = d.status;
    const status = LEAD_VALID.includes(raw) ? raw : LEAD_FROM_APP[raw];
    const row = {};
    if (status) row.status = status;
    if (d.notes !== undefined) row.notes = d.notes;
    if (Object.keys(row).length) unwrap(await supabase.from('onboarding_leads').update(row).eq('id', id));
    return { id, ...d };
  },
});

// ───────────────────────── Subscription (plan requests, admin activates) ─────────────────────────
const SubscriptionBase = entity({
  readAll: async () => {
    const m = await me();
    if (!m) return [];
    const rows = unwrap(await supabase.from('subscription_requests').select('*, profiles(email)').order('created_at', { ascending: false }).limit(500));
    return rows.map((s) => ({
      id: s.id, provider_email: s.profiles?.email || m.email, provider_type: s.provider_type, tier: s.tier, amount: s.amount,
      billing_cycle: s.billing_cycle, status: s.status, start_date: dateOnly(s.starts_at) || '', end_date: dateOnly(s.ends_at) || '',
      payment_id: s.payment_ref ? `manual:${s.payment_ref}` : '', created_date: s.created_at,
    }));
  },
  create: async (d) => {
    const m = await me();
    const created = unwrap(await supabase.from('subscription_requests').insert({
      provider_user_id: m.id, provider_type: d.provider_type, tier: d.tier, billing_cycle: d.billing_cycle || 'monthly', amount: d.amount ?? null,
    }).select().single());
    return { id: created.id, ...d, status: 'pending' };
  },
  update: async (id, d) => {
    if (d.status === 'active') {
      const ref = String(d.payment_id || '').replace(/^manual:/, '');
      unwrap(await supabase.rpc('activate_subscription', { p_request: id, p_ref: ref }));
    }
    return { id, ...d };
  },
});

// ───────────────────────── ChatMessage (assistant history) ─────────────────────────
// Plans an admin activated directly (not through a request) also count as the provider's current plan.
const Subscription = entity({
  readAll: async () => {
    const requests = await SubscriptionBase.list();
    const m = await me();
    if (!m) return requests;
    const { data: subs } = await supabase.from('subscriptions').select('*');
    const rows = subs || [];
    const ids = [...new Set(rows.map((r) => r.provider_user_id))];
    const emails = new Map();
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,email').in('id', ids);
      (profs || []).forEach((p) => emails.set(p.id, p.email));
    }
    const covered = new Set(requests.filter((r) => r.status === 'active').map((r) => `${r.provider_email}|${String(r.payment_id).replace(/^manual:/, '')}`));
    const extra = rows
      .map((s) => ({
        id: s.id, provider_email: emails.get(s.provider_user_id) || m.email, provider_type: m.role === 'pharmacy' ? 'pharmacy' : 'doctor',
        tier: s.plan, amount: null, billing_cycle: 'monthly',
        status: new Date(s.ends_at) > new Date() ? 'active' : 'expired',
        start_date: dateOnly(s.starts_at) || '', end_date: dateOnly(s.ends_at) || '', payment_id: s.payment_ref ? `manual:${s.payment_ref}` : '',
        created_date: s.created_at,
      }))
      .filter((r) => !covered.has(`${r.provider_email}|${String(r.payment_id).replace(/^manual:/, '')}`));
    return [...requests, ...extra];
  },
  create: (d) => SubscriptionBase.create(d),
  update: (id, d) => SubscriptionBase.update(id, d),
});

async function sessionUuid(sessionId) {
  if (UUID_RE.test(sessionId)) return sessionId;
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(String(sessionId)));
  const h = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const ChatMessage = entity({
  readAll: async () => {
    const m = await me();
    if (!m) return [];
    const [msgs, sessions] = await Promise.all([
      supabase.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(1000).then(unwrap),
      supabase.from('chat_sessions').select('*').limit(500).then(unwrap),
    ]);
    const out = msgs.map((r) => ({ id: r.id, session_id: r.session_id, user_email: m.email, role: r.role, content: r.content, is_title: false, created_date: r.created_at }));
    sessions.filter((s) => s.title).forEach((s) => out.push({ id: `title_${s.id}`, session_id: s.id, user_email: m.email, role: 'assistant', content: s.title, is_title: true, created_date: s.created_at }));
    return out;
  },
  readFiltered: async (q, options, limit) => {
    const m = await me();
    if (!m || (q.user_email && q.user_email !== m.email)) return [];
    const opts = typeof options === 'object' && options ? options : { sort: options, limit };
    const descending = !opts.sort || String(opts.sort).startsWith('-');
    let messageQuery = supabase.from('chat_messages').select('*').eq('user_id', m.id);
    if (q.session_id) messageQuery = messageQuery.eq('session_id', await sessionUuid(q.session_id));
    const messages = unwrap(await messageQuery
      .order('created_at', { ascending: !descending })
      .limit(opts.limit || 1000));
    const rows = messages.map((r) => ({
      id: r.id, session_id: q.session_id || r.session_id, user_email: m.email,
      role: r.role, content: r.content, is_title: false, created_date: r.created_at,
    }));
    if (!q.session_id) {
      const sessions = unwrap(await supabase.from('chat_sessions').select('*')
        .eq('user_id', m.id).order('created_at', { ascending: false }).limit(opts.limit || 100));
      sessions.filter((s) => s.title).forEach((s) => rows.push({
        id: `title_${s.id}`, session_id: s.id, user_email: m.email,
        role: 'assistant', content: s.title, is_title: true, created_date: s.created_at,
      }));
    }
    return rows;
  },
  create: async (d) => {
    const m = await me();
    const sid = await sessionUuid(d.session_id);
    unwrap(await supabase.from('chat_sessions').upsert({ id: sid, user_id: m.id }, { onConflict: 'id', ignoreDuplicates: true }));
    if (d.is_title) {
      unwrap(await supabase.from('chat_sessions').update({ title: d.content }).eq('id', sid));
    }
    const created = unwrap(await supabase.from('chat_messages').insert({ session_id: sid, user_id: m.id, role: d.role, content: d.content }).select().single());
    return { id: created.id, ...d };
  },
  deleteSession: async (sessionId) => {
    const m = await me();
    if (!m?.id) throw new Error('Sign in before deleting chat history.');
    const sid = await sessionUuid(sessionId);
    const session = unwrap(await supabase.from('chat_sessions').select('id')
      .eq('user_id', m.id).eq('id', sid).maybeSingle());
    if (!session) return;
    unwrap(await supabase.from('chat_messages').delete()
      .eq('user_id', m.id).eq('session_id', sid));
    const deleted = unwrap(await supabase.from('chat_sessions').delete()
      .eq('user_id', m.id).eq('id', sid).select('id').maybeSingle());
    if (!deleted) throw new Error('The conversation could not be deleted. Check your access and try again.');
  },
  update: async (id, d) => ({ id, ...d }),
  remove: async (id) => {
    if (String(id).startsWith('title_')) return {};
    unwrap(await supabase.from('chat_messages').delete().eq('id', id));
    return {};
  },
});

// ───────────────────────── HealthLog (patient's health records and uploaded files) ─────────────────────────
const HEALTH_BUCKET = 'health-records';
const healthFromRow = (r, email) => ({
  id: r.id, patient_email: email, log_type: 'note', title: r.title || 'Record', description: r.notes || '',
  date: dateOnly(r.created_at), file_url: r.file_path || '', file_type: r.record_type || 'other',
  file_size: Number(r.file_size) || 0, created_date: r.created_at,
});
const HealthLog = entity({
  readAll: async () => {
    const m = await me();
    if (!m) return [];
    const rows = unwrap(await supabase.from('health_records').select('*').eq('patient_id', m.id).order('created_at', { ascending: false }).limit(500));
    return rows.map((r) => healthFromRow(r, m.email));
  },
  create: async (d) => {
    const m = await me();
    if (!m) throw new Error('Sign in before saving a record.');
    const created = unwrap(await supabase.from('health_records').insert({
      patient_id: m.id,
      record_type: ['prescription', 'lab_report', 'other'].includes(d.file_type) ? d.file_type : 'other',
      title: d.title, notes: d.description || null, file_path: d.file_url || null, file_size: d.file_size || 0,
    }).select().single());
    return healthFromRow(created, m.email);
  },
  update: async (id, d) => ({ id, ...d }),
  remove: async (id) => {
    if (!UUID_RE.test(id)) return {};
    const { data: row } = await supabase.from('health_records').select('file_path').eq('id', id).maybeSingle();
    if (row?.file_path) await supabase.storage.from(HEALTH_BUCKET).remove([row.file_path]);
    unwrap(await supabase.from('health_records').delete().eq('id', id));
    return {};
  },
});

// ───────────────────────── entity registry ─────────────────────────
// DirectoryListing: MediTrust's own list of local clinics/pharmacies that are not on the platform yet (fills OpenStreetMap gaps in small towns).
// Business details only (name, phone, address). Everyone signed in can read active ones; only admins can write (enforced by RLS).
const directoryFromRow = (r) => ({
  id: r.id, kind: r.kind, name: r.name, phone: r.phone || '', address: r.address || '', city: r.city || '', state: r.state || '',
  lat: r.lat, lng: r.lng, speciality: r.speciality || '', notes: r.notes || '', is_active: r.is_active, created_date: r.created_at,
});
const directoryToRow = (d) => {
  const r = {};
  ['kind', 'name', 'phone', 'address', 'city', 'state', 'speciality', 'notes', 'is_active'].forEach((k) => {
    if (d[k] !== undefined) r[k] = d[k] === '' ? null : d[k];
  });
  ['lat', 'lng'].forEach((k) => {
    if (d[k] !== undefined) r[k] = d[k] === '' || d[k] === null ? null : Number(d[k]);
  });
  return r;
};
const DirectoryListing = entity({
  readAll: async () => unwrap(await supabase.from('directory_listings').select('*').order('created_at', { ascending: false }).limit(2000)).map(directoryFromRow),
  create: async (d) => directoryFromRow(unwrap(await supabase.from('directory_listings').insert(directoryToRow(d)).select().single())),
  update: async (id, d) => {
    unwrap(await supabase.from('directory_listings').update(directoryToRow(d)).eq('id', id));
    return { id, ...d };
  },
  remove: async (id) => { unwrap(await supabase.from('directory_listings').delete().eq('id', id)); return {}; },
});

const registry = {
  UserProfile, DoctorProfile, PharmacyProfile, DoctorSchedule, Appointment, Prescription, Notification,
  Medicine, PharmacyInventory, MedicinePreOrder, ProviderRequest, Subscription, ChatMessage, DirectoryListing, HealthLog,
};
const entities = new Proxy(registry, {
  get: (t, name) => t[name] || (t[name] = inertEntity()), // Payment, AdBooster, Review, HealthLog, ... (v1: off)
});

// ───────────────────────── auth ─────────────────────────
const auth = {
  isAuthenticated: async () => !!(await sessionUser()),
  me,
  async signUp({ email, password, fullName, role }) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName || '', role: ['doctor', 'pharmacy'].includes(role) ? role : 'patient' } },
    });
    if (error) throw new Error(error.message);
    // If "Confirm email" is on in Supabase, there is no session yet.
    return { needsEmailConfirmation: !data.session, user: data.user };
  },
  async signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    cachedMe = null;
    return me();
  },
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/SignIn` });
    if (error) throw new Error(error.message);
  },
  // True when the signed-in user has finished their profile (so we can skip the onboarding form).
  async isOnboarded() {
    const m = await me();
    if (!m) return false;
    if (m.role === 'doctor') return !!(await ownIds.doctorId());
    if (m.role === 'pharmacy') return !!(await ownIds.pharmacyId());
    if (m.role === 'admin') return true;
    // Patients: onboarding is done once the Onboarding form saved a phone number (a name alone is set at sign-up).
    const { data } = await supabase.from('profiles').select('phone').eq('id', m.id).maybeSingle();
    return !!(data && data.phone);
  },
  // Restores the saved location to this browser after sign-in (e.g. on a new phone).
  async restoreLocation() {
    if (localStorage.getItem('meditrust_location')) return;
    const m = await me();
    if (!m) return;
    const { data: p } = await supabase.from('profiles').select('city,state,lat,lng').eq('id', m.id).maybeSingle();
    if (p && p.lat != null && p.lng != null) {
      localStorage.setItem('meditrust_location', JSON.stringify({
        city: p.city || '', state: p.state || '', country: 'India',
        display: [p.city, p.state].filter(Boolean).join(', '), lat: p.lat, lng: p.lng,
      }));
    }
  },
  async updateMe(data) {
    if (data?.full_name) unwrap(await supabase.from('profiles').update({ full_name: data.full_name }).eq('id', (await sessionUser()).id));
    cachedMe = null;
    return me();
  },
  async logout(redirectTo) {
    await supabase.auth.signOut();
    cachedMe = null;
    ownIds.reset();
    ['meditrust_role', 'meditrust_onboarding_completed'].forEach((k) => localStorage.removeItem(k));
    // Tell the app's AuthContext right away, so it stops treating the user as signed in
    window.dispatchEvent(new Event('meditrust-signed-out'));
    if (redirectTo) window.location.href = redirectTo;
  },
  redirectToLogin: () => { window.location.href = '/SignIn'; },
};

// ───────────────────────── integrations ─────────────────────────
// Calls the "ai" Supabase Edge Function. The Gemini key lives only there; the browser never sees it.
async function invokeAi(payload) {
  let data;
  let error;
  let errorBody = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    ({ data, error } = await supabase.functions.invoke('ai', {
      body: {
        prompt: payload.prompt,
        response_json_schema: payload.response_json_schema,
        max_output_tokens: payload.max_output_tokens,
      },
    }));
    if (!error) break;

    errorBody = null;
    if (error.context && typeof error.context.clone === 'function') {
      try {
        errorBody = await error.context.clone().json();
      } catch {
        // Keep the function error when the response body is not JSON.
      }
    }

    const status = error.context?.status;
    const transientStatus = [500, 502, 503, 504].includes(status);
    const transientNetworkError = !status && error.name === 'FunctionsFetchError';
    if (attempt === 0 && errorBody?.error !== 'no_model' && (transientStatus || transientNetworkError)) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    break;
  }

  if (error) {
    let message = error.message || 'The AI service is unavailable. Please try again.';
    if (errorBody?.error === 'no_model') {
      message = 'The deployed AI service has no available model. Check its Gemini API key and model access.';
    } else if (typeof errorBody?.message === 'string') {
      message = errorBody.message;
    } else if (typeof errorBody?.error === 'string') {
      message = errorBody.error;
    }
    throw new Error(message);
  }
  if (payload.response_json_schema) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('The AI service returned an invalid response.');
    }
    return data;
  }
  if (typeof data?.text !== 'string') {
    throw new Error('The AI service returned an invalid response.');
  }
  return data.text;
}

const integrations = {
  Core: {
    UploadFile: async () => ({ file_url: '' }),
    UploadPrivateFile: async ({ file } = {}) => {
      const u = await sessionUser();
      if (!u) throw new Error('Sign in before uploading a file.');
      if (!file) throw new Error('Choose a file first.');
      if (file.size > 10 * 1024 * 1024) throw new Error('This file is larger than 10 MB. Please choose a smaller file or take a lower-quality photo.');
      const okByType = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/i.test(file.type || '');
      const okByName = /\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(file.name || '');
      if (!okByType && !(file.type === '' && okByName)) throw new Error('Only PDF, JPG, PNG, WEBP or HEIC files can be uploaded.');
      const safe = String(file.name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
      const path = `${u.id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from(HEALTH_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw new Error(error.message || 'The upload failed. Please try again.');
      return { file_uri: path };
    },
    CreateFileSignedUrl: async ({ file_uri, expires_in = 300 } = {}) => {
      if (!file_uri) return { signed_url: '' };
      const { data, error } = await supabase.storage.from(HEALTH_BUCKET).createSignedUrl(file_uri, expires_in);
      if (error) throw new Error(error.message);
      return { signed_url: data.signedUrl };
    },
    // Calls the server function that holds the AI key (added in the next step). Never put an AI key in the browser.
    InvokeLLM: async (payload) => invokeAi(payload),
    _InvokeLLMUnused: async (payload) => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      try {
        const res = await fetch('/.netlify/functions/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`AI service returned ${res.status}`);
        return await res.json();
      } catch (e) {
        console.warn('Assistant service unavailable:', e.message);
        return { response: 'The assistant is not connected yet. Please try again later.', followUps: [] };
      }
    },
  },
};

export const db = {
  auth,
  entities,
  integrations,
  appLogs: { logUserInApp: async () => ({}) },
  functions: { invoke: async () => { throw new Error('Online payments are not enabled yet.'); } },
};
export const base44 = db;
export default db;