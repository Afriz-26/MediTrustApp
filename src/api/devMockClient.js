// DEV-ONLY mock backend (localStorage + sample data) for previewing screens before the real backend exists.
// Use it only when VITE_USE_MOCK=true. Never ship it. Sample names are fake.
import { clearMockUser, getMockUser, setMockUser } from '@/lib/mockSession';

const KEY = 'meditrust_mockdb_v1';
const today = '2026-10-13';
const seed = () => ({
  UserProfile: [{ id: 'u1', email: 'patient@meditrust.local', name: 'Afriz S', user_type: 'patient', city: 'Tirupati', state: 'Andhra Pradesh', preferred_language: 'en' }],
  DoctorProfile: [
    { id: 'd1', email: 'doctor@meditrust.local', name: 'Dr. Sample Rao', specialization: 'orthopedic', qualification: 'MBBS, MS Ortho', experience_years: 12, hospital_name: 'Sample Care Clinic', hospital_address: 'Near Sample Circle, Tirupati', city: 'Tirupati', state: 'Andhra Pradesh', lat: 13.6288, lng: 79.4192, consultation_fees: { offline: 400 }, rating: 4.6, is_verified: true, verification_status: 'approved', subscription_tier: 'basic', subscription_status: 'active', subscription_ends_at: '2027-12-31T23:59:59.999Z', languages: ['English', 'Telugu'] },
    { id: 'd2', email: 'reddy@example.com', name: 'Dr. Sample Reddy', specialization: 'general_physician', qualification: 'MBBS', experience_years: 8, hospital_name: 'Sample Health Centre', hospital_address: 'Main Road, Tirupati', city: 'Tirupati', state: 'Andhra Pradesh', lat: 13.635, lng: 79.425, consultation_fees: { offline: 300 }, rating: 4.4, is_verified: true, verification_status: 'approved', subscription_tier: 'none', subscription_ends_at: null, languages: ['English', 'Telugu', 'Hindi'] },
  ],
  PharmacyProfile: [{ id: 'p1', email: 'pharmacy@meditrust.local', name: 'Sample Pharmacy', address: 'Bazaar Street, Tirupati', city: 'Tirupati', state: 'Andhra Pradesh', lat: 13.63, lng: 79.42, phone: '9000000000', is_verified: true, verification_status: 'approved', subscription_status: 'active', subscription_ends_at: '2027-12-31T23:59:59.999Z', operating_hours: '9 AM - 10 PM', rating: 4.5 }],
  PharmacyInventory: [
    { id: 'i1', pharmacy_email: 'pharmacy@meditrust.local', medicine_id: 'm1', medicine_name: 'Dolo 650', stock_quantity: 20, price: 27, in_stock: true, expiry_date: '2027-06' },
    { id: 'i2', pharmacy_email: 'pharmacy@meditrust.local', medicine_id: 'm2', medicine_name: 'Cetirizine 10mg', stock_quantity: 12, price: 22, in_stock: true, expiry_date: '2027-03' },
  ],
  Appointment: [
    { id: 'a1', patient_email: 'patient@meditrust.local', patient_name: 'Afriz S', doctor_email: 'doctor@meditrust.local', doctor_name: 'Dr. Sample Rao', specialization: 'orthopedic', appointment_type: 'offline', date: '2026-10-15', time_slot: '10:30 AM', status: 'pending', fee: 400, payment_status: 'unpaid', created_date: today },
    { id: 'a2', patient_email: 'patient@meditrust.local', patient_name: 'Afriz S', doctor_email: 'reddy@example.com', doctor_name: 'Dr. Sample Reddy', specialization: 'general_physician', appointment_type: 'offline', date: '2026-10-14', time_slot: '11:00 AM', status: 'confirmed', token_number: 'MT-004', fee: 300, payment_status: 'unpaid', created_date: today },
  ],
  Prescription: [{ id: 'r1', patient_email: 'patient@meditrust.local', patient_name: 'Afriz S', doctor_email: 'reddy@example.com', doctor_name: 'Dr. Sample Reddy', doctor_specialization: 'General Physician', diagnosis: 'Viral fever', medicines: [{ name: 'Dolo 650', dosage: '650 mg', frequency: 'Twice a day', duration: '3 days', instructions: 'After food' }], additional_notes: 'Drink plenty of water. Review if fever lasts over 3 days.', pharmacy_status: 'pending', created_date: today }],
  Notification: [
    { id: 'n1', user_email: 'patient@meditrust.local', title: 'Appointment confirmed', message: 'Dr. Sample Reddy confirmed your visit. Token MT-004.', type: 'booking_confirmed', is_read: false, created_date: today },
    { id: 'n2', user_email: 'patient@meditrust.local', title: 'Prescription ready', message: 'Dr. Sample Reddy added a prescription.', type: 'general', is_read: true, created_date: today },
  ],
  ChatMessage: [], HealthLog: [], MedicinePreOrder: [], ProviderRequest: [], ProviderExternalSource: [], DoctorSchedule: [{ id: 'ds1', doctor_email: 'doctor@meditrust.local', working_days: [1,2,3,4,5,6], morning_start: '09:00', morning_end: '12:00', evening_start: '', evening_end: '', slot_duration_minutes: 30, max_per_slot: 1, daily_token_start: 1, walk_in_reserve_pct: 0, is_active: true, blocked_dates: [] }], Payment: [], Subscription: [], AdBooster: [], Review: [], Medicine: [], HealthTrackerSubscription: [],
});
const load = () => { const r = localStorage.getItem(KEY); if (!r) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; } return JSON.parse(r); };
const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
const match = (row, q) => Object.entries(q || {}).every(([k, v]) => k === '$or' ? v.some((s) => match(row, s)) : (v && typeof v === 'object' && !Array.isArray(v)) ? true : row[k] === v);
let n = 1;
export const db = {
  auth: {
    isAuthenticated: async () => !!getMockUser(), me: async () => getMockUser(),
    isOnboarded: async () => !!getMockUser(),
    logout: (u) => { clearMockUser(); if (u) window.location.href = u; },
    redirectToLogin: () => { window.location.href = '/SignIn'; },
  },
  entities: new Proxy({}, { get: (_t, name) => ({
    filter: async (q = {}, o, lim) => { let rows = (load()[name] || []).filter((r) => match(r, q)); const opts = typeof o === 'object' && o ? o : { sort: o, limit: lim }; if (opts.sort) { const desc = opts.sort.startsWith('-'); const f = opts.sort.replace('-', ''); rows = [...rows].sort((a, b) => (a[f] > b[f] ? 1 : -1) * (desc ? -1 : 1)); } if (opts.limit) rows = rows.slice(0, opts.limit); return rows; },
    subscribe: () => () => {},
    list: async () => load()[name] || [],
    get: async (id) => (load()[name] || []).find((r) => r.id === id) || null,
    create: async (data) => { const d = load(); const row = { id: `${String(name)}_${Date.now()}_${n++}`, created_date: new Date().toISOString(), ...data }; (d[name] = d[name] || []).push(row); save(d); return row; },
    update: async (id, data) => { const d = load(); const i = (d[name] || []).findIndex((r) => r.id === id); if (i >= 0) d[name][i] = { ...d[name][i], ...data }; save(d); return d[name][i]; },
    delete: async (id) => { const d = load(); d[name] = (d[name] || []).filter((r) => r.id !== id); save(d); return {}; },
    deleteSession: async (sessionId) => { const d = load(); d[name] = (d[name] || []).filter((r) => r.session_id !== sessionId); save(d); return {}; },
  }) }),
  appLogs: { logUserInApp: async () => ({}) },
  integrations: { Core: { UploadFile: async () => ({ file_url: '' }), UploadPrivateFile: async () => ({ file_uri: '' }), CreateFileSignedUrl: async () => ({ signed_url: '' }), InvokeLLM: async () => ({ response: 'Demo reply', followUps: [] }) } },
};
export const base44 = db;
export default db;
