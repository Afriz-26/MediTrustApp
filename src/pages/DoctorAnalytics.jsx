
import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Users, Calendar, DollarSign, Clock, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths, isSameMonth } from 'date-fns';

const TYPE_COLORS = {
  video: '#8B5CF6',
  audio: '#10B981',
  chat: '#3B82F6',
  offline: '#6B7280',
};

function DoctorAnalyticsContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await db.auth.me();
        const rows = await db.entities.Appointment.filter({ doctor_email: me.email }, '-date', 200);
        setAppointments(rows);
      } catch (e) {
        // not authed
      }
      setLoading(false);
    })();
  }, []);

  // Real stats from database
  const totalPatients = new Set(appointments.map((a) => a.patient_email)).size;
  const totalAppointments = appointments.length;
  const completed = appointments.filter((a) => a.status === 'completed');
  const cancelled = appointments.filter((a) => a.status === 'cancelled' || a.status === 'declined');
  const noShows = appointments.filter((a) => a.status === 'no_show');
  const earnings = completed.filter((a) => a.payment_status === 'paid').reduce((sum, a) => sum + (a.fee || 0), 0);

  // Monthly trend (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const monthDate = subMonths(new Date(), 5 - i);
    const monthAppointments = appointments.filter((a) => a.date && isSameMonth(new Date(a.date), monthDate));
    return {
      month: format(monthDate, 'MMM'),
      patients: new Set(monthAppointments.map((a) => a.patient_email)).size,
      earnings: monthAppointments.filter((a) => a.status === 'completed' && a.payment_status === 'paid').reduce((s, a) => s + (a.fee || 0), 0),
    };
  });

  // Consultation type distribution
  const typeCounts = {};
  appointments.forEach((a) => { typeCounts[a.appointment_type] = (typeCounts[a.appointment_type] || 0) + 1; });
  const consultationTypes = Object.entries(typeCounts).map(([name, value]) => ({ name, value, color: TYPE_COLORS[name] || '#6B7280' }));
  const totalTyped = consultationTypes.reduce((s, t) => s + t.value, 0) || 1;
  consultationTypes.forEach((t) => { t.percentage = Math.round((t.value / totalTyped) * 100); });

  const stats = [
    { icon: Users, label: 'Total Patients', value: totalPatients, color: 'from-blue-500 to-sky-500' },
    { icon: Calendar, label: 'Appointments', value: totalAppointments, color: 'from-emerald-500 to-teal-500' },
    { icon: DollarSign, label: 'Earnings (Paid)', value: `₹${earnings.toLocaleString()}`, color: 'from-violet-500 to-purple-500' },
    { icon: Clock, label: 'Completed', value: completed.length, color: 'from-amber-500 to-orange-500' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-sky-50">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 pb-8">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link to={createPageUrl('DoctorDashboard')} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-gray-600" /></Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-800">{t('viewAnalytics')}</h1>
              <p className="text-xs text-gray-500">Performance Dashboard</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((stat, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-gray-500">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-gray-800">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Additional stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Cancelled / Declined</p>
            <p className="text-xl font-bold text-red-600">{cancelled.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">No-shows</p>
            <p className="text-xl font-bold text-orange-600">{noShows.length}</p>
          </div>
        </div>

        {appointments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <TrendingUp className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">No data yet. Your analytics will appear here once you have appointments.</p>
          </div>
        ) : (
          <>
            {/* Patient Trend Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
              <h3 className="font-semibold text-gray-800 mb-4">Patient Trend (6 months)</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E5E7EB' }} />
                    <Area type="monotone" dataKey="patients" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorPatients)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Consultation Type Distribution */}
            {consultationTypes.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
                <h3 className="font-semibold text-gray-800 mb-4">Consultation Types</h3>
                <div className="flex items-center">
                  <div className="w-32 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={consultationTypes} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                          {consultationTypes.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {consultationTypes.map((type, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }}></div>
                        <span className="text-sm text-gray-600 flex-1 capitalize">{type.name}</span>
                        <span className="text-sm font-medium text-gray-800">{type.value} ({type.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Earnings Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4">Earnings Trend</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(value) => `₹${value / 1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E5E7EB' }} formatter={(value) => [`₹${value.toLocaleString()}`, 'Earnings']} />
                    <Area type="monotone" dataKey="earnings" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorEarnings)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DoctorAnalytics() {
  return (
    <LanguageProvider>
      <DoctorAnalyticsContent />
    </LanguageProvider>
  );
}