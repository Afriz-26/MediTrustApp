
import { db } from '@/api/client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Package, CheckCircle, Settings, LogOut, Bell,
  Clock, ChevronRight, BadgeCheck, Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import features from '@/config/features';
import StatCard from '@/components/common/StatCard';
import FeatureCard from '@/components/common/FeatureCard';
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { format } from 'date-fns';
import BottomNav from '@/components/common/BottomNav';
import { DataError } from '@/components/common/DataState';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-purple-100 text-purple-700',
  ready: 'bg-green-100 text-green-700',
  out_for_delivery: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

function PharmacyDashboardContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [pharmacyName, setPharmacyName] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const pricingPage = features.providerPlans && features.adBoosters
    ? 'UnifiedPricing'
    : features.providerPlans
      ? 'SubscriptionPlans'
      : 'AdBoosters';

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const me = await db.auth.me();
      if (!me?.email) throw new Error('Could not verify the signed-in pharmacy account.');
      // New pharmacies must finish their profile first (this is what makes them listed and able to take orders)
      if (!await db.auth.isOnboarded()) { navigate(createPageUrl('Onboarding')); return; }
      setUser(me);
      const profiles = await db.entities.PharmacyProfile.filter({ email: me.email }, { limit: 1 });
      if (!profiles[0]?.id) throw new Error('Complete your pharmacy profile before viewing reservations.');
      const pharmacyName = profiles[0].name;
      setPharmacyName(pharmacyName || 'Pharmacy');
      const [orders, notifications] = await Promise.all([
        db.entities.MedicinePreOrder.filter(
          { pharmacy_id: profiles[0].id },
          { sort: '-created_date', limit: 50 }
        ),
        db.entities.Notification.filter(
          { user_email: me.email },
          { sort: '-created_date', limit: 50 }
        ),
      ]);
      setOrders(orders);
      setUnreadCount(notifications.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error('Failed to load pharmacy dashboard.', error);
      setLoadError(error.message || 'Failed to load pharmacy dashboard.');
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
      console.error('Failed to sign out pharmacy.', error);
      setLogoutError('Could not sign out. Please retry.');
      return;
    }
    localStorage.removeItem('meditrust_onboarding_data');
    navigate(createPageUrl('Welcome'));
  };

  // Real stats from database
  const today = format(new Date(), 'yyyy-MM-dd');
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;
  const processingOrders = orders.filter((o) => o.status === 'accepted' || o.status === 'preparing').length;
  const completedToday = orders.filter((o) => o.status === 'completed' && o.created_date?.startsWith(today)).length;

  const recentOrders = orders.slice(0, 5);

  const [subscriptionPlan, setSubscriptionPlan] = useState(null);
  useEffect(() => {
    const plan = localStorage.getItem('meditrust_subscription_plan');
    if (plan) setSubscriptionPlan(JSON.parse(plan));
  }, []);

  const quickActions = [
    { icon: FileText, title: 'Pickup Reservations', description: 'Review and prepare patient orders', gradient: 'from-blue-500 to-sky-500', page: 'PharmacyOrders' },
    { icon: Package, title: 'Inventory', description: 'Manage stock', gradient: 'from-emerald-500 to-teal-500', page: 'PharmacyInventory' },
    { icon: Settings, title: t('manageProfile'), description: 'Update pharmacy info', gradient: 'from-violet-500 to-purple-500', page: 'Onboarding' },
    ...((features.providerPlans || features.adBoosters) ? [{ icon: Zap, title: features.adBoosters ? 'Plans & Promotions' : 'My plan', description: features.adBoosters ? 'Subscription + Ad Boosters' : 'Subscription plan and status', gradient: 'from-violet-500 to-purple-600', page: pricingPage }] : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-rose-50">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
      </div>
    );
  }
  if (loadError) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-rose-50 p-6">
      <div className="w-full max-w-md"><DataError message={loadError} onRetry={loadDashboard} /></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-rose-50 pb-20 md:pb-0">
      {logoutError && <div role="alert" className="fixed top-3 left-3 right-3 z-50 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{logoutError} <button type="button" className="ml-2 underline" onClick={handleLogout}>Retry</button></div>}
      <div className="bg-gradient-to-r from-pink-600 via-rose-500 to-red-500 header-safe pb-24 px-6 rounded-b-[2.5rem]">
        <div className="max-w-md mx-auto">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 border-2 border-white/50">
                <AvatarFallback className="bg-white/20 text-white font-semibold">
                  {pharmacyName?.charAt(0) || 'P'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white/80 text-sm">{t('welcome')}</p>
                <div className="flex items-center gap-1">
                  <p className="text-white font-semibold">{pharmacyName || 'Pharmacy'}</p>
                  <BadgeCheck className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(createPageUrl('Notifications'))} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center relative">
                <Bell className="w-5 h-5 text-white" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full text-[10px] text-gray-800 flex items-center justify-center font-bold">{unreadCount}</span>}
              </button>
              <button onClick={handleLogout} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-center">
            <p className="text-white/80 text-sm">Today, {format(new Date(), 'EEEE, MMMM d')}</p>
            <p className="text-white/90 text-sm mt-1">{orders.length} total orders received</p>
          </motion.div>
        </div>
      </div>

      <div className="px-6 -mt-12 max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-3">
          <StatCard icon={Clock} title={t('pendingOrders')} value={pendingOrders} gradient="from-yellow-500 to-amber-500" delay={0.2} />
          <StatCard icon={Package} title="Processing" value={processingOrders} gradient="from-blue-500 to-sky-500" delay={0.3} />
          <div className="col-span-2">
  <StatCard icon={CheckCircle} title={t('completedOrders')} value={completedToday} gradient="from-emerald-500 to-teal-500" delay={0.4} />
          </div>
        </motion.div>
      </div>

      <div className="px-6 py-6 max-w-md mx-auto">
        {(features.providerPlans || features.adBoosters) && subscriptionPlan ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mb-6">
            <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-fuchsia-500 rounded-2xl p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">Current Plan</p>
                  <h3 className="text-xl font-bold">{subscriptionPlan.planName}</h3>
                  <p className="text-sm text-white/90 mt-1">₹{subscriptionPlan.price}/month</p>
                </div>
                <Link to={createPageUrl(pricingPage)}>
                  <button className="px-4 py-2 bg-white/20 rounded-xl text-sm font-medium hover:bg-white/30 transition-colors">Change Plan</button>
                </Link>
              </div>
            </div>
          </motion.div>
        ) : (features.providerPlans || features.adBoosters) ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mb-6">
            <Link to={createPageUrl(pricingPage)}>
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 border-2 border-violet-200 rounded-2xl p-4 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">{features.adBoosters ? '🚀 Plans & Promotions' : '🚀 Choose a plan'}</h3>
                    <p className="text-sm text-gray-600">{features.adBoosters ? 'Subscription + Ad Boosters in one place' : 'Get listed so patients can book you'}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </Link>
          </motion.div>
        ) : null}

        {/* Recent Orders */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Recent Orders</h3>
            <Link to={createPageUrl('PharmacyOrders')} className="text-sm text-pink-600 font-medium">View All</Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="text-center py-6">
              <Package className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((rx) => (
                <div key={rx.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-pink-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{rx.patient_name || 'Patient'}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{rx.medicines?.length || 0} medicines</span>
                      <span>•</span>
                      <span>{rx.total_amount == null ? 'Ask pharmacy' : `₹${rx.total_amount}`}</span>
                    </div>
                  </div>
                  <Badge className={statusColors[rx.status] || 'bg-gray-100 text-gray-600'}>{rx.status}</Badge>
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

export default function PharmacyDashboard() {
  return (
    <LanguageProvider>
      <PharmacyDashboardContent />
    </LanguageProvider>
  );
}