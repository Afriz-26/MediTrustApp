import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

export const isIframe = window.self !== window.top;

export function formatDoctorName(name) {
  const doctorName = name?.trim();
  if (!doctorName) return '';
  return /^Dr\.?(?:\s|$)/i.test(doctorName) ? doctorName : `Dr. ${doctorName}`;
}

export function formatSpecialization(value) {
  return (value || '').replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
