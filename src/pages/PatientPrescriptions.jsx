
import { db } from '@/api/client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Download, Calendar, Pill, ChevronDown, ChevronUp, ShoppingCart, BadgeCheck, Activity } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { DataEmpty, DataError } from '@/components/common/DataState';
import features from '@/config/features';
import { downloadPrescription } from '@/lib/prescriptionDownload';

const pharmacyStatusColors = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  processing: 'bg-blue-100 text-blue-700 border-blue-200',
  ready: 'bg-green-100 text-green-700 border-green-200',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

function PrescriptionsContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState(null);

  const { data: prescriptions = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['patient-prescriptions'],
    queryFn: async () => {
      try {
        const me = await db.auth.me();
        if (!me?.email) throw new Error('Could not verify the signed-in patient account.');
        return await db.entities.Prescription.filter(
          { patient_email: me.email },
          { sort: '-created_date', limit: 50 }
        );
      } catch (error) {
        console.error('Failed to load patient prescriptions.', error);
        throw error;
      }
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>
          <h1 className="font-semibold text-gray-800">{t('prescriptions')}</h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">
        {isLoading ? (
          <div role="status" aria-label="Loading prescriptions" className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <DataError message={error?.message || 'Could not load your prescriptions.'} onRetry={refetch} />
        ) : (
        <>
        <div className="space-y-4">
          {prescriptions.map((rx, idx) => (
            <motion.div
              key={rx.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <Collapsible open={expandedId === rx.id} onOpenChange={() => setExpandedId(expandedId === rx.id ? null : rx.id)}>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-sky-500 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <h3 className="font-semibold text-gray-800">{rx.doctor_name}</h3>
                          <BadgeCheck className="w-4 h-4 text-blue-500" />
                        </div>
                        <p className="text-sm text-gray-500">{rx.doctor_specialization}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(rx.created_date), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    {features.pharmacy && (
                    <Badge className={`${pharmacyStatusColors[rx.pharmacy_status]} border text-xs`}>
                      {rx.pharmacy_status === 'pending'
                        ? 'Order Medicine'
                        : rx.pharmacy_status === 'delivered'
                          ? 'Picked up'
                          : rx.pharmacy_status}
                    </Badge>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 mb-1">{t('diagnosis')}</p>
                    <p className="font-medium text-gray-800">{rx.diagnosis}</p>
                  </div>

                  <CollapsibleTrigger className="w-full mt-4 flex items-center justify-center gap-2 text-blue-600 text-sm font-medium">
                    {expandedId === rx.id ? (
                      <>Hide Details <ChevronUp className="w-4 h-4" /></>
                    ) : (
                      <>View Details <ChevronDown className="w-4 h-4" /></>
                    )}
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Pill className="w-4 h-4 text-emerald-500" />
                      Medicines ({(rx.medicines || []).length})
                    </h4>
                    
                    {(rx.medicines || []).map((med, medIdx) => (
                      <div key={medIdx} className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="font-medium text-gray-800">{med.name}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <div>
                            <span className="text-gray-500">{t('dosage')}: </span>
                            <span className="text-gray-700">{med.dosage}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">{t('frequency')}: </span>
                            <span className="text-gray-700">{med.frequency}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">{t('duration')}: </span>
                            <span className="text-gray-700">{med.duration}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">{t('instructions')}: </span>
                            <span className="text-gray-700">{med.instructions}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {rx.additional_notes && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <p className="text-sm text-gray-500 mb-1">{t('additionalNotes')}</p>
                        <p className="text-sm text-gray-700">{rx.additional_notes}</p>
                      </div>
                    )}

                    <div className="grid gap-2 pt-2 sm:grid-cols-2">
                      <Button variant="outline" className="w-full rounded-xl" onClick={() => downloadPrescription(rx)}>
                        <Download className="w-4 h-4 mr-2" />
                        {t('downloadPrescription')}
                      </Button>
                      <button type="button" className="w-full rounded-xl border border-gray-200 px-4 py-2 inline-flex items-center justify-center" onClick={() => navigate(`${createPageUrl('HealthTracker')}?tab=records`)}>
                        <Activity className="w-4 h-4 mr-2" />
                        Health Records
                      </button>
                      {features.pharmacy && rx.pharmacy_status === 'pending' && (
                        <Button 
                          onClick={() => navigate(createPageUrl('Pharmacies'))}
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          {t('orderMedicines')}
                        </Button>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          ))}
        </div>

        {prescriptions.length === 0 && (
          <DataEmpty
            message="No prescriptions yet."
            {...(features.pharmacy ? { actionLabel: 'Find pharmacies', onAction: () => navigate(createPageUrl('Pharmacies')) } : {})}
          />
        )}
        </>
        )}
      </div>
    </div>
  );
}

export default function PatientPrescriptions() {
  return (
    <LanguageProvider>
      <PrescriptionsContent />
    </LanguageProvider>
  );
}