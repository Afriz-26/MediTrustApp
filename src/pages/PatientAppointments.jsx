
import { db } from '@/api/client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, Video, Phone, MessageCircle, Building2, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatSpecialization } from '@/lib/utils';
import features from '@/config/features';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import PullToRefresh from '@/components/common/PullToRefresh';
import { DataEmpty, DataError } from '@/components/common/DataState';

const typeIcons = {
  offline: Building2,
  chat: MessageCircle,
  audio: Phone,
  video: Video
};

const tokenToNumber = (token) => {
  if (!token) return Number.MAX_SAFE_INTEGER;
  const parsed = Number.parseInt(String(token).replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200'
};

function AppointmentsContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [patientEmail, setPatientEmail] = useState('');

  const { data: appointments = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['patient-appointments'],
    refetchInterval: 30000,
    queryFn: async () => {
      try {
        const me = await db.auth.me();
        if (!me?.email) throw new Error('Could not verify the signed-in patient account.');
        setPatientEmail(me.email);
        return await db.entities.Appointment.filter(
          { patient_email: me.email },
          { sort: '-date', limit: 200 }
        );
      } catch (error) {
        console.error('Failed to load patient appointments.', error);
        throw error;
      }
    }
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const queueEntries = [...appointments.filter((apt) => apt.date === today && apt.status === 'confirmed')]
    .sort((a, b) => tokenToNumber(a.token_number) - tokenToNumber(b.token_number));
  const servingNow = queueEntries.find((apt) => apt.queue_status === 'serving') || null;
  const ownAppointment = appointments.find((apt) => apt.patient_email === patientEmail && apt.status === 'confirmed') || null;

  const filteredAppointments = appointments.filter(apt => {
    if (filter === 'all') return true;
    return apt.status === filter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-background dark:bg-zinc-900 border-b border-border px-4 py-4 sticky top-0 z-10 pt-safe">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-muted-foreground" />
          </Link>
          <h1 className="font-semibold text-foreground">{t('myAppointments')}</h1>
        </div>
      </div>

      <div className="px-4 py-4 max-w-md mx-auto">
        {isLoading ? (
          <div role="status" aria-label="Loading appointments" className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <DataError message={error?.message || 'Could not load your appointments.'} onRetry={refetch} />
        ) : (
        <>
        {ownAppointment && servingNow && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Clinic queue</p>
            <p className="mt-2 text-lg font-bold text-emerald-900">{ownAppointment.id === servingNow.id ? 'You are now being called.' : `Now serving: ${servingNow.token_number || 'next patient'}`}</p>
            <p className="text-sm text-emerald-700">Your token: {ownAppointment.token_number || 'Pending'} • Queue updates every 30 seconds.</p>
          </div>
        )}

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="w-full bg-gray-100 p-1 rounded-xl">
            <TabsTrigger value="all" className="flex-1 rounded-lg">All</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1 rounded-lg">{t('pending')}</TabsTrigger>
            <TabsTrigger value="confirmed" className="flex-1 rounded-lg">{t('confirmed')}</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 rounded-lg">{t('completed')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Appointments List */}
        <PullToRefresh onRefresh={refetch}>
        <div className="space-y-4">
          {filteredAppointments.map((apt, idx) => {
            const TypeIcon = typeIcons[apt.appointment_type];
            return (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex gap-4">
                  {apt.profile_image ? (
                    <img
                      src={apt.profile_image}
                      alt={apt.doctor_name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 text-gray-600 font-semibold flex items-center justify-center flex-shrink-0">
                      {apt.doctor_name?.replace(/^Dr\.?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?'}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{apt.doctor_name}</h3>
                        <p className="text-sm text-gray-500">{formatSpecialization(apt.specialization)}</p>
                      </div>
                      <Badge className={`${statusColors[apt.status]} border text-xs`}>
                        {t(apt.status)}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 mt-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span>{format(new Date(apt.date), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        <span>{apt.time_slot}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <TypeIcon className="w-4 h-4 text-violet-500" />
                        <span className="capitalize">{apt.appointment_type}</span>
                      </div>
                    </div>

                    {apt.appointment_type === 'offline' && (apt.hospital_address || apt.osm_address || apt.hospital_name) && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-2">
                        <MapPin className="w-4 h-4" />
                        <span>{apt.hospital_address || apt.osm_address || apt.hospital_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">Consultation Fee</p>
                    <p className="text-lg font-bold text-gray-800">{apt.fee == null ? 'Ask clinic' : `₹${apt.fee}`}</p>
                    {apt.token_number && (
                      <p className="text-sm text-emerald-600 font-bold mt-1">Token: {apt.token_number}</p>
                    )}
                    {apt.payment_status === 'paid' && (
                      <Badge className="bg-green-100 text-green-700 text-xs mt-1">Paid</Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {apt.status === 'pending' && apt.payment_status === 'unpaid' && apt.fee > 0 && (
                      <p className="text-sm text-gray-600">Pay at clinic: ₹{apt.fee}</p>
                    )}
                    {apt.status === 'confirmed' && (
                      (apt.appointment_type === 'video' && features.video
                        || ['audio', 'chat'].includes(apt.appointment_type) && features.audioChat) && (
                      <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-sky-500 text-white rounded-xl text-sm font-medium">
                        Join Now
                      </button>
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        </PullToRefresh>

        {filteredAppointments.length === 0 && (
          <DataEmpty
            message={appointments.length ? 'No appointments match this filter.' : 'No appointments yet.'}
            actionLabel="Find doctors"
            onAction={() => navigate(createPageUrl('FindDoctors'))}
          />
        )}
        </>
        )}
      </div>
    </div>
  );
}

export default function PatientAppointments() {
  return (
    <LanguageProvider>
      <AppointmentsContent />
    </LanguageProvider>
  );
}