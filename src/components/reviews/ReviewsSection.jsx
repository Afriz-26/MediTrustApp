
import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function ReviewsSection({ type = 'medicine', providerEmail, averageRating: defaultRating = 0, totalReviews: defaultTotal = 0 }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!providerEmail) {
      setLoading(false);
      return;
    }
    db.entities.Review.filter({ provider_email: providerEmail, provider_type: type }, '-created_date', 20)
      .then((rows) => setReviews(rows))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [providerEmail, type]);

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
    : defaultRating;
  const totalReviews = reviews.length || defaultTotal;

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => r.rating === stars).length;
    const percentage = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
    return { stars, percentage, count };
  });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-4 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Rating */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100">
        <div className="flex items-start gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-800 mb-1">{averageRating.toFixed(1)}</div>
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < Math.round(averageRating) ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`} />
              ))}
            </div>
            <p className="text-xs text-gray-600">{totalReviews} review{totalReviews !== 1 ? 's' : ''}</p>
          </div>

          <div className="flex-1 space-y-1">
            {ratingDistribution.map((item) => (
              <div key={item.stars} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-8">{item.stars}★</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
                <span className="text-xs text-gray-600 w-10">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          {type === 'medicine' && 'Medicine ratings are based on user experiences and are not medical advice. Consult a doctor before use.'}
          {type === 'doctor' && 'Patient reviews are subjective experiences. Always verify doctor credentials independently.'}
          {type === 'pharmacy' && 'Pharmacy ratings reflect real customer experiences.'}
        </p>
      </div>

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-800">Patient Reviews</h4>
          {reviews.map((review, idx) => (
            <motion.div key={review.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">{review.patient_name?.charAt(0) || 'A'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">{review.patient_name || 'Anonymous'}</p>
                      {review.is_verified && <CheckCircle className="w-3 h-3 text-green-500" />}
                    </div>
                    <p className="text-xs text-gray-500">{review.created_date ? new Date(review.created_date).toLocaleDateString() : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-3">{review.comment}</p>
              {review.is_verified && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">Verified Patient</Badge>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-2xl border border-gray-100">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No reviews yet</p>
          <p className="text-xs text-gray-400 mt-1">Reviews from verified patients will appear here after appointments are completed.</p>
        </div>
      )}
    </div>
  );
}