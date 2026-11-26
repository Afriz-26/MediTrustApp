
import { db } from '@/api/client';

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Stethoscope, MapPin, MessageCircle, Phone, Video, ShieldAlert, ChevronRight, Send, Loader2, ShieldCheck, AlertCircle
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage, LanguageProvider } from "@/components/ui/LanguageContext";
import { DataError } from '@/components/common/DataState';
import features from "@/config/features";

import { createProviderRequest } from "@/lib/providerRequests";
import { getDoctorSchedule, generateSlots, getBookedSlotCounts, isSlotAvailable } from "@/lib/doctorSchedule";
import RequestModal from "@/components/provider/RequestModal";
import { formatSpecialization } from "@/lib/utils";
import { getRequestedProviderIds, hasRequestedProvider, isBookable } from "@/lib/providers";
import { format, addDays } from "date-fns";

const consultationTypes = [
  { id: "video", icon: Video, label: "Video Call", enabled: features.video },
  { id: "audio", icon: Phone, label: "Audio Call", enabled: features.audioChat },
  { id: "chat", icon: MessageCircle, label: "Chat", enabled: features.audioChat },
  { id: "offline", icon: Stethoscope, label: "Offline Visit", enabled: true },
];

function BookingContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [noSchedule, setNoSchedule] = useState(false);
  const [selectedType, setSelectedType] = useState("offline");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotReloadKey, setSlotReloadKey] = useState(0);
  const [slotError, setSlotError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [requestedProviderIds, setRequestedProviderIds] = useState(new Set());
  const [requestStatusError, setRequestStatusError] = useState("");
  const [providerLoadError, setProviderLoadError] = useState("");
  const [providerLoading, setProviderLoading] = useState(true);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const availableConsultationTypes = consultationTypes.filter((type) => type.enabled);

  const loadProvider = useCallback(async () => {
    setProviderLoading(true);
    setProviderLoadError('');
    const params = new URLSearchParams(window.location.search);
    try {
      if (params.get("doctorId")) {
        const doc = await db.entities.DoctorProfile.get(params.get("doctorId"));
        if (!doc) throw new Error("This doctor could not be found.");
        setDoctor(doc);
        const sched = await getDoctorSchedule(doc.email);
        setSchedule(sched || null);
        setNoSchedule(!sched);
      } else if (params.get("osmId")) {
        setProvider({
          osm_id: params.get("osmId"),
          osm_name: params.get("osmName"),
          osm_address: params.get("osmAddress"),
          lat: parseFloat(params.get("lat")),
          lng: parseFloat(params.get("lng")),
          specialization: params.get("spec") || "",
        });
      } else {
        throw new Error('Doctor details are missing. Find a doctor and try again.');
      }
    } catch (error) {
      console.error('Failed to load appointment provider.', error);
      setProviderLoadError(error.message || "Failed to load doctor details.");
    } finally {
      setProviderLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProvider();
  }, [loadProvider]);

  // Generate available slots when date changes
  useEffect(() => {
    if (!selectedDate || !doctor || !schedule) {
      setAvailableSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSlotError("");
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const allSlots = generateSlots(schedule, selectedDate);
    getBookedSlotCounts(doctor.email, dateStr).then((counts) => {
      const max = schedule.max_per_slot || 1;
      const avail = allSlots.map((slot) => ({
        slot,
        available: (counts[slot] || 0) < max,
        booked: counts[slot] || 0,
        max,
      }));
      setAvailableSlots(avail);
      setLoadingSlots(false);
    }).catch((error) => {
      console.error('Failed to load doctor availability.', error);
      setSlotError(error.message || 'Failed to load available times.');
      setAvailableSlots([]);
      setLoadingSlots(false);
    });
  }, [selectedDate, doctor, schedule, slotReloadKey]);

  const loadRequestStatus = useCallback(async () => {
    try {
      const me = await db.auth.me();
      setRequestedProviderIds(await getRequestedProviderIds("doctor", me?.email));
      setRequestStatusError('');
    } catch (error) {
      console.error('Failed to load doctor request status.', error);
      setRequestStatusError(error.message || "Failed to load your provider requests.");
    }
  }, []);

  useEffect(() => {
    loadRequestStatus();
  }, [loadRequestStatus]);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const isVerified = !!doctor;
  const fee = isVerified ? (doctor?.consultation_fees?.[selectedType] ?? null) : null;
  const feeLabel = fee == null ? "Contact provider for fee" : `₹${fee}`;

  const handleSubmit = async () => {
    setSubmitting(true);
    setSlotError("");
    setSubmitError('');
    try {
      const me = await db.auth.me();
      const loc = JSON.parse(localStorage.getItem("meditrust_location") || "{}");
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      if (isVerified) {
        // Double-booking prevention: re-check slot availability before creating
        const stillAvailable = await isSlotAvailable(doctor.email, dateStr, selectedSlot, schedule?.max_per_slot || 1);
        if (!stillAvailable) {
          setSlotError("This slot was just booked by another patient. Please select another time.");
          setSelectedSlot(null);
          setSubmitting(false);
          return;
        }

        const appt = await db.entities.Appointment.create({
          patient_email: me.email,
          patient_name: me.full_name || "",
          doctor_email: doctor.email,
          doctor_name: doctor.name,
          specialization: doctor.specialization,
          appointment_type: selectedType,
          date: dateStr,
          time_slot: selectedSlot,
          status: "pending",
          fee,
          notes: reason,
          onboarding_status: "onboarded",
          payment_status: "unpaid",
        });

        setDone({ appointmentId: appt.id, isVerified: true });
      } else {
        const appt = await db.entities.Appointment.create({
          patient_email: me.email,
          patient_name: me.full_name || "",
          doctor_email: `osm_${provider.osm_id}@meditrust.app`,
          doctor_name: provider.osm_name,
          specialization: provider.specialization,
          appointment_type: selectedType,
          date: dateStr,
          time_slot: selectedSlot,
          status: "pending",
          fee: null,
          notes: reason,
          onboarding_status: "pending_onboard",
          osm_id: provider.osm_id,
          osm_lat: provider.lat,
          osm_lng: provider.lng,
          osm_name: provider.osm_name,
          osm_address: provider.osm_address,
          payment_status: "unpaid",
        });
        const req = await createProviderRequest({
          type: "doctor",
          osmId: provider.osm_id,
          name: provider.osm_name,
          address: provider.osm_address,
          lat: provider.lat,
          lng: provider.lng,
          tags: { specialization: provider.specialization },
          requesterEmail: me.email,
          requesterName: me.full_name || "",
          linkedEntityType: "Appointment",
          linkedEntityId: appt.id,
          state: loc.state || "",
          city: loc.city || "",
        });
        if (req?.id) await db.entities.Appointment.update(appt.id, { provider_request_id: req.id });
        setDone({ appointmentId: appt.id, isVerified: false });
      }
    } catch (e) {
      console.error('Failed to submit appointment.', e);
      setSubmitError("Failed to submit booking: " + (e.message || "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (providerLoading || (!provider && !doctor && !providerLoadError)) {
    return <div role="status" aria-label="Loading doctor details" className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  }

  if (!provider && !doctor) {
    return providerLoadError ? (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <DataError message={providerLoadError} onRetry={loadProvider} />
        <Button variant="outline" onClick={() => navigate(createPageUrl("FindDoctors"))}>Find doctors</Button>
      </div>
    ) : null;
  }

  const displayName = doctor?.name || provider?.osm_name;
  const displaySpec = formatSpecialization(doctor?.specialization || provider?.specialization);
  const displayAddr = doctor?.hospital_address || provider?.osm_address;
  const requestTarget = doctor
    ? {
      osm_id: doctor.id,
      osm_name: doctor.name,
      osm_address: doctor.hospital_address,
      lat: doctor.lat,
      lng: doctor.lng,
      specialization: doctor.specialization,
      linkedEntityType: "DoctorProfile",
      linkedEntityId: doctor.id,
    }
    : provider;
  const providerIsBookable = isBookable(doctor, "doctor");

  if (providerIsBookable && doctor && noSchedule) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-md w-full text-center">
          <Stethoscope className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">{displayName}</h1>
          <p className="text-sm text-gray-600">This doctor has not published appointment times yet. Please check back soon.</p>
          <Button variant="outline" onClick={() => navigate(createPageUrl("FindDoctors"))} className="w-full mt-5 rounded-xl">Find doctors</Button>
        </div>
      </div>
    );
  }

  if (!providerIsBookable && (doctor || provider)) {
    const alreadyRequested = hasRequestedProvider(requestedProviderIds, requestTarget);
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-md w-full text-center">
          <Stethoscope className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">{displayName}</h1>
          <p className="text-sm text-gray-600">This provider has not joined MediTrust yet</p>
          {requestStatusError && (
            <div role="alert" className="mt-3">
              <p className="text-sm text-red-600">{requestStatusError}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={loadRequestStatus}>Retry</Button>
            </div>
          )}
          <Button
            onClick={() => setRequestModalOpen(true)}
            disabled={alreadyRequested}
            className="w-full mt-5 rounded-xl"
          >
            {alreadyRequested ? "Requested" : "Request"}
          </Button>
          <Button variant="outline" onClick={() => navigate(createPageUrl("FindDoctors"))} className="w-full mt-2 rounded-xl">
            Find doctors
          </Button>
        </div>
        <RequestModal
          open={requestModalOpen}
          provider={requestTarget}
          type="doctor"
          linkedEntityType={requestTarget.linkedEntityType || "none"}
          linkedEntityId={requestTarget.linkedEntityId || ""}
          onSubmitted={() => setRequestedProviderIds((current) => new Set([
            ...current,
            requestTarget.osm_id,
            requestTarget.linkedEntityId,
          ].filter(Boolean).map(String)))}
          onClose={() => setRequestModalOpen(false)}
        />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 flex flex-col items-center justify-center p-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-5">
          <Send className="w-12 h-12 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Booking Request Sent!</h2>
        <p className="text-gray-500 text-center mb-5 text-sm max-w-sm">
          {done.isVerified
            ? `Your offline appointment request for ${displayName} was saved. Check My Appointments for its status and any server-assigned token.`
            : `We've received your request for ${displayName}. Track its status in My Appointments while our team reviews the provider request.`}
        </p>
        <div className="bg-white rounded-2xl p-4 w-full max-w-sm border border-gray-100 shadow-sm mb-5">
          <div className="flex items-center gap-3 mb-3">
            <Stethoscope className="w-5 h-5 text-blue-500" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">{displayName}</p>
              {displayAddr && <p className="text-xs text-gray-500">{displayAddr}</p>}
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium capitalize">{selectedType}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{format(selectedDate, 'MMM d, yyyy')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{selectedSlot}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fee</span><span className="font-medium">{feeLabel}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><Badge className="bg-amber-100 text-amber-700">{done.isVerified ? "Awaiting confirmation" : "Awaiting onboarding"}</Badge></div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate(createPageUrl('PatientAppointments'))} className="bg-gradient-to-r from-blue-500 to-sky-500 rounded-xl">View My Appointments</Button>
          <Button variant="outline" onClick={() => navigate(createPageUrl('FindDoctors'))} className="rounded-xl">Find More Doctors</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 pb-28">
      <div className="bg-background dark:bg-zinc-900 border-b border-border px-4 py-4 sticky top-0 z-10 pt-safe">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link to={createPageUrl('FindDoctors')} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-muted-foreground" /></Link>
          <h1 className="font-semibold text-foreground">{isVerified ? "Book Appointment" : "Request Booking"}</h1>
        </div>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto space-y-5">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700"><span className="font-semibold">Emergency:</span> For chest pain, fractures, breathing difficulty, or heavy bleeding, visit the nearest hospital immediately.</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0"><Stethoscope className="w-7 h-7 text-blue-600" /></div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-800">{displayName}</h3>
              {displaySpec && <p className="text-sm text-gray-500">{displaySpec}</p>}
              {displayAddr && <p className="text-xs text-gray-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {displayAddr}</p>}
              {isVerified
                ? <Badge className="bg-emerald-100 text-emerald-700 mt-2"><ShieldCheck className="w-3 h-3 mr-1" /> MediTrust Verified</Badge>
                : <Badge className="bg-slate-100 text-slate-600 mt-2">External Listing</Badge>}
            </div>
          </div>
        </div>

        {availableConsultationTypes.length === 1 ? (
          <p className="text-sm text-gray-600">Offline clinic visit</p>
        ) : (
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Consultation Type</h3>
            <div className="grid grid-cols-2 gap-3">
              {availableConsultationTypes.map((c) => (
                <button key={c.id} onClick={() => setSelectedType(c.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-center relative ${selectedType === c.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
                  <c.icon className={`w-6 h-6 mx-auto mb-1 ${selectedType === c.id ? "text-blue-500" : "text-gray-400"}`} />
                  <p className="font-medium text-xs text-gray-800">{c.label}</p>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">{feeLabel}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        {!isVerified && <p className="text-xs text-gray-400 mt-2">Fees & availability confirmed after the doctor joins MediTrust.</p>}

        <div>
          <h3 className="font-semibold text-gray-800 mb-3">{t('selectDate')}</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {dates.map((date, idx) => {
              const dayOfWeek = date.getDay();
              const isWorkingDay = schedule?.working_days?.includes(dayOfWeek);
              const dateStr = format(date, "yyyy-MM-dd");
              const isBlocked = schedule?.blocked_dates?.includes(dateStr);
              return (
                <button key={idx} onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                  className={`flex-shrink-0 w-16 py-3 rounded-xl border-2 text-center transition-all ${selectedDate && format(selectedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd") ? "border-blue-500 bg-blue-50" : isVerified && (!isWorkingDay || isBlocked) ? "border-gray-100 bg-gray-50 text-gray-300" : "border-gray-200 bg-white"}`}>
                  <p className="text-xs text-gray-500">{format(date, 'EEE')}</p>
                  <p className="text-lg font-bold text-gray-800">{format(date, 'd')}</p>
                  <p className="text-xs text-gray-500">{format(date, 'MMM')}</p>
                </button>
              );
            })}
          </div>
          {isVerified && schedule && !schedule.working_days?.includes(new Date(selectedDate || new Date()).getDay()) && selectedDate && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Doctor is not available on this day. Select a working day.</p>
          )}
        </div>

        {selectedDate && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="font-semibold text-gray-800 mb-3">{t('selectTime')}</h3>
            {loadingSlots ? (
              <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
            ) : slotError ? (
              <DataError message={slotError} onRetry={() => setSlotReloadKey((key) => key + 1)} />
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-400">
                {isVerified ? "No available slots for this date. Try another day." : "Select a time slot below."}
                {isVerified && <div><Button size="sm" variant="outline" className="mt-2" onClick={() => setSelectedDate(null)}>Choose another date</Button></div>}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {availableSlots.map((s) => (
                    <button key={s.slot} onClick={() => s.available && setSelectedSlot(s.slot)} disabled={!s.available}
                      className={`py-2 px-1 rounded-xl border-2 text-xs font-medium transition-all ${!s.available ? "border-gray-100 bg-gray-50 text-gray-300 line-through" : selectedSlot === s.slot ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700"}`}>
                      {s.slot}
                    </button>
                  ))}
                </div>
                {availableSlots.some((s) => !s.available) && (
                  <p className="text-xs text-gray-400 mt-2">Greyed-out slots are fully booked.</p>
                )}
              </>
            )}
            {/* Fallback: for external providers without a schedule, show generic slots */}
            {!isVerified && availableSlots.length === 0 && (
              <div className="grid grid-cols-4 gap-2">
                {["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM"].map((slot) => (
                  <button key={slot} onClick={() => setSelectedSlot(slot)}
                    className={`py-2 px-1 rounded-xl border-2 text-xs font-medium transition-all ${selectedSlot === slot ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700"}`}>
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Reason for Visit */}
        {selectedSlot && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="font-semibold text-gray-800 mb-3">Reason for Visit (optional)</h3>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly describe your symptoms or reason for consultation..."
              className="rounded-xl min-h-[80px]" />
          </motion.div>
        )}

        {slotError && !selectedDate && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600">{slotError}</p>
          </div>
        )}
        {submitError && <div className="mb-3"><DataError message={submitError} onRetry={handleSubmit} /></div>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background dark:bg-zinc-900 border-t border-border p-4 shadow-lg pb-safe">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{isVerified ? "Consultation fee" : "Fee confirmed after onboarding"}</p>
            <p className="text-2xl font-bold text-foreground">{feeLabel}</p>
          </div>
          <Button onClick={handleSubmit} disabled={!selectedDate || !selectedSlot || submitting}
            className="h-12 px-6 bg-gradient-to-r from-blue-500 to-sky-500 rounded-xl font-semibold">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{isVerified ? "Book Appointment" : "Send Request"} <ChevronRight className="w-4 h-4 ml-1" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BookAppointment() {
  return (
    <LanguageProvider>
      <BookingContent />
    </LanguageProvider>
  );
}