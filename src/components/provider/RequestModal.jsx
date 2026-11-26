
import { db } from '@/api/client';

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Stethoscope, Pill, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createProviderRequest } from "@/lib/providerRequests";

// Reusable "Request this provider to join MediTrust" modal.
// provider: { osm_id, osm_name, osm_address, lat, lng, specialization, phone, tags }
// type: "doctor" | "pharmacy"
export default function RequestModal({ open, onClose, provider, type, location, linkedEntityType = "none", linkedEntityId = "", onSubmitted }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [requester, setRequester] = useState(null);

  useEffect(() => {
    if (open) {
      db.auth.me()
        .then((me) => setRequester(me))
        .catch(() => setRequester(null));
    }
  }, [open]);

  if (!open || !provider) return null;

  const isDoctor = type === "doctor";

  const handleSubmit = async () => {
    if (!requester?.email) {
      alert("Please sign in to submit a request.");
      return;
    }
    setSubmitting(true);
    try {
      await createProviderRequest({
        type,
        osmId: provider.osm_id,
        name: provider.osm_name || provider.name,
        address: provider.osm_address,
        phone: provider.phone || "",
        lat: provider.lat,
        lng: provider.lng,
        tags: provider.tags || (provider.specialization ? { specialization: provider.specialization } : {}),
        requesterEmail: requester.email,
        requesterName: requester.full_name || requester.email,
        linkedEntityType,
        linkedEntityId,
        reason,
        state: location?.state || "",
        city: location?.city || "",
        pincode: location?.pincode || "",
      });
      setDone(true);
      onSubmitted && onSubmitted();
    } catch (e) {
      alert("Failed to submit request: " + (e.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    setReason("");
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto pb-safe"
        >
        {done ? (
          <div className="text-center py-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-10 h-10 text-white" />
            </motion.div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Request Sent!</h2>
            <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">
              We've received your request for <strong>{provider.osm_name || provider.name}</strong>. Our team can review the details and contact them about joining MediTrust.
            </p>
            <Button onClick={handleClose} className="bg-gradient-to-r from-blue-500 to-sky-500 rounded-xl px-8">Done</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">
                {isDoctor ? "Request this Doctor" : "Request this Pharmacy"}
              </h2>
              <button onClick={handleClose} className="p-1 -mr-1 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-3 flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDoctor ? "bg-blue-100" : "bg-pink-100"}`}>
                {isDoctor ? <Stethoscope className="w-5 h-5 text-blue-600" /> : <Pill className="w-5 h-5 text-pink-600" />}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{provider.osm_name || provider.name}</p>
                {provider.specialization && <p className="text-xs text-gray-500">{provider.specialization}</p>}
                {provider.osm_address && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {provider.osm_address}</p>
                )}
                {provider.phone && <p className="text-xs text-gray-500 mt-0.5">Phone: {provider.phone}</p>}
                <span className="inline-block mt-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {linkedEntityType === "none" ? "External Listing" : "MediTrust provider"}
                </span>
              </div>
            </div>

            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Why do you want them on MediTrust? <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isDoctor ? "e.g. My regular doctor, recommended by family, nearby clinic…" : "e.g. My usual pharmacy, stocks my prescription, close to home…"}
              className="rounded-xl mb-4 min-h-[90px]"
              maxLength={500}
            />

            <Button
              onClick={handleSubmit}
              disabled={submitting || !requester}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-sky-500 rounded-xl font-semibold"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Request to Join MediTrust</>}
            </Button>
            <p className="text-xs text-gray-400 text-center mt-3">
              We never invent provider details. We'll contact them directly and verify before listing.
            </p>
          </>
        )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}