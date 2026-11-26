
import { db } from '@/api/client';

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft, Stethoscope, Pill, MapPin, Mail, User, CheckCircle, XCircle,
  Loader2, Users, ShieldCheck, Bell, TrendingUp
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage, LanguageProvider } from "@/components/ui/LanguageContext";

import { notifyRequestersOfOnboarding } from "@/lib/providerRequests";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "high", label: "High Demand" },
  { id: "contacted", label: "Contacted" },
  { id: "invited", label: "Invited" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

function BuilderPanelContent() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("doctor");
  const [filter, setFilter] = useState("all");
  const [aggregates, setAggregates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState("");
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [aggs, reqs] = await Promise.all([
        db.entities.ProviderExternalSource.list("-latest_request_date", 200),
        db.entities.ProviderRequest.list("-created_date", 200),
      ]);
      setAggregates(aggs || []);
      setRequests(reqs || []);
    } catch (e) {
      setAggregates([]); setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Realtime: reload when requests or aggregates change.
    const unsubReq = db.entities.ProviderRequest.subscribe(() => load());
    const unsubAgg = db.entities.ProviderExternalSource.subscribe(() => load());
    return () => { unsubReq && unsubReq(); unsubAgg && unsubAgg(); };
  }, []);

  const requestsByExt = useMemo(() => {
    const m = {};
    for (const r of requests) {
      (m[r.external_provider_id] = m[r.external_provider_id] || []).push(r);
    }
    return m;
  }, [requests]);

  const filtered = useMemo(() => {
    return aggregates
      .filter((a) => a.provider_type === tab)
      .filter((a) => {
        if (filter === "all") return true;
        if (filter === "high") return (a.request_count || 0) >= 2 && a.status !== "approved" && a.status !== "rejected";
        return a.status === filter;
      })
      .sort((a, b) => (b.request_count || 0) - (a.request_count || 0));
  }, [aggregates, tab, filter]);

  const pendingCount = aggregates.filter((a) => a.status === "pending").length;

  const setStatus = async (agg, status) => {
    setActioning(agg.id + status);
    try {
      await db.entities.ProviderExternalSource.update(agg.id, { status });
      await db.entities.ProviderRequest.updateMany(
        { external_provider_id: agg.external_provider_id, request_type: agg.provider_type },
        { $set: { status } }
      );
      load();
    } catch (e) {
      alert("Failed: " + (e.message || "Unknown error"));
    } finally {
      setActioning("");
    }
  };

  const approve = async (agg) => {
    setActioning(agg.id + "approve");
    try {
      let profileId = "";
      if (agg.provider_type === "doctor") {
        const profile = await db.entities.DoctorProfile.create({
          email: `osm_${agg.external_provider_id}@meditrust.app`,
          name: agg.name, specialization: "general_physician",
          hospital_name: agg.name, hospital_address: agg.address, is_verified: true,
        });
        profileId = profile.id;
      } else {
        const profile = await db.entities.PharmacyProfile.create({
          email: `osm_${agg.external_provider_id}@meditrust.app`,
          name: agg.name, address: agg.address, is_verified: true, delivery_available: true,
        });
        profileId = profile.id;
      }
      await db.entities.ProviderExternalSource.update(agg.id, { status: "approved", linked_profile_id: profileId });
      await db.entities.ProviderRequest.updateMany(
        { external_provider_id: agg.external_provider_id, request_type: agg.provider_type },
        { $set: { status: "approved", linked_profile_id: profileId } }
      );
      // Update linked appointments / orders
      const reqs = requestsByExt[agg.external_provider_id] || [];
      for (const r of reqs) {
        if (r.linked_entity_type === "Appointment" && r.linked_entity_id) {
          await db.entities.Appointment.update(r.linked_entity_id, { onboarding_status: "onboarded", doctor_email: `osm_${agg.external_provider_id}@meditrust.app` });
        } else if (r.linked_entity_type === "MedicinePreOrder" && r.linked_entity_id) {
          await db.entities.MedicinePreOrder.update(r.linked_entity_id, { onboarding_status: "onboarded" });
        }
      }
      await notifyRequestersOfOnboarding({ externalId: agg.external_provider_id, providerType: agg.provider_type, providerName: agg.name });
      load();
    } catch (e) {
      alert("Failed to approve: " + (e.message || "Unknown error"));
    } finally {
      setActioning("");
    }
  };

  const statusBadge = (status) => {
    const map = {
      pending: "bg-amber-100 text-amber-700",
      contacted: "bg-blue-100 text-blue-700",
      invited: "bg-violet-100 text-violet-700",
      approved: "bg-emerald-100 text-emerald-700",
      rejected: "bg-red-100 text-red-700",
    };
    return <Badge className={map[status] || "bg-gray-100 text-gray-600"}>{status}</Badge>;
  };

  const AggCard = ({ agg }) => {
    const reqs = requestsByExt[agg.external_provider_id] || [];
    const isExpanded = expanded === agg.id;
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${agg.provider_type === "doctor" ? "bg-blue-100" : "bg-pink-100"}`}>
            {agg.provider_type === "doctor" ? <Stethoscope className="w-6 h-6 text-blue-600" /> : <Pill className="w-6 h-6 text-pink-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-800 text-sm truncate">{agg.name}</h3>
              {statusBadge(agg.status)}
            </div>
            {agg.address && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {agg.address}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1 font-medium text-amber-600"><Users className="w-3 h-3" /> {agg.request_count} request{agg.request_count !== 1 ? "s" : ""}</span>
              {agg.city && <span>· {agg.city}{agg.state ? ", " + agg.state : ""}</span>}
            </div>
            <button onClick={() => setExpanded(isExpanded ? null : agg.id)} className="text-xs text-blue-600 mt-2">
              {isExpanded ? "Hide requesters" : `View ${reqs.length} requester${reqs.length !== 1 ? "s" : ""}`}
            </button>

            {isExpanded && (
              <div className="mt-2 space-y-1.5 pl-1 border-l-2 border-gray-100">
                {reqs.length === 0 && <p className="text-xs text-gray-400">No detailed requests.</p>}
                {reqs.map((r) => (
                  <div key={r.id} className="text-xs text-gray-600 pl-2">
                    <p className="flex items-center gap-1"><User className="w-3 h-3" /> {r.requested_by_name || "—"} · <Mail className="w-3 h-3" /> {r.requested_by_email}</p>
                    {r.reason && <p className="text-gray-500 italic">"{r.reason}"</p>}
                    {r.linked_entity_type && r.linked_entity_type !== "none" && <p className="text-gray-400">Linked: {r.linked_entity_type}</p>}
                  </div>
                ))}
              </div>
            )}

            {agg.status !== "approved" && agg.status !== "rejected" && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button onClick={() => setStatus(agg, "contacted")} disabled={!!actioning} size="sm" variant="outline" className="rounded-lg h-8 text-xs">Mark Contacted</Button>
                <Button onClick={() => setStatus(agg, "invited")} disabled={!!actioning} size="sm" variant="outline" className="rounded-lg h-8 text-xs">Invite</Button>
                <Button onClick={() => approve(agg)} disabled={!!actioning} size="sm" className="rounded-lg h-8 text-xs bg-gradient-to-r from-emerald-500 to-green-500">
                  {actioning === agg.id + "approve" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3 mr-1" />} Approve
                </Button>
                <Button onClick={() => setStatus(agg, "rejected")} disabled={!!actioning} size="sm" variant="outline" className="rounded-lg h-8 text-xs text-red-600 border-red-200">
                  <XCircle className="w-3 h-3 mr-1" /> Reject
                </Button>
              </div>
            )}
            {agg.status === "approved" && agg.linked_profile_id && (
              <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Onboarded & verified · notified {requestsByExt[agg.external_provider_id]?.length || 0} patient(s)</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10 pt-safe">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link to={createPageUrl("Welcome")} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-gray-600" /></Link>
          <h1 className="font-semibold text-gray-800 flex items-center gap-2"><Bell className="w-5 h-5" /> Provider Onboarding</h1>
          <Badge className="bg-amber-100 text-amber-700 ml-auto">{pendingCount} pending</Badge>
        </div>
      </div>

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-2xl font-bold text-blue-600">{aggregates.filter(a => a.provider_type === "doctor").length}</p>
            <p className="text-xs text-gray-500">Doctor requests</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-2xl font-bold text-pink-600">{aggregates.filter(a => a.provider_type === "pharmacy").length}</p>
            <p className="text-xs text-gray-500">Pharmacy requests</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-2xl font-bold text-emerald-600">{aggregates.filter(a => a.status === "approved").length}</p>
            <p className="text-xs text-gray-500">Onboarded</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab("doctor")} className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${tab === "doctor" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
            <Stethoscope className="w-4 h-4 inline mr-1" /> Doctors
          </button>
          <button onClick={() => setTab("pharmacy")} className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${tab === "pharmacy" ? "bg-pink-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
            <Pill className="w-4 h-4 inline mr-1" /> Pharmacies
          </button>
        </div>

        {/* Status filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {STATUS_FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${filter === f.id ? "bg-slate-800 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-gray-400 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No {tab === "doctor" ? "doctor" : "pharmacy"} requests in this filter.</p>
            <p className="text-xs text-gray-400 mt-1">When patients request providers, they appear here for onboarding.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((agg) => <AggCard key={agg.id} agg={agg} />)}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">Approving a provider creates their MediTrust profile (verified), marks all linked appointments/orders as onboarded, and notifies every patient who requested them.</p>
        </div>
      </div>
    </div>
  );
}

export default function BuilderPanel() {
  return (
    <LanguageProvider>
      <BuilderPanelContent />
    </LanguageProvider>
  );
}