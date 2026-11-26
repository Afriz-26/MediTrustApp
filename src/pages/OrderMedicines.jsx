
import { db } from '@/api/client';

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Pill, Plus, Minus, CheckCircle, Package, Calendar, Clock, Loader2, ShoppingCart, Store, ShieldCheck, Navigation
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage, LanguageProvider } from "@/components/ui/LanguageContext";

import { getDirectionsUrl } from "@/lib/maps";
import RequestModal from "@/components/provider/RequestModal";
import { getRequestedProviderIds, hasRequestedProvider, isBookable } from "@/lib/providers";
import { DataError } from '@/components/common/DataState';

const timeSlots = [
  "09:00 AM - 10:00 AM", "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM",
  "12:00 PM - 01:00 PM", "02:00 PM - 03:00 PM", "03:00 PM - 04:00 PM",
  "04:00 PM - 05:00 PM", "05:00 PM - 06:00 PM", "06:00 PM - 07:00 PM",
];

function OrderMedicinesContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [pharmacy, setPharmacy] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [done, setDone] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [userLoc, setUserLoc] = useState(null);
  const [requestedProviderIds, setRequestedProviderIds] = useState(new Set());
  const [requestStatusError, setRequestStatusError] = useState("");
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [rxFilter, setRxFilter] = useState("all");
  const [recentRx, setRecentRx] = useState(null); // null = unknown, true/false = has a prescription from the last 30 days

  const loadRequestStatus = useCallback(async () => {
    try {
      const me = await db.auth.me();
      setRequestedProviderIds(await getRequestedProviderIds("pharmacy", me?.email));
      setRequestStatusError('');
    } catch (error) {
      console.error('Failed to load pharmacy request status.', error);
      setRequestStatusError(error.message || "Failed to load your provider requests.");
    }
  }, []);

  const loadPharmacy = useCallback(async () => {
    const saved = localStorage.getItem("meditrust_location");
    if (saved) setUserLoc(JSON.parse(saved));
    const params = new URLSearchParams(window.location.search);
    const pharmacyId = params.get("pharmacyId");
    if (!pharmacyId) {
      setInventoryError('');
      setLoadingInv(false);
      return;
    }
    setLoadingInv(true);
    setInventoryError('');
    try {
      const selectedPharmacy = await db.entities.PharmacyProfile.get(pharmacyId);
      if (!selectedPharmacy) throw new Error("This pharmacy could not be found.");
      setPharmacy(selectedPharmacy);
      const page = await db.entities.PharmacyInventory.filter(
        { pharmacy_email: selectedPharmacy.email, in_stock: true },
        { sort: 'medicine_name', limit: 200 }
      );
      setInventory(page);
    } catch (error) {
      console.error('Failed to load pharmacy or inventory.', error);
      setInventoryError(error.message || "Failed to load this pharmacy's inventory.");
    } finally {
      setLoadingInv(false);
    }
  }, []);

  useEffect(() => {
    loadPharmacy();
    loadRequestStatus();
  }, [loadPharmacy, loadRequestStatus]);

  // Prescription-only medicines need a MediTrust prescription from the last 30 days (the database enforces this too).
  useEffect(() => {
    db.entities.Prescription.list()
      .then((rows) => {
        const cutoff = Date.now() - 30 * 86400000;
        setRecentRx(rows.some((r) => new Date(r.created_date).getTime() > cutoff));
      })
      .catch(() => setRecentRx(null));
  }, []);

  const filteredInv = inventory.filter((item) => {
    if (rxFilter === "otc" && item.rx_only) return false;
    if (rxFilter === "rx" && !item.rx_only) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return [item.medicine_name, item.generic_name, item.medicine_strength].some((v) => (v || '').toLowerCase().includes(q));
  });

  const addToCart = (id) => {
    const item = inventory.find((row) => row.id === id);
    if (!Number.isFinite(Number(item?.price)) || Number(item.price) <= 0) return;
    const maxQty = Number(item.stock_quantity) > 0 ? Math.min(20, Number(item.stock_quantity)) : 20;
    if ((cart[id] || 0) >= maxQty) return;
    setCart({ ...cart, [id]: (cart[id] || 0) + 1 });
  };
  const removeFromCart = (id) => {
    if (cart[id] > 1) setCart({ ...cart, [id]: cart[id] - 1 });
    else { const c = { ...cart }; delete c[id]; setCart(c); }
  };
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartHasRx = Object.keys(cart).some((id) => inventory.find((x) => x.id === id)?.rx_only);
  const rxBlocked = cartHasRx && recentRx === false;

  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = inventory.find((x) => x.id === id);
    if (!Number.isFinite(Number(item?.price)) || Number(item.price) <= 0) return null;
    return sum === null ? null : sum + Number(item.price) * qty;
  }, 0);

  // No pharmacy selected → redirect
  if (loadingInv) {
    return <div role="status" aria-label="Loading pharmacy inventory" className="min-h-screen flex justify-center items-center"><Loader2 className="w-8 h-8 text-pink-500 animate-spin" /></div>;
  }

  if (!pharmacy && !loadingInv) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-rose-50 flex flex-col items-center justify-center p-6">
        <Store className="w-16 h-16 text-pink-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">{inventoryError ? 'Could not load pharmacy' : 'Select a Pharmacy First'}</h2>
        <p className="text-sm text-gray-500 text-center mb-5 max-w-sm">
          {inventoryError || 'Browse verified pharmacies near you and select one to order medicines for pickup.'}
        </p>
        {inventoryError ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadPharmacy} className="rounded-xl">Retry</Button>
            <Button onClick={() => navigate(createPageUrl('Pharmacies'))} className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl">Find Pharmacies</Button>
          </div>
        ) : <Button onClick={() => navigate(createPageUrl('Pharmacies'))} className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl px-8">Find Pharmacies</Button>}
      </div>
    );
  }

  const pharmacyIsBookable = isBookable(pharmacy, "pharmacy");
  const requestTarget = pharmacy ? {
    osm_id: pharmacy.id,
    osm_name: pharmacy.name,
    osm_address: pharmacy.address,
    lat: pharmacy.lat,
    lng: pharmacy.lng,
    linkedEntityType: "PharmacyProfile",
    linkedEntityId: pharmacy.id,
  } : null;

  if (pharmacy && !pharmacyIsBookable) {
    const alreadyRequested = hasRequestedProvider(requestedProviderIds, requestTarget);
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-rose-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-md w-full text-center">
          <Store className="w-12 h-12 text-pink-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">{pharmacy.name}</h1>
          <p className="text-sm text-gray-600">This provider has not joined MediTrust yet</p>
          {requestStatusError && (
            <div role="alert" className="mt-3">
              <p className="text-sm text-red-600">{requestStatusError}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={loadRequestStatus}>Retry</Button>
            </div>
          )}
          <Button onClick={() => setRequestModalOpen(true)} disabled={alreadyRequested} className="w-full mt-5 rounded-xl">
            {alreadyRequested ? "Requested" : "Request"}
          </Button>
          <Button variant="outline" onClick={() => navigate(createPageUrl("Pharmacies"))} className="w-full mt-2 rounded-xl">
            Find pharmacies
          </Button>
        </div>
        <RequestModal
          open={requestModalOpen}
          provider={requestTarget}
          type="pharmacy"
          linkedEntityType="PharmacyProfile"
          linkedEntityId={pharmacy.id}
          onSubmitted={() => setRequestedProviderIds((current) => new Set([...current, pharmacy.id].map(String)))}
          onClose={() => setRequestModalOpen(false)}
        />
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTimeSlot) return alert("Please select date and time slot");
    if (cartTotal === null) return alert("Ask the pharmacy to confirm the price before reserving.");
    setSubmitting(true);
    try {
      const me = await db.auth.me();
      const items = Object.entries(cart).map(([id, qty]) => {
        const item = inventory.find((x) => x.id === id);
        return {
          medicine_id: item?.medicine_id || id,
          medicine_name: item?.medicine_name || "Unknown",
          quantity: qty,
          price: Number(item.price),
          stock_status: "in_stock",
        };
      });

      const order = await db.entities.MedicinePreOrder.create({
        patient_email: me.email || "",
        patient_name: me.full_name || "",
        patient_phone: "",
        pharmacy_id: pharmacy.id,
        pharmacy_name: pharmacy.name,
        osm_name: pharmacy.name,
        osm_address: pharmacy.address || "",
        osm_lat: pharmacy.lat,
        osm_lng: pharmacy.lng,
        order_type: "pickup",
        preferred_date: selectedDate,
        preferred_time_slot: selectedTimeSlot,
        medicines: items,
        total_amount: cartTotal,
        status: "pending",
        onboarding_status: "onboarded",
        payment_status: "unpaid",
      });

      setDone({ orderId: order.id });
    } catch (e) {
      console.error('Failed to place medicine reservation.', e);
      alert("Failed to place order: " + (e.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirmation ──
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-rose-50 flex flex-col items-center justify-center p-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mb-5">
          <CheckCircle className="w-12 h-12 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Reservation Sent!</h2>
        <p className="text-gray-500 text-center mb-5 text-sm max-w-sm">
          Your medicine reservation for <strong>{pharmacy.name}</strong> has been sent. The pharmacy will confirm and prepare your order for pickup.
        </p>
        <div className="bg-white rounded-2xl p-5 w-full max-w-sm border border-gray-100 shadow-sm mb-5">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Pharmacy</span><span className="font-medium">{pharmacy.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">Pickup</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{selectedDate}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{selectedTimeSlot}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Items</span><span className="font-medium">{cartCount}</span></div>
            <div className="border-t border-gray-100 pt-2 flex justify-between"><span className="font-bold">Total</span><span className="font-bold text-pink-600">₹{cartTotal}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><Badge className="bg-amber-100 text-amber-700">Pending confirmation</Badge></div>
          </div>
        </div>
        <Button onClick={() => navigate(createPageUrl('PatientDashboard'))} className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl px-8">Back to Dashboard</Button>
      </div>
    );
  }

  // ── Checkout step ──
  if (showCheckout) {
    const minDate = new Date().toISOString().split("T")[0];
    const maxDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-rose-50 pb-10">
        <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 pt-12 pb-6 px-4 rounded-b-3xl">
          <div className="max-w-md mx-auto flex items-center gap-4">
            <button onClick={() => setShowCheckout(false)} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-white" /></button>
            <h1 className="text-xl font-bold text-white">Reserve Pickup Slot</h1>
          </div>
        </div>
        <div className="px-4 py-6 max-w-md mx-auto space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
            <Package className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-emerald-700"><strong>Pickup only.</strong> No delivery available. Visit the pharmacy to collect your order.</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0"><Store className="w-5 h-5 text-pink-600" /></div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">{pharmacy.name}</p>
              {pharmacy.address && <p className="text-xs text-gray-500">{pharmacy.address}</p>}
              <Badge className="bg-emerald-100 text-emerald-700 mt-1 text-[10px]"><ShieldCheck className="w-3 h-3 mr-1" /> MediTrust Verified</Badge>
            </div>
            {pharmacy.lat && pharmacy.lng && userLoc && (
              <a href={getDirectionsUrl(pharmacy.lat, pharmacy.lng, userLoc.lat, userLoc.lng)} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="rounded-xl"><Navigation className="w-4 h-4" /></Button>
              </a>
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><Calendar className="w-5 h-5 text-pink-500" /> Preferred Date</label>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={minDate} max={maxDate} className="h-12 rounded-xl mt-1" />
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><Clock className="w-5 h-5 text-pink-500" /> Preferred Time Slot</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {timeSlots.map((s) => (
                <button key={s} onClick={() => setSelectedTimeSlot(s)} className={`p-3 rounded-xl text-sm font-medium ${selectedTimeSlot === s ? "bg-pink-500 text-white" : "bg-gray-50 text-gray-600 border border-gray-200"}`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-3">Order Summary</h3>
            <div className="space-y-1 mb-3">
              {Object.entries(cart).map(([id, qty]) => {
                const item = inventory.find((x) => x.id === id);
                return (
                  <div key={id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item?.medicine_name || id} × {qty}</span>
                    <span className="text-gray-600 font-medium">₹{(item?.price || 0) * qty}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-100 pt-2 flex justify-between"><span className="font-bold">Total</span><span className="font-bold text-pink-600">₹{cartTotal}</span></div>
            <p className="text-xs text-gray-400 mt-2">Pay at pharmacy during pickup.</p>
            <p className="text-xs text-gray-500 mt-1">This total is an estimate. The pharmacy confirms the final price when it accepts, and it can never be above the MRP shown.</p>
            {cartHasRx && (recentRx === false ? (
              <p className="mt-2 text-xs text-red-600">
                Your order has prescription-only medicines and you have no MediTrust prescription from the last 30 days. Remove them, or{' '}
                <Link to={createPageUrl('FindDoctors')} className="underline font-medium">book a doctor</Link> first.
              </p>
            ) : (
              <p className="mt-2 text-xs text-emerald-700">Your latest MediTrust prescription will be attached for the prescription medicines.</p>
            ))}
          </div>

          <Button onClick={handleSubmit} disabled={!selectedDate || !selectedTimeSlot || submitting || rxBlocked}
            className="w-full h-12 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl font-semibold">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reservation'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Main browse + cart ──
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-rose-50 pb-24">
      <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 pt-12 pb-6 px-4 rounded-b-3xl sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link to={createPageUrl('Pharmacies')} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-white" /></Link>
            <h1 className="text-xl font-bold text-white flex-1">Order Medicines</h1>
          </div>
          <div className="bg-white rounded-xl p-3 mb-3 flex items-center gap-2">
            <Store className="w-5 h-5 text-pink-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 text-sm truncate">{pharmacy?.name}</p>
              <p className="text-xs text-gray-400 truncate">{pharmacy?.address}</p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] flex-shrink-0"><ShieldCheck className="w-3 h-3 mr-1" /> Verified</Badge>
          </div>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by medicine name or salt (e.g. Paracetamol)"
            className="h-11 rounded-xl bg-white border-0 shadow"
          />
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {[["all", "All"], ["otc", "No prescription needed"], ["rx", "Prescription needed"]].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRxFilter(id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border ${rxFilter === id ? "bg-white text-pink-600 border-white" : "bg-white/20 text-white border-white/40"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-md mx-auto">
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <Package className="w-4 h-4 text-pink-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-pink-700"><strong>Pickup only.</strong> Add medicines and choose how many you need, then reserve a pickup time. Pay at the pharmacy. Prices shown are the pharmacy's own and can never be above the MRP printed on the pack. Medicines marked "Prescription needed" can only be reserved if a MediTrust doctor gave you a prescription in the last 30 days.</p>
        </div>

        {inventoryError ? (
          <DataError message={inventoryError} onRetry={loadPharmacy} />
        ) : filteredInv.length === 0 ? (
          <div className="text-center py-12">
            <Pill className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{searchQuery.trim() ? `No items match "${searchQuery}"` : "This pharmacy hasn't added inventory yet"}</p>
            <p className="text-xs text-gray-400 mt-1">Try a different pharmacy or check back later.</p>
            <Button type="button" variant="outline" className="mt-3 rounded-xl" onClick={() => navigate(createPageUrl('Pharmacies'))}>Find pharmacies</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInv.map((item) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
                    <Pill className="w-6 h-6 text-pink-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm">{item.medicine_name}</h3>
                    <p className="text-xs text-gray-500">
                      {[item.medicine_strength, item.medicine_form].filter(Boolean).join(' · ')}
                      {item.generic_name && item.generic_name.toLowerCase() !== (item.medicine_name || '').toLowerCase() ? `${item.medicine_strength || item.medicine_form ? ' · ' : ''}${item.generic_name}` : ''}
                    </p>
                    {item.batch_number && <p className="text-xs text-gray-400 mt-0.5">Batch: {item.batch_number}</p>}
                    {item.expiry_date && <p className="text-xs text-gray-400">Exp: {item.expiry_date}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-sm font-bold text-pink-600">
                        {Number.isFinite(Number(item.price)) && Number(item.price) > 0 ? `₹${item.price}` : 'Ask pharmacy'}
                      </span>
                      {Number(item.mrp) > Number(item.price) && Number(item.price) > 0 && (
                        <span className="text-xs text-gray-400"><s>MRP ₹{item.mrp}</s> · save ₹{(Number(item.mrp) - Number(item.price)).toFixed(0)}</span>
                      )}
                      {Number(item.mrp) > 0 && Number(item.mrp) === Number(item.price) && (
                        <span className="text-xs text-gray-400">MRP</span>
                      )}
                      <Badge className="bg-green-100 text-green-700 text-[10px]">
                        Available{Number(item.stock_quantity) > 0 ? ` · ${item.stock_quantity} in stock` : ''}
                      </Badge>
                      {item.rx_only && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Prescription needed</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end">
                  {cart[item.id] ? (
                    <div className="flex items-center gap-3">
                      <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"><Minus className="w-4 h-4 text-gray-600" /></button>
                      <span className="font-semibold w-6 text-center">{cart[item.id]}</span>
                      <button onClick={() => addToCart(item.id)} className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center"><Plus className="w-4 h-4 text-white" /></button>
                    </div>
                  ) : Number.isFinite(Number(item.price)) && Number(item.price) > 0 ? (
                    <Button onClick={() => addToCart(item.id)} size="sm" className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl"><Plus className="w-4 h-4 mr-1" /> Add</Button>
                  ) : (
                    <span className="text-xs text-gray-500">Confirm price with pharmacy to reserve</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-lg pb-safe">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 flex items-center gap-1"><ShoppingCart className="w-4 h-4" /> {cartCount} items</p>
              <p className="text-lg font-bold text-gray-800">{cartTotal === null ? 'Ask pharmacy' : `₹${cartTotal}`} <span className="text-xs font-normal text-gray-400">estimated</span></p>
            </div>
            <Button onClick={() => setShowCheckout(true)} className="h-12 px-8 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl font-semibold">
              <Calendar className="w-5 h-5 mr-2" /> Reserve Pickup
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderMedicines() {
  return (
    <LanguageProvider>
      <OrderMedicinesContent />
    </LanguageProvider>
  );
}