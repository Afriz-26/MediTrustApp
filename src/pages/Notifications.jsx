
import { db } from '@/api/client';

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bell, CheckCircle, CreditCard, Stethoscope, Pill, FileText, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LanguageProvider } from "@/components/ui/LanguageContext";
import { DataEmpty, DataError } from '@/components/common/DataState';

const typeConfig = {
  provider_onboarded: { icon: Stethoscope, color: "text-blue-500", bg: "bg-blue-100" },
  payment_success: { icon: CreditCard, color: "text-emerald-500", bg: "bg-emerald-100" },
  booking_confirmed: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-100" },
  order_ready: { icon: Pill, color: "text-pink-500", bg: "bg-pink-100" },
  prescription_ready: { icon: FileText, color: "text-teal-500", bg: "bg-teal-100" },
  general: { icon: Bell, color: "text-gray-500", bg: "bg-gray-100" },
};

function NotificationsContent() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const me = await db.auth.me();
      if (!me?.email) throw new Error('Could not verify the signed-in account.');
      const page = await db.entities.Notification
        .filter({ user_email: me.email }, { sort: "-created_date", limit: 50 });
      setNotifications(page);
    } catch (error) {
      console.error('Failed to load notifications.', error);
      setLoadError(error.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = db.entities.Notification.subscribe(() => load());
    return () => unsub && unsub();
  }, []);

  const markRead = async (n) => {
    const reservationNotification = n.type === 'order_ready'
      || /\b(medicine|reservation|pre[- ]?order|pickup)\b/i.test(`${n.title || ''} ${n.message || ''}`);
    const prescriptionNotification = n.type === 'prescription_ready'
      || /\bprescription\b/i.test(`${n.title || ''} ${n.message || ''}`);
    const destination = reservationNotification
      ? createPageUrl('PatientReservations')
      : prescriptionNotification
        ? createPageUrl('PatientPrescriptions')
        : n.link;
    if (n.is_read) {
      if (destination) navigate(destination);
      return;
    }
    try {
      await db.entities.Notification.update(n.id, { is_read: true });
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      if (destination) navigate(destination);
    } catch (error) {
      console.error('Failed to mark notification as read.', error);
      setLoadError('Could not update this notification. Retry to reload notifications.');
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    try {
      for (const n of unread) {
        await db.entities.Notification.update(n.id, { is_read: true });
      }
      setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read.', error);
      setLoadError('Could not update all notifications. Retry to reload notifications.');
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const removeOne = async (n) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    try {
      await db.entities.Notification.delete(n.id);
    } catch (error) {
      console.error('Failed to delete notification.', error);
      setNotifications(previous);
      setLoadError('Could not delete this notification. Please try again.');
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Delete all notifications? This cannot be undone.')) return;
    const previous = notifications;
    setNotifications([]);
    try {
      for (const n of previous) {
        await db.entities.Notification.delete(n.id);
      }
    } catch (error) {
      console.error('Failed to clear notifications.', error);
      setLoadError('Could not delete all notifications. Please try again.');
      load();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-gray-600" /></Link>
          <h1 className="font-semibold text-gray-800 flex items-center gap-2"><Bell className="w-5 h-5" /> Notifications</h1>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="ml-auto text-sm text-blue-600">Mark all read</button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll} className={`${unreadCount > 0 ? '' : 'ml-auto'} text-sm text-red-600`}>Clear all</button>
          )}
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" /></div>
        ) : loadError ? (
          <DataError message={loadError} onRetry={load} />
        ) : notifications.length === 0 ? (
          <DataEmpty
            message="No notifications yet. You'll be notified when your requested providers are onboarded."
            actionLabel="Find doctors"
            onAction={() => navigate(createPageUrl('FindDoctors'))}
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((n, i) => {
              const isPrescription = n.type === 'prescription_ready'
                || /\bprescription\b/i.test(n.title || '');
              const cfg = isPrescription ? typeConfig.prescription_ready : typeConfig[n.type] || typeConfig.general;
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`w-full bg-white rounded-2xl shadow-sm border flex items-start transition-all hover:shadow-md ${
                    n.is_read ? "border-gray-100" : "border-blue-200 bg-blue-50/30"
                  }`}
                >
                  <button onClick={() => markRead(n)} className="flex-1 min-w-0 text-left p-4 flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-800 text-sm">{n.title}</p>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                      {n.link && <p className="text-xs text-blue-500 mt-1.5">Tap to view →</p>}
                    </div>
                  </button>
                  <button
                    onClick={() => removeOne(n)}
                    aria-label="Delete notification"
                    className="p-3 mt-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Notifications() {
  return (
    <LanguageProvider>
      <NotificationsContent />
    </LanguageProvider>
  );
}