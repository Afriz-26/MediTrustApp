import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Calendar, Pill, Stethoscope, User, FileText, MessageCircle, ClipboardList, ShoppingBag, Package
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import features from '@/config/features';

const navConfig = {
  patient: [
    { icon: Home, label: 'Home', page: 'PatientDashboard' },
    { icon: Stethoscope, label: 'Doctors', page: 'FindDoctors' },
    { icon: Calendar, label: 'Visits', page: 'PatientAppointments' },
    { icon: FileText, label: 'Prescriptions', page: 'PatientPrescriptions' },
    ...(features.pharmacy ? [{ icon: Pill, label: 'Pharmacies', page: 'Pharmacies' }] : []),
    ...(features.aiAssistant ? [{ icon: MessageCircle, label: 'Assistant', page: 'ChatAssistant' }] : []),
  ],
  doctor: [
    { icon: Home, label: 'Home', page: 'DoctorDashboard' },
    { icon: ClipboardList, label: 'Queue', page: 'DoctorAppointments' },
    { icon: FileText, label: 'Prescribe', page: 'WritePrescription' },
    { icon: Calendar, label: 'Schedule', page: 'DoctorQueueSettings' },
    { icon: User, label: 'Profile', page: 'DoctorProfile' },
  ],
  pharmacy: [
    { icon: Home, label: 'Home', page: 'PharmacyDashboard' },
    { icon: FileText, label: 'Requests', page: 'PharmacyOrders' },
    { icon: Package, label: 'Inventory', page: 'PharmacyInventory' },
    ...(features.providerPlans ? [{ icon: ShoppingBag, label: 'Plans', page: 'SubscriptionPlans' }] : []),
    { icon: User, label: 'Profile', page: 'Onboarding' },
  ],
};

export default function BottomNav() {
  const { user } = useAuth();
  const items = navConfig[user?.role] || [];
  const navigate = useNavigate();
  const location = useLocation();
  const current = location.pathname.replace(/^\//, '');

  if (items.length === 0) return null;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 dark:bg-zinc-950/95 backdrop-blur border-t border-border pb-safe">
      <div className="flex items-stretch justify-around">
        {items.map((it) => {
          const active = current === it.page;
          const Icon = it.icon;
          return (
            <button
              key={it.page}
              onClick={() => navigate(createPageUrl(it.page), { replace: true })}
              type="button"
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${
                active ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}