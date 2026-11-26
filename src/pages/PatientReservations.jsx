import { db } from '@/api/client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Calendar, MapPin, Package, Pill, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import { getDirectionsUrl } from '@/lib/maps';
import { Button } from '@/components/ui/button';

const statusLabels = {
  pending: 'Waiting for the pharmacy',
  accepted: 'Accepted',
  processing: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  delivered: 'Picked up',
  completed: 'Picked up',
  cancelled: 'Cancelled',
  rejected: 'Not available',
};

const formatCreatedDate = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Date unavailable';
  return format(new Date(value), 'MMM d, yyyy h:mm a');
};

const hasConfirmedPrice = (price) => price !== null
  && price !== undefined
  && price !== ''
  && Number.isFinite(Number(price))
  && Number(price) > 0;

function PatientReservationsContent() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [cancelError, setCancelError] = useState('');

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const me = await db.auth.me();
      if (!me?.email) throw new Error('Could not verify the signed-in patient account.');
      const result = await db.entities.MedicinePreOrder.filter(
        { patient_email: me.email },
        { sort: '-created_date', limit: 500 }
      );
      const rows = result;
      const sorted = [...rows].sort((a, b) =>
        new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()
      );
      const pharmacies = new Map();
      await Promise.all([...new Set(sorted.map((order) => order.pharmacy_id).filter(Boolean))]
        .map(async (id) => {
          const pharmacy = await db.entities.PharmacyProfile.get(id);
          if (pharmacy) pharmacies.set(id, pharmacy);
        }));
      setReservations(sorted.map((order) => ({
        ...order,
        pharmacy: pharmacies.get(order.pharmacy_id),
      })));
    } catch (loadError) {
      console.error('Failed to load patient reservations.', loadError);
      setError(loadError.message || 'Failed to load medicine reservations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const cancelReservation = async (reservation) => {
    if (!window.confirm('Cancel this medicine reservation?')) return;
    setCancellingId(reservation.id);
    setCancelError('');
    try {
      await db.entities.MedicinePreOrder.update(reservation.id, { status: 'cancelled' });
      setReservations((current) => current.map((item) =>
        item.id === reservation.id ? { ...item, status: 'cancelled' } : item
      ));
    } catch (cancelRequestError) {
      console.error('Failed to cancel patient reservation.', cancelRequestError);
      setCancelError(cancelRequestError.message || 'Failed to cancel reservation.');
    } finally {
      setCancellingId('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-rose-50 pb-10">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link to={createPageUrl('PatientDashboard')} aria-label="Back to dashboard" className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-800">My medicine reservations</h1>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={loadReservations} aria-label="Refresh reservations">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        {cancelError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{cancelError}</p>}
        {loading ? (
          <div role="status" aria-label="Loading reservations" className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <Button type="button" variant="outline" className="mt-3 rounded-xl" onClick={loadReservations}>Try again</Button>
          </div>
        ) : reservations.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700">No reservations yet</p>
            <Button type="button" className="mt-4 rounded-xl" onClick={() => navigate(createPageUrl('Pharmacies'))}>
              Find pharmacies
            </Button>
          </div>
        ) : reservations.map((reservation) => {
          const status = String(reservation.status || 'pending').toLowerCase();
          const pharmacy = reservation.pharmacy;
          const directionsUrl = getDirectionsUrl(
            reservation.osm_lat ?? pharmacy?.lat,
            reservation.osm_lng ?? pharmacy?.lng
          );
          const canCancel = status === 'pending' || status === 'accepted' || status === 'processing';
          return (
            <article key={reservation.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-800">{reservation.pharmacy_name || 'Pharmacy'}</h2>
                  <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> {formatCreatedDate(reservation.created_date)}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {statusLabels[status] || status}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {(Array.isArray(reservation.medicines) ? reservation.medicines : []).map((medicine, index) => (
                  <div key={`${medicine.medicine_id || medicine.medicine_name || 'item'}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                    <span className="flex items-start gap-2 text-gray-700">
                      <Pill className="h-4 w-4 mt-0.5 text-pink-500" />
                      {medicine.medicine_name || 'Medicine'} x {medicine.quantity}
                    </span>
                    <span className="shrink-0 text-right text-gray-600">
                      {hasConfirmedPrice(medicine.price)
                        ? `₹${medicine.price}`
                        : 'Price confirmed at the pharmacy'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <span className="text-sm text-gray-600">Pay at the pharmacy</span>
                <div className="flex gap-2">
                  {directionsUrl ? (
                    <a href={directionsUrl} target="_blank" rel="noreferrer">
                      <Button type="button" variant="outline" size="sm" className="rounded-xl">
                        <MapPin className="h-4 w-4 mr-1" /> Directions
                      </Button>
                    </a>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled title="Pharmacy coordinates are unavailable">
                      <MapPin className="h-4 w-4 mr-1" /> Directions
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-red-600"
                      disabled={cancellingId === reservation.id}
                      onClick={() => cancelReservation(reservation)}
                    >
                      {cancellingId === reservation.id ? 'Cancelling…' : 'Cancel'}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </main>
    </div>
  );
}

export default function PatientReservations() {
  return <PatientReservationsContent />;
}
