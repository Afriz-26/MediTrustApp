
import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Stethoscope, Pill,
  Calendar, Package, CreditCard, Bell, ShieldCheck,
  Loader2, AlertCircle, ArrowLeft, TrendingUp, CheckCircle, XCircle, LogOut, MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { LanguageProvider } from '@/components/ui/LanguageContext';
import { Badge } from '@/components/ui/badge';
import ProviderManagement from '@/components/admin/ProviderManagement';
import FinancePanel from '@/components/admin/FinancePanel';
import DirectoryManager from '@/components/admin/DirectoryManager';
import AdminAlerts from '@/components/admin/AdminAlerts';
import AdminPeople from '@/components/admin/AdminPeople';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  { id: 'pharmacies', label: 'Pharmacies', icon: Pill },
  { id: 'providers', label: 'Providers', icon: Stethoscope },
  { id: 'requests', label: 'Requests', icon: Bell },
  { id: 'directory', label: 'Directory', icon: MapPin },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'finance', label: 'Finance', icon: CreditCard },
];

function StatCard({ icon: Icon, label, value, color, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </motion.div>
  );
}

function RequestsPanel({ requests, onUpdate }) {
  const [updating, setUpdating] = useState(null);

  const handleStatus = async (id, status) => {
    setUpdating(id);
    try {
      await db.entities.ProviderRequest.update(id, { status });
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e.message || 'Unknown error'));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-3">
      {requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No provider requests</p>
        </div>
      ) : (
        requests.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-800 text-sm">{r.osm_name || r.name || 'Unnamed provider'}</h3>
                  <Badge className="bg-slate-100 text-slate-600 text-[10px] capitalize">{r.request_type}</Badge>
                  <Badge className={`text-[10px] capitalize ${
                    r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    ['approved', 'onboarded'].includes(r.status) ? 'bg-emerald-100 text-emerald-700' :
                    r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    ['contacted', 'invited'].includes(r.status) ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{r.status}</Badge>
                </div>
                {r.requested_by_email && <p className="text-xs text-gray-500 mt-1">Requested by: {r.requested_by_email}</p>}
                {(r.osm_address || r.address) && <p className="text-xs text-gray-400 mt-0.5">{r.osm_address || r.address}</p>}
                {r.phone ? (
                  <p className="text-xs text-gray-500 mt-1">Phone: <a className="text-blue-600 underline" href={`tel:${r.phone}`}>{r.phone}</a></p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Phone number not listed</p>
                )}
                {(r.city || r.state) && <p className="text-xs text-gray-400">{r.city}{r.state ? `, ${r.state}` : ''}</p>}
                {r.reason && <p className="text-xs text-gray-500 mt-1 italic">"{r.reason}"</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {r.status === 'pending' && (
                  <button
                    onClick={() => handleStatus(r.id, 'contacted')}
                    disabled={updating === r.id}
                    className="flex items-center gap-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {updating === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    Mark contacted
                  </button>
                )}
                {!['rejected', 'onboarded'].includes(r.status) && (
                  <button
                    onClick={() => handleStatus(r.id, 'rejected')}
                    disabled={updating === r.id}
                    className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" />
                    Reject
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function BookingsPanel({ appointments }) {
  const statusColor = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-blue-100 text-blue-700',
    declined: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
    no_show: 'bg-gray-100 text-gray-600',
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {appointments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No appointments</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{a.patient_name || a.patient_email}</td>
                  <td className="px-4 py-3 text-gray-600">{a.doctor_name || a.doctor_email}</td>
                  <td className="px-4 py-3 text-gray-500">{a.date}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{a.appointment_type}</td>
                  <td className="px-4 py-3 text-center"><Badge className={`${statusColor[a.status] || statusColor.pending} text-[10px] capitalize`}>{a.status}</Badge></td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{a.token_number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrdersPanel({ orders }) {
  const statusColor = {
    pending: 'bg-amber-100 text-amber-700',
    accepted: 'bg-blue-100 text-blue-700',
    preparing: 'bg-cyan-100 text-cyan-700',
    ready: 'bg-violet-100 text-violet-700',
    out_for_delivery: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No medicine orders</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pharmacy</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{o.patient_name || o.patient_email}</td>
                  <td className="px-4 py-3 text-gray-600">{o.pharmacy_name || 'External'}</td>
                  <td className="px-4 py-3 text-gray-500">{o.preferred_date}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{o.order_type}</td>
                  <td className="px-4 py-3 text-center"><Badge className={`${statusColor[o.status] || statusColor.pending} text-[10px] capitalize`}>{o.status?.replace('_', ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminDashboardContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [requests, setRequests] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    db.auth.me().then(u => {
      setUser(u);
      if (u?.role === 'admin') loadAll();
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadAll = async () => {
    try {
      const [patPage, docPage, pharmPage, reqPage, apptPage, ordPage, payPage, subPage, boostPage] = await Promise.all([
        db.entities.UserProfile.filter({ user_type: 'patient' }, { limit: 500 }).catch(() => ({ items: [] })),
        db.entities.DoctorProfile.list({ limit: 500 }).catch(() => ({ items: [] })),
        db.entities.PharmacyProfile.list({ limit: 500 }).catch(() => ({ items: [] })),
        db.entities.ProviderRequest.list({ sort: '-created_date', limit: 100 }).catch(() => ({ items: [] })),
        db.entities.Appointment.list({ sort: '-created_date', limit: 100 }).catch(() => ({ items: [] })),
        db.entities.MedicinePreOrder.list({ sort: '-created_date', limit: 100 }).catch(() => ({ items: [] })),
        db.entities.Payment.list({ sort: '-created_date', limit: 200 }).catch(() => ({ items: [] })),
        db.entities.Subscription.list({ sort: '-created_date', limit: 200 }).catch(() => ({ items: [] })),
        db.entities.AdBooster.list({ sort: '-created_date', limit: 200 }).catch(() => ({ items: [] })),
      ]);

      const patients = patPage;
      const doctors = docPage;
      const pharmacies = pharmPage;
      const reqs = reqPage;
      const appts = apptPage;
      const ords = ordPage;
      const payments = payPage;
      const subs = subPage;
      const boosters = boostPage;

      setStats({
        patients: patients.length,
        doctors: doctors.length,
        pharmacies: pharmacies.length,
        requests: reqs.filter((r) => r.status === 'pending').length,
        appointments: appts.length,
        orders: ords.length,
        revenue: payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0),
        activeSubs: subs.filter(s => s.status === 'active').length,
        activeBoosters: boosters.filter(b => b.status === 'active').length,
      });
      setRequests(reqs);
      setAppointments(appts);
      setOrders(ords);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Admin Access Required</h2>
          <p className="text-sm text-gray-500 mb-4">You need an admin account to access this dashboard.</p>
          <Link to="/" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-medium">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-slate-800 to-blue-900 pt-8 pb-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <Link to="/" className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-white" /></Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> Admin Command Center
              </h1>
              <p className="text-white/70 text-sm">{user.full_name || user.email}</p>
              <button
                onClick={async () => { try { await db.auth.logout(); } finally { window.location.href = '/Welcome'; } }}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white border border-white/30 rounded-lg px-3 py-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-0 bg-white border-b border-gray-200 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AdminAlerts onGoProviders={() => setTab('providers')} onGoRequests={() => setTab('requests')} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Patients" value={stats.patients || 0} color="bg-blue-500" onClick={() => setTab('patients')} />
                  <StatCard icon={Stethoscope} label="Doctors" value={stats.doctors || 0} color="bg-emerald-500" onClick={() => setTab('doctors')} />
                  <StatCard icon={Pill} label="Pharmacies" value={stats.pharmacies || 0} color="bg-pink-500" onClick={() => setTab('pharmacies')} />
                  <StatCard icon={Bell} label="Pending Requests" value={stats.requests || 0} color="bg-amber-500" onClick={() => setTab('requests')} />
                  <StatCard icon={Calendar} label="Appointments" value={stats.appointments || 0} color="bg-cyan-500" onClick={() => setTab('bookings')} />
                  <StatCard icon={Package} label="Medicine Orders" value={stats.orders || 0} color="bg-rose-500" onClick={() => setTab('orders')} />
                  <StatCard icon={TrendingUp} label="Revenue (₹)" value={stats.revenue || 0} color="bg-green-600" />
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">Recent Provider Requests</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {requests.slice(0, 5).map(r => (
                      <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{r.osm_name}</p>
                          <p className="text-xs text-gray-500">{r.request_type} · {r.city}, {r.state}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          r.status === 'approved' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{r.status}</span>
                      </div>
                    ))}
                    {requests.length === 0 && <p className="px-5 py-8 text-center text-sm text-gray-400">No requests yet</p>}
                  </div>
                </div>
              </div>
            )}

            {tab === 'patients' && <AdminPeople kind="patients" />}
            {tab === 'doctors' && <AdminPeople kind="doctors" />}
            {tab === 'pharmacies' && <AdminPeople kind="pharmacies" />}
            {tab === 'providers' && <ProviderManagement />}
            {tab === 'requests' && <RequestsPanel requests={requests} onUpdate={loadAll} />}
            {tab === 'directory' && <DirectoryManager />}
            {tab === 'bookings' && <BookingsPanel appointments={appointments} />}
            {tab === 'orders' && <OrdersPanel orders={orders} />}
            {tab === 'finance' && <FinancePanel stats={stats} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <LanguageProvider>
      <AdminDashboardContent />
    </LanguageProvider>
  );
}