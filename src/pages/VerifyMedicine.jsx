
import { db } from '@/api/client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, AlertCircle, CheckCircle, X, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';
import ReviewsSection from '@/components/reviews/ReviewsSection';

import MedicineSearch from '@/components/medicine/MedicineSearch';

import { loadMedicines } from '@/lib/medicines';
import { searchMedicineInfo } from '@/lib/medicineDataset';

function VerifyMedicineContent() {
  const { t } = useLanguage();
  const [medicines, setMedicines] = useState([]);
  const [medicineInfo, setMedicineInfo] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadMedicines().then(setMedicines).catch(() => setMedicines([]));
    // Check for medicine parameter in URL
    const params = new URLSearchParams(window.location.search);
    const medicineParam = params.get('medicine');
    if (medicineParam) {
      loadMedicines().then((all) => {
        const found = searchMedicineInfo(medicineParam, all)[0];
        if (found) setMedicineInfo(found);
      });
    }
  }, []);

  const handleSelect = (m) => {
    setMedicineInfo(m);
    setNotFound(false);
    setImage(null);
    setImageUrl(null);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImageUrl(ev.target.result);
      reader.readAsDataURL(file);
      setUploading(true);
      // Use AI to identify the medicine from the image
      try {
        const res = await db.integrations.Core.UploadFile({ file });
        const aiRes = await db.integrations.Core.InvokeLLM({
          prompt: `Identify the medicine from this image. Return the medicine name, generic name, and typical uses. If you cannot identify it, return name "Unknown".`,
          file_urls: [res.file_url],
          response_json_schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              generic: { type: "string" },
              uses: { type: "string" },
            }
          }
        });
        // Try to match against our dataset
        const all = await loadMedicines();
        const match = searchMedicineInfo(aiRes.name || aiRes.generic || "", all)[0];
        if (match) setMedicineInfo(match);
        else setNotFound(true);
      } catch (e) {
        setNotFound(true);
      } finally {
        setUploading(false);
      }
    }
  };

  const clearSearch = () => {
    setMedicineInfo(null);
    setNotFound(false);
    setImage(null);
    setImageUrl(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 pt-12 pb-6 px-4 rounded-b-3xl">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Link to={createPageUrl('PatientDashboard')} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Medicine Checker</h1>
              <p className="text-sm text-white/80">Search any medicine — get real info</p>
            </div>
          </div>
          <MedicineSearch onSelect={handleSelect} placeholder="Type any medicine name…" />
        </div>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">
        {/* Image Upload alternative */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="relative mb-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-500">or scan the package</span>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          {!imageUrl ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 transition-all"
            >
              <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Scan Medicine Package</p>
              <p className="text-xs text-gray-400">AI will identify it for you</p>
            </button>
          ) : (
            <div className="relative">
              <img src={imageUrl} alt="Medicine" className="w-full h-48 object-cover rounded-xl" />
              <button onClick={clearSearch} className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
              {uploading && (
                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                  <p className="text-white text-sm">Identifying…</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Not Found */}
        {notFound && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800 mb-1">Couldn't identify that medicine</h3>
                  <p className="text-sm text-amber-700">Try searching by name above, or by a symptom like "fever" or "acidity".</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Medicine Details */}
        {medicineInfo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Verification Status */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-green-800">Verified Medicine Info</h3>
                  <p className="text-sm text-green-600">Real data from open medicine dataset</p>
                </div>
              </div>
            </div>

            {/* Medicine Image & Basic Info */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              {medicineInfo.image_url && (
                <img src={medicineInfo.image_url} alt={medicineInfo.name} className="w-full h-48 object-cover rounded-xl mb-4 bg-gray-100" />
              )}
              <h2 className="text-xl font-bold text-gray-800 mb-1">{medicineInfo.name}</h2>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Generic:</span>
                  <span className="text-sm text-gray-700">{medicineInfo.generic}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{medicineInfo.manufacturer}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                
                <Badge className={medicineInfo.rx ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                  {medicineInfo.rx ? 'Rx Required' : 'OTC'}
                </Badge>
                {medicineInfo.category && <Badge className="bg-violet-100 text-violet-700 capitalize">{(medicineInfo.category || '').replace('_', ' ')}</Badge>}
              </div>
            </div>

            {/* Composition */}
            {medicineInfo.composition && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-2">Composition</h3>
                <p className="text-sm text-gray-700">{medicineInfo.composition}</p>
              </div>
            )}

            {/* Dosage */}
            {medicineInfo.dosage && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-2">Typical Dosage</h3>
                <p className="text-sm text-gray-700">{medicineInfo.dosage}</p>
              </div>
            )}

            {/* Uses (Educational) */}
            {medicineInfo.uses && (
              <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                <h3 className="font-semibold text-gray-800 mb-2">Uses (Educational)</h3>
                <p className="text-sm text-gray-700">{medicineInfo.uses}</p>
              </div>
            )}

            {/* Side Effects */}
            {medicineInfo.side_effects && (
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
                <h3 className="font-semibold text-gray-800 mb-2">Possible Side Effects</h3>
                <p className="text-sm text-gray-700">{medicineInfo.side_effects}</p>
              </div>
            )}

            {/* Warnings */}
            {medicineInfo.warnings && (
              <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
                <h3 className="font-semibold text-gray-800 mb-2">Warnings & Precautions</h3>
                <p className="text-sm text-gray-700">{medicineInfo.warnings}</p>
              </div>
            )}

            {/* Symptoms */}
            {medicineInfo.symptoms && medicineInfo.symptoms.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-2">Commonly Used For</h3>
                <div className="flex flex-wrap gap-2">
                  {medicineInfo.symptoms.map((s, i) => (
                    <Badge key={i} className="bg-gray-100 text-gray-600 capitalize">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Medical Disclaimer */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-5 border-2 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-800 mb-1">Important Disclaimer</h4>
                  <p className="text-sm text-amber-700">
                    This information is for general awareness only. It is not a substitute for professional medical advice.
                    Always consult a licensed doctor or pharmacist before using any medicine. MRP ranges are indicative — actual price may vary by pharmacy.
                  </p>
                </div>
              </div>
            </div>

            {/* Reviews Section */}
            <ReviewsSection type="medicine" averageRating={4.3} totalReviews={120} />

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button onClick={clearSearch} variant="outline" className="flex-1 h-12 rounded-xl">Check Another</Button>
              <Link to={createPageUrl('OrderMedicines')} className="flex-1">
                <Button className="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl">Order This Medicine</Button>
              </Link>
            </div>
          </motion.div>
        )}
      </div>

      
    </div>
  );
}

export default function VerifyMedicine() {
  return (
    <LanguageProvider>
      <VerifyMedicineContent />
    </LanguageProvider>
  );
}