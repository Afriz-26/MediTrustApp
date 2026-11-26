
import { db } from '@/api/client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Calendar, FileText, Settings, LogOut, Bell,
  TrendingUp, Clock, CheckCircle, Zap, Hash
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDoctorName } from '@/lib/utils';
import features from '@/config/features';
import StatCard from '@/components/common/StatCard';
import FeatureCard from '@/components/common/FeatureCard';
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { format } from 'date-fns';
import BottomNav from '@/components/common/BottomNav';
import { DataError } from '@/components/common/DataState';

function DoctorDashboardContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [logoutError, setLogoutError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const me = await db.auth.me();
      if (!me?.email) throw new Error('Could not verify the signed-in doctor account.');
      // New doctors must finish their profile first (this is what makes them listed and bookable)
      if (!await db.auth.isOnboarded()) { navigate(createPageUrl('Onboarding')); return; }
      setUser(me);
      const [appointments, notifications] = await Promise.all([
        db.entities.Appointment.filter(
          { doctor_email: me.email },
          { sort: '-date', limit: 200 }
        ),
        db.entities.Notification.filter(
          { user_email: me.email },
          { sort: '-created_date', limit: 50 }
        ),
      ]);
      setAppointments(appointments);
      setUnreadCount(notifications.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error('Failed to load doctor dashboard.', error);
      setLoadError(error.message || 'Failed to load doctor dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleLogout = async () => {
    try {
      await db.auth.logout();
    } catch (error) {
      console.error('Failed to sign out doctor.', error);
      setLogoutError('Could not sign out. Please retry.');
      return;
    }
    localStorage.removeItem('meditrust_onboarding_data');
    navigate(createPageUrl('Welcome'));
  };

  // Real stats from database
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayAppointments = appointments.filter((a) => a.date === today);
  const completedToday = todayAppointments.filter((a) => a.status === 'completed');
  const uniquePatients = new Set(appointments.map((a) => a.patient_email));
  const pendingRequests = appointments.filter((a) => a.status === 'pending');

  const upcomingAppointments = appointments
    .filter((a) => (a.status === 'confirmed' || a.status === 'pending') && a.date >= today)
    .sort((a, b) => (a.date + a.time_slot).localeCompare(b.date + b.time_slot))
    .slice(0, 5);

  const quickActions = [
    { icon: Calendar, title: t('myAppointments'), description: 'View & manage bookings', gradient: 'from-blue-500 to-sky-500', page: 'DoctorAppointments' },
    { icon: FileText, title: t('writePrescription'), description: 'Create e-prescriptions', gradient: 'from-emerald-500 to-teal-500', page: 'WritePrescription' },
    { icon: Settings, title: t('manageProfile'), description: 'Update profile & fees', gradient: 'from-violet-500 to-purple-500', page: 'Onboarding' },
    { icon: TrendingUp, title: t('viewAnalytics'), description: 'View your statistics', gradient: 'from-orange-500 to-amber-500', page: 'DoctorAnalytics' },
    { icon: Settings, title: 'Appointment Schedule', description: 'Configure available visit times', gradient: 'from-teal-500 to-emerald-600', page: 'DoctorQueueSettings' },
    ...((features.providerPlans || features.adBoosters) ? [{
      icon: Zap,
      title: features.adBoosters ? 'Plans & Promotions' : 'My plan',
      description: features.adBoosters ? 'Subscription + Ad Boosters' : 'Subscription plan and status',
      gradient: 'from-violet-500 to-purple-600',
      page: features.providerPlans && features.adBoosters ? 'UnifiedPricing' : features.providerPlans ? 'SubscriptionPlans' : 'AdBoosters',
    }] : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-sky-50">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }
  if (loadError) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-sky-50 p-6">
      <div className="w-full max-w-md"><DataError message={loadError} onRetry={loadDashboard} /></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 pb-20 md:pb-0">
      {logoutError && <div role="alert" className="fixed top-3 left-3 right-3 z-50 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{logoutError} <button type="button" className="ml-2 underline" onClick={handleLogout}>Retry</button></div>}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 header-safe pb-24 px-6 rounded-b-[2.5rem]">
        <div className="max-w-md mx-auto">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 border-2 border-white/50">
                <AvatarFallback className="bg-white/20 text-white font-semibold">
                  {user?.full_name?.charAt(0) || 'D'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white/80 text-sm">{t('welcome')}</p>
                <p className="text-white font-semibold">{formatDoctorName(user?.full_name || 'Doctor')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(createPageUrl('Notifications'))} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center relative">
                <Bell className="w-5 h-5 text-white" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">{unreadCount}</span>}
              </button>
              <button onClick={handleLogout} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-center">
            <p className="text-white/80 text-sm">Today, {format(new Date(), 'EEEE, MMMM d')}</p>
            <p className="text-white/90 text-sm mt-1">{todayAppointments.length} appointments scheduled today</p>
          </motion.div>
        </div>
      </div>

      <div className="px-6 -mt-12 max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-3">
          <StatCard icon={Calendar} title={t('todayAppointments')} value={todayAppointments.length} gradient="from-blue-500 to-sky-500" delay={0.2} />
          <StatCard icon={CheckCircle} title="Completed" value={completedToday.length} gradient="from-emerald-500 to-teal-500" delay={0.3} />
          <StatCard icon={Users} title={t('totalPatients')} value={uniquePatients.size} gradient="from-violet-500 to-purple-500" delay={0.4} />
          <StatCard icon={Clock} title="Pending requests" value={pendingRequests.length} gradient="from-orange-500 to-amber-500" delay={0.5} />
        </motion.div>
      </div>

      <div className="px-6 py-6 max-w-md mx-auto">
        {/* Upcoming Appointments */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Upcoming Appointments</h3>
            <Link to={createPageUrl('DoctorAppointments')} className="text-sm text-blue-600 font-medium">View All</Link>
          </div>
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No upcoming appointments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                      {apt.patient_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{apt.patient_name || 'Patient'}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{apt.time_slot}</span>
                      <span className="capitalize">• {apt.appointment_type}</span>
                    </div>
                  </div>
                  {apt.token_number && (
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs"><Hash className="w-3 h-3 mr-1" />{apt.token_number}</Badge>
                  )}
                  <Badge className={apt.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                    {apt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <div className="space-y-3">
          {quickActions.map((action, idx) => (
            <FeatureCard key={idx} icon={action.icon} title={action.title} description={action.description} gradient={action.gradient} delay={0.6 + idx * 0.1} onClick={() => navigate(createPageUrl(action.page))} />
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

export default function DoctorDashboard() {
  return (
    <LanguageProvider>
      <DoctorDashboardContent />
    </LanguageProvider>
  );
}