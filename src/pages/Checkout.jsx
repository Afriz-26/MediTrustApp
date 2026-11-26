
import { db } from '@/api/client';

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, CheckCircle, Loader2, Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageProvider } from "@/components/ui/LanguageContext";

import { verifyAndRecordPayment, generateOrderId, generatePaymentId, generateTokenNumber, notifyPaymentSuccess } from "@/lib/paymentUtils";

function CheckoutContent() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(""); // "" | "verifying" | "success" | "failed"
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "" });
  const [userEmail, setUserEmail] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStatus(params.get("status") || "");
    setEntityType(params.get("entity") || "");
    setEntityId(params.get("id") || "");
    db.auth.me().then((me) => setUserEmail(me.email || "")).catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    if (!entityType || !entityId) return;
    setLoading(true);
    const entityName = entityType === "Appointment" ? "Appointment" : "MedicinePreOrder";
    db.entities[entityName]
      .get(entityId)
      .then((row) => setEntity(row))
      .catch(() => setEntity(null))
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  const amount = entity?.fee || entity?.total_amount || 0;
  const description =
    entityType === "Appointment"
      ? `Consultation: ${entity?.doctor_name || "Doctor"}`
      : `Medicine Order: ${entity?.pharmacy_name || "Pharmacy"}`;

  // Verify payment and update entity — creates Payment audit record.
  // When Builder+ is available, this calls a backend function that verifies
  // the Razorpay signature server-side before updating.
  const verifyAndPay = async () => {
    if (!card.number || !card.expiry || !card.cvc) return alert("Please enter card details");
    setPaying(true);
    try {
      const gatewayOrderId = generateOrderId();
      const gatewayPaymentId = generatePaymentId();
      const entityName = entityType === "Appointment" ? "Appointment" : "MedicinePreOrder";
      const patientEmail = userEmail || entity?.patient_email || "";

      // Step 1: Show verifying state
      setStatus("verifying");

      // Step 2: Create Payment audit record (client-side demo verification)
      const { verified, payment } = await verifyAndRecordPayment({
        userEmail: patientEmail,
        amount,
        paymentType: entityType === "Appointment" ? "appointment" : "medicine_order",
        linkedEntityId: entityId,
        linkedEntityType: entityType,
        gatewayPaymentId,
        gatewayOrderId,
        description,
      });

      if (!verified) {
        setStatus("failed");
        return;
      }

      // Step 3: Update the linked entity
      const updateData = {
        payment_status: "paid",
        onboarding_status: "paid",
        payment_id: payment?.id || gatewayPaymentId,
      };
      if (entityType === "Appointment") {
        // Appointment: generate token and confirm (doctor acceptance flow already handled)
        updateData.token_number = generateTokenNumber();
        setGeneratedToken(updateData.token_number);
        updateData.status = "confirmed";
      } else {
        updateData.status = "accepted";
      }
      await db.entities[entityName].update(entityId, updateData);

      // Step 4: Notify the user
      await notifyPaymentSuccess(
        patientEmail,
        "Payment Successful",
        `Your ${entityType === "Appointment" ? "appointment is confirmed" : "medicine order is confirmed"}. Token: ${updateData.token_number || "N/A"}`,
        entityType === "Appointment" ? "/PatientAppointments" : "/PatientDashboard"
      );

      setStatus("success");
    } catch (e) {
      setStatus("failed");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mb-5">
          <CheckCircle className="w-12 h-12 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Payment Successful!</h2>
        <p className="text-gray-500 text-center mb-2 text-sm max-w-sm">
          Your {entityType === 'Appointment' ? 'appointment is confirmed' : 'medicine order is confirmed'}.
          {entityType === 'Appointment' && generatedToken && (
            <span className="block mt-1 font-semibold text-emerald-600">Token: {generatedToken}</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 mb-5 text-xs text-gray-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Payment verified & recorded
        </div>
        <Button onClick={() => navigate(createPageUrl(entityType === 'Appointment' ? 'PatientAppointments' : 'PatientDashboard'))}
          className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl px-8">
          Continue
        </Button>
      </div>
    );
  }

  if (status === "verifying") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 border-4 border-blue-200 border-t-blue-500 rounded-full mb-5"
        />
        <h2 className="text-xl font-bold text-gray-800 mb-1">Verifying Payment...</h2>
        <p className="text-gray-500 text-center text-sm max-w-sm">
          Confirming your transaction securely. Please don't close this page.
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center mb-5">
          <AlertCircle className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Payment Failed</h2>
        <p className="text-gray-500 text-center mb-5 text-sm max-w-sm">
          We couldn't process your payment. Please try again or contact support.
        </p>
        <Button onClick={() => setStatus("")} className="bg-gradient-to-r from-blue-500 to-sky-500 rounded-xl px-8">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-10">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
          <h1 className="font-semibold text-gray-800">Checkout</h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>Demo payment mode.</strong> Real Razorpay checkout with server-side signature verification requires a Builder+ plan (backend function). This screen processes a simulated payment with full audit trail so you can test the complete flow.
          </p>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">Payment Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Description</span><span className="font-medium text-right">{description}</span></div>
            {entityType === 'Appointment' && entity?.date && (
              <div className="flex justify-between"><span className="text-gray-500">Date & Time</span><span className="font-medium">{entity.date} • {entity.time_slot}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium capitalize">{entity?.appointment_type || entity?.order_type || ''}</span></div>
            <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
              <span className="font-bold text-gray-800">Total</span>
              <span className="text-2xl font-bold text-gray-800">₹{amount}</span>
            </div>
          </div>
        </div>

        {/* Card form */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-800">Card Details</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Card Number</label>
              <Input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })}
                placeholder="4242 4242 4242 4242" className="h-12 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Expiry</label>
                <Input value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                  placeholder="MM/YY" className="h-12 rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">CVC</label>
                <Input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                  placeholder="123" className="h-12 rounded-xl" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
            <Lock className="w-3 h-3" /> Test mode — no real charge. Use any test card details.
          </div>
        </div>

        <Button onClick={verifyAndPay} disabled={paying || !amount}
          className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl font-semibold">
          {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay ₹${amount}`}
        </Button>
      </div>
    </div>
  );
}

export default function Checkout() {
  return (
    <LanguageProvider>
      <CheckoutContent />
    </LanguageProvider>
  );
}