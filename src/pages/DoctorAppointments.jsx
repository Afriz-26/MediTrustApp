
import { db } from '@/api/client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, Video, Phone, MessageCircle, Building2, Check, X, FileText, Hash, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';

import { format } from 'date-fns';
import PullToRefresh from '@/components/common/PullToRefresh';
import { DataError } from '@/components/common/DataState';

const typeIcons = { offline: Building2, chat: MessageCircle, audio: Phone, video: Video };

const tokenToNumber = (token) => {
  if (!token) return Number.MAX_SAFE_INTEGER;
  const parsed = Number.parseInt(String(token).replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  declined: 'bg-red-100 text-red-700 border-red-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  no_show: 'bg-orange-100 text-orange-700 border-orange-200',
};

function DoctorAppointmentsContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doctorEmail, setDoctorEmail] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [loadError, setLoadError] = useState('');

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const me = await db.auth.me();
      if (!me?.email) throw new Error('Could not verify the signed-in doctor account.');
      setDoctorEmail(me.email);
      const page = await db.entities.Appointment.filter(
        { doctor_email: me.email },
        { sort: '-date', limit: 200 }
      );
      setAppointments(page);
    } catch (e) {
      console.error('Failed to load doctor appointments.', e);
      setLoadError(e.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();

    // Real-time updates
    const unsub = db.entities.Appointment.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        setAppointments((prev) => {
          const idx = prev.findIndex((a) => a.id === event.data.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = event.data;
            return next;
          }
          return [event.data, ...prev];
        });
      }
      if (event.type === 'delete') {
        setAppointments((prev) => prev.filter((a) => a.id !== event.data.id));
      }
    });
    return () => unsub && unsub();
  }, []);

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === 'all') return true;
    if (filter === 'today') return apt.date === format(new Date(), 'yyyy-MM-dd');
    return apt.status === filter;
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const queueEntries = [...appointments.filter((apt) => apt.doctor_email === doctorEmail && apt.date === today && apt.status === 'confirmed')]
    .sort((a, b) => tokenToNumber(a.token_number) - tokenToNumber(b.token_number));

  const handleAccept = async (apt) => {
    setActionLoading((s) => ({ ...s, [apt.id]: true }));
    try {
      await db.entities.Appointment.update(apt.id, {
        status: 'confirmed',
      });
      const refreshed = await db.entities.Appointment.filter(
        { doctor_email: apt.doctor_email },
        { sort: '-date', limit: 200 }
      );
      setAppointments(refreshed);
      const persisted = refreshed.find((item) => item.id === apt.id);
      if (persisted?.status === 'confirmed' && !persisted.token_number) {
        alert('Appointment confirmed, but the server did not assign a token. Contact your administrator before relying on this booking.');
      } else if (persisted?.status !== 'confirmed' || !persisted.token_number) {
        throw new Error('The server did not return a confirmed appointment with an assigned token.');
      }
    } catch (e) {
      console.error('Failed to accept appointment.', e);
      alert('Failed to accept: ' + (e.message || 'Unknown error'));
      await loadAppointments();
    }
    setActionLoading((s) => ({ ...s, [apt.id]: false }));
  };

  const handleDecline = async (apt) => {
    setActionLoading((s) => ({ ...s, [apt.id]: true }));
    try {
      await db.entities.Appointment.update(apt.id, { status: 'declined' });
      setAppointments(await db.entities.Appointment.filter(
        { doctor_email: apt.doctor_email },
        { sort: '-date', limit: 200 }
      ));
    } catch (e) {
      console.error('Failed to decline appointment.', e);
      alert('Failed to decline: ' + (e.message || 'Unknown error'));
      await loadAppointments();
    }
    setActionLoading((s) => ({ ...s, [apt.id]: false }));
  };

  const handleComplete = async (apt) => {
    setActionLoading((s) => ({ ...s, [apt.id]: true }));
    try {
      await db.entities.Appointment.update(apt.id, { status: 'completed' });
      setAppointments(await db.entities.Appointment.filter(
        { doctor_email: apt.doctor_email },
        { sort: '-date', limit: 200 }
      ));
    } catch (e) {
      console.error('Failed to complete appointment.', e);
      alert('Failed to update: ' + (e.message || 'Unknown error'));
      await loadAppointments();
    }
    setActionLoading((s) => ({ ...s, [apt.id]: false }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50">
      <div className="bg-background dark:bg-zinc-900 border-b border-border px-4 py-4 sticky top-0 z-10 pt-safe">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link to={createPageUrl('DoctorDashboard')} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-muted-foreground" /></Link>
          <h1 className="font-semibold text-foreground">{t('myAppointments')}</h1>
        </div>
      </div>

      <div className="px-4 py-4 max-w-md mx-auto">
        {doctorEmail && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Today’s appointments</p>
                <p className="mt-2 text-lg font-bold text-emerald-900">{queueEntries.length} confirmed</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-emerald-800">Queue calls and walk-in tokens are unavailable until server-side queue support is deployed.</p>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4">
          {['all', 'today', 'pending', 'confirmed', 'completed', 'declined'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === f ? 'bg-emerald-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin" /></div>
        ) : loadError ? (
          <DataError message={loadError} onRetry={loadAppointments} />
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{appointments.length ? 'No appointments match this filter.' : 'No appointments yet.'}</p>
            <Button type="button" size="sm" variant="outline" className="mt-3 rounded-xl" onClick={loadAppointments}>
              Refresh appointments
            </Button>
          </div>
        ) : (
          <PullToRefresh onRefresh={loadAppointments}>
          <div className="space-y-4">
            {filteredAppointments.map((apt, idx) => {
              const TypeIcon = typeIcons[apt.appointment_type] || Building2;
              return (
                <motion.div key={apt.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex gap-4">
                    <Avatar className="w-14 h-14">
                      <AvatarFallback className="bg-emerald-100 text-emerald-600 font-semibold text-lg">
                        {apt.patient_name?.charAt(0) || <User className="w-5 h-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-800">{apt.patient_name || 'Patient'}</h3>
                          <p className="text-sm text-gray-500">{apt.patient_email}</p>
                        </div>
                        <Badge className={`${statusColors[apt.status]} border text-xs`}>{apt.status}</Badge>
                      </div>

                      <div className="flex flex-wrap gap-3 mt-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600"><Calendar className="w-4 h-4 text-blue-500" /><span>{apt.date ? format(new Date(apt.date), 'MMM d, yyyy') : ''}</span></div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600"><Clock className="w-4 h-4 text-emerald-500" /><span>{apt.time_slot}</span></div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600"><TypeIcon className="w-4 h-4 text-violet-500" /><span className="capitalize">{apt.appointment_type}</span></div>
                      </div>

                      {apt.token_number && (
                        <div className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-1.5 rounded-xl text-sm font-bold">
                          <Hash className="w-4 h-4" /> Token: {apt.token_number}
                        </div>
                      )}

                      {apt.notes && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div><p className="text-xs font-semibold text-blue-800 mb-1">Reason for Visit</p><p className="text-sm text-gray-700">{apt.notes}</p></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                    {apt.status === 'pending' && (
                      <>
                        <Button onClick={() => handleAccept(apt)} disabled={actionLoading[apt.id]} size="sm" className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                          <Check className="w-4 h-4 mr-1" /> Accept
                        </Button>
                        <Button onClick={() => handleDecline(apt)} disabled={actionLoading[apt.id]} size="sm" variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 rounded-xl">
                          <X className="w-4 h-4 mr-1" /> Decline
                        </Button>
                      </>
                    )}
                    {apt.status === 'confirmed' && (
                      <>
                        <Button onClick={() => navigate(createPageUrl('WritePrescription') + `?appointmentId=${apt.id}&patientName=${encodeURIComponent(apt.patient_name || '')}&patientEmail=${encodeURIComponent(apt.patient_email || '')}`)} size="sm" variant="outline" className="flex-1 rounded-xl">
                          <FileText className="w-4 h-4 mr-1" /> Prescribe
                        </Button>
                        <Button onClick={() => handleComplete(apt)} disabled={actionLoading[apt.id]} size="sm" className="flex-1 bg-blue-500 hover:bg-blue-600 rounded-xl">
                          <Check className="w-4 h-4 mr-1" /> Complete
                        </Button>
                      </>
                    )}
                    {apt.status === 'completed' && (
                      <Button onClick={() => navigate(createPageUrl('WritePrescription') + `?appointmentId=${apt.id}&patientName=${encodeURIComponent(apt.patient_name || '')}&patientEmail=${encodeURIComponent(apt.patient_email || '')}`)} size="sm" className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                        <FileText className="w-4 h-4 mr-1" /> Write Prescription
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          </PullToRefresh>
        )}
      </div>
    </div>
  );
}

export default function DoctorAppointments() {
  return (
    <LanguageProvider>
      <DoctorAppointmentsContent />
    </LanguageProvider>
  );
}