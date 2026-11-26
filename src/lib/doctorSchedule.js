

import { db } from '@/api/client';

import { format } from 'date-fns';

// Default schedule: Mon–Sat, morning 09:00–13:00, evening 16:00–20:00, 30-min slots
export const DEFAULT_SCHEDULE = {
  working_days: [1, 2, 3, 4, 5, 6],
  morning_start: '09:00',
  morning_end: '13:00',
  evening_start: '16:00',
  evening_end: '20:00',
  slot_duration_minutes: 30,
  max_per_slot: 1,
  daily_token_start: 1,
  walk_in_reserve_pct: 0,
  is_active: true,
  blocked_dates: [],
};

// ── Slot generation ──────────────────────────────────────────────────────────

export function generateSlots(schedule, date) {
  if (!schedule || !schedule.is_active) return [];
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();
  if (!schedule.working_days || !schedule.working_days.includes(dayOfWeek)) return [];
  const dateStr = format(dateObj, 'yyyy-MM-dd');
  if (schedule.blocked_dates && schedule.blocked_dates.includes(dateStr)) return [];

  const duration = schedule.slot_duration_minutes || 30;
  const slots = [];
  if (schedule.morning_start && schedule.morning_end) {
    slots.push(...generateSlotRange(schedule.morning_start, schedule.morning_end, duration));
  }
  if (schedule.evening_start && schedule.evening_end) {
    slots.push(...generateSlotRange(schedule.evening_start, schedule.evening_end, duration));
  }
  return slots;
}

function generateSlotRange(start, end, durationMinutes) {
  const slots = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (current + durationMinutes <= endMin) {
    slots.push(formatSlotTime(current));
    current += durationMinutes;
  }
  return slots;
}

function formatSlotTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

// ── Availability checking ─────────────────────────────────────────────────────

// Returns a map of { time_slot: booked_count } for active appointments
export async function getBookedSlotCounts(doctorEmail, date) {
  const page = await db.entities.Appointment.filter({
    doctor_email: doctorEmail,
    date: date,
  }, { limit: 200 });
  const appointments = page;
  const counts = {};
  for (const apt of appointments) {
    if (apt.status === 'pending' || apt.status === 'confirmed') {
      counts[apt.time_slot] = (counts[apt.time_slot] || 0) + 1;
    }
  }
  return counts;
}

// Check if a specific slot is still available
export async function isSlotAvailable(doctorEmail, date, timeSlot, maxPerSlot) {
  const counts = await getBookedSlotCounts(doctorEmail, date);
  return (counts[timeSlot] || 0) < (maxPerSlot || 1);
}

// ── Schedule CRUD ─────────────────────────────────────────────────────────────

export async function getDoctorSchedule(doctorEmail) {
  const page = await db.entities.DoctorSchedule.filter(
    { doctor_email: doctorEmail },
    { limit: 1 }
  );
  return page.length > 0 ? page[0] : null;
}

export async function saveDoctorSchedule(doctorEmail, scheduleData) {
  const existing = await getDoctorSchedule(doctorEmail);
  if (existing) {
    return db.entities.DoctorSchedule.update(existing.id, { ...scheduleData, doctor_email: doctorEmail });
  }
  return db.entities.DoctorSchedule.create({ ...scheduleData, doctor_email: doctorEmail });
}