import { db } from '@/api/client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Loader2, Package, Plus, Search, XCircle, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DataError } from '@/components/common/DataState';

const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Ointment', 'Cream', 'Drops', 'Inhaler', 'Powder', 'Other'];

const money = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? String(value) : '');
const detail = (m) => [m.strength, m.form].filter(Boolean).join(' · ');

export default function PharmacyInventory() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [medicineQuery, setMedicineQuery] = useState('');
  const [picked, setPicked] = useState(null);          // medicine chosen to add: shows the price step
  const [addMrp, setAddMrp] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [adding, setAdding] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', strength: '', form: 'Tablet' });
  const [drafts, setDrafts] = useState({});            // { [itemId]: { mrp, price } }
  const [savingIds, setSavingIds] = useState({});
  const [itemMessages, setItemMessages] = useState({});

  const medicineById = useMemo(() => new Map(medicines.map((m) => [m.id, m])), [medicines]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const me = await db.auth.me();
      if (!me?.email || me.email !== user?.email) throw new Error('Could not verify the signed-in pharmacy account.');
      const [rows, meds] = await Promise.all([
        db.entities.PharmacyInventory.filter({ pharmacy_email: me.email }, { sort: 'medicine_name', limit: 1000 }),
        db.entities.Medicine.list(),
      ]);
      setInventory(rows);
      setMedicines(meds);
      setDrafts(Object.fromEntries(rows.map((i) => [i.id, { mrp: money(i.mrp), price: money(i.price) }])));
    } catch (error) {
      console.error('Failed to load pharmacy inventory.', error);
      setLoadError(`Failed to load pharmacy inventory: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  const stockedIds = useMemo(() => new Set(inventory.map((i) => i.medicine_id)), [inventory]);

  const matches = useMemo(() => {
    const q = medicineQuery.trim().toLowerCase();
    if (!q) return [];
    return medicines
      .filter((m) => !stockedIds.has(m.id))
      .filter((m) => [m.name, m.generic_name, m.strength].some((v) => (v || '').toLowerCase().includes(q)))
      .slice(0, 8);
  }, [medicineQuery, medicines, stockedIds]);

  const filteredInventory = inventory.filter((i) => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return true;
    const m = medicineById.get(i.medicine_id) || {};
    return [i.medicine_name, m.generic_name, m.strength].some((v) => (v || '').toLowerCase().includes(q));
  });

  const startAdd = (medicine) => {
    setPicked(medicine);
    setAddMrp('');
    setAddPrice('');
    setNotice('');
  };

  const confirmAdd = async () => {
    const mrp = Number(addMrp);
    const price = addPrice.trim() === '' ? mrp : Number(addPrice);
    if (!Number.isFinite(mrp) || mrp <= 0) { setNotice('Enter the MRP printed on the pack.'); return; }
    if (!Number.isFinite(price) || price <= 0) { setNotice('Enter a valid selling price.'); return; }
    if (price > mrp) { setNotice('Your selling price cannot be higher than the MRP.'); return; }
    setAdding(true);
    setNotice('');
    try {
      const me = await db.auth.me();
      const created = await db.entities.PharmacyInventory.create({
        pharmacy_email: me.email, medicine_id: picked.id, medicine_name: picked.name, in_stock: true, mrp, price,
      });
      const row = { ...created, medicine_name: picked.name, rx_only: picked.rx_only, mrp, price, in_stock: true };
      setInventory((current) => [...current, row].sort((a, b) => a.medicine_name.localeCompare(b.medicine_name)));
      setDrafts((current) => ({ ...current, [created.id]: { mrp: money(mrp), price: money(price) } }));
      setItemMessages((current) => ({ ...current, [created.id]: 'Medicine added.' }));
      setPicked(null);
      setMedicineQuery('');
    } catch (error) {
      setNotice(error.message || 'Could not add this medicine.');
    } finally {
      setAdding(false);
    }
  };

  const createMedicine = async () => {
    setNotice('');
    if (newMed.name.trim().length < 2) { setNotice('Enter the medicine name.'); return; }
    setAdding(true);
    try {
      const created = await db.entities.Medicine.create({ name: newMed.name.trim(), strength: newMed.strength.trim(), form: newMed.form });
      setMedicines((current) => [...current, created]);
      setShowNew(false);
      setNewMed({ name: '', strength: '', form: 'Tablet' });
      startAdd(created);
    } catch (error) {
      setNotice(error.message || 'Could not add this medicine.');
    } finally {
      setAdding(false);
    }
  };

  const saveItem = async (item, changes, successMessage) => {
    setSavingIds((current) => ({ ...current, [item.id]: true }));
    setItemMessages((current) => ({ ...current, [item.id]: '' }));
    try {
      await db.entities.PharmacyInventory.update(item.id, { ...changes, last_updated: new Date().toISOString() });
      setInventory((current) => current.map((row) => (row.id === item.id ? { ...row, ...changes } : row)));
      setItemMessages((current) => ({ ...current, [item.id]: successMessage }));
    } catch (error) {
      setItemMessages((current) => ({ ...current, [item.id]: `Save failed: ${error.message || 'Please try again.'}` }));
    } finally {
      setSavingIds((current) => ({ ...current, [item.id]: false }));
    }
  };

  const setDraft = (id, field, value) => setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));

  // Saves MRP and price together so the "price <= MRP" rule is checked on the final values.
  const commitPrices = (item) => {
    const draft = drafts[item.id] || {};
    const mrp = Number(draft.mrp);
    const price = Number(draft.price);
    if (!Number.isFinite(mrp) || mrp <= 0) { setItemMessages((c) => ({ ...c, [item.id]: 'Save failed: enter the MRP printed on the pack.' })); return; }
    if (!Number.isFinite(price) || price <= 0) { setItemMessages((c) => ({ ...c, [item.id]: 'Save failed: enter your selling price.' })); return; }
    if (price > mrp) { setItemMessages((c) => ({ ...c, [item.id]: 'Save failed: your selling price cannot be higher than the MRP.' })); return; }
    if (Number(item.mrp) === mrp && Number(item.price) === price) return;
    saveItem(item, { mrp, price }, 'Prices saved.');
  };

  const updateQuantity = (item, value) => {
    if (value === '') { saveItem(item, { stock_quantity: null }, 'Stock quantity cleared.'); return; }
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setItemMessages((c) => ({ ...c, [item.id]: 'Save failed: stock must be a whole number of 0 or more.' }));
      return;
    }
    saveItem(item, { stock_quantity: quantity }, 'Stock quantity saved.');
  };

  const isError = (text) => text?.startsWith('Save failed');

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-rose-50 pb-10">
      <div className="bg-gradient-to-r from-pink-600 via-rose-500 to-red-500 pt-12 pb-6 px-4 rounded-b-3xl">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link to={createPageUrl('PharmacyDashboard')} aria-label="Back to pharmacy dashboard" className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Inventory</h1>
            <p className="text-sm text-white/80">Add medicines, set MRP and your price, mark availability</p>
          </div>
        </div>
      </div>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        {loadError && <DataError message={loadError} onRetry={load} />}

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-pink-600" />
            <h2 className="font-semibold text-gray-800">Add a medicine to your stock</h2>
          </div>

          {!picked && !showNew && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={medicineQuery}
                  onChange={(e) => setMedicineQuery(e.target.value)}
                  placeholder="Search by medicine name or salt (e.g. Paracetamol)"
                  aria-label="Search medicines"
                  className="pl-10 rounded-xl"
                />
              </div>
              {medicineQuery.trim() && (
                <div className="space-y-2">
                  {matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                        <p className="text-xs text-gray-500 truncate">{detail(m) || m.generic_name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {m.rx_only && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Rx</Badge>}
                        <Button type="button" size="sm" className="rounded-lg" onClick={() => startAdd(m)}>Add</Button>
                      </div>
                    </div>
                  ))}
                  {matches.length === 0 && <p className="text-sm text-gray-500">No match. It may already be in your stock, or it is not in the list yet.</p>}
                </div>
              )}
              <button type="button" onClick={() => { setShowNew(true); setNewMed((n) => ({ ...n, name: medicineQuery.trim() })); setNotice(''); }} className="text-sm text-pink-700 underline">
                Medicine not in the list? Add it
              </button>
            </>
          )}

          {showNew && !picked && (
            <div className="space-y-3 rounded-xl bg-pink-50/60 border border-pink-100 p-3">
              <p className="text-sm font-medium text-gray-800">Add a new medicine</p>
              <Input placeholder="Medicine name (e.g. Dolo 650)" value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} className="rounded-lg bg-white" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Strength (e.g. 650 mg)" value={newMed.strength} onChange={(e) => setNewMed({ ...newMed, strength: e.target.value })} className="rounded-lg bg-white" />
                <select value={newMed.form} onChange={(e) => setNewMed({ ...newMed, form: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 text-sm h-10">
                  {FORMS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>New medicines are saved as prescription-only until MediTrust reviews them, so patients need a prescription to reserve them.</span>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={createMedicine} disabled={adding} className="rounded-lg">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowNew(false)} className="rounded-lg">Cancel</Button>
              </div>
            </div>
          )}

          {picked && (
            <div className="space-y-3 rounded-xl bg-pink-50/60 border border-pink-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-800">{picked.name}</p>
                  <p className="text-xs text-gray-500">{detail(picked) || picked.generic_name}</p>
                </div>
                {picked.rx_only && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Prescription needed</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm text-gray-600">
                  <span>MRP printed on the pack (₹)</span>
                  <Input inputMode="decimal" value={addMrp} onChange={(e) => setAddMrp(e.target.value)} placeholder="e.g. 32" className="rounded-lg bg-white" />
                </label>
                <label className="space-y-1 text-sm text-gray-600">
                  <span>Your selling price (₹)</span>
                  <Input inputMode="decimal" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} placeholder="Same as MRP" className="rounded-lg bg-white" />
                </label>
              </div>
              <p className="text-xs text-gray-500">The selling price can be the same as the MRP or lower. It can never be higher.</p>
              <div className="flex gap-2">
                <Button type="button" onClick={confirmAdd} disabled={adding} className="rounded-lg">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to my stock'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setPicked(null)} className="rounded-lg">Cancel</Button>
              </div>
            </div>
          )}

          {notice && <p role="alert" className="text-sm text-red-600">{notice}</p>}
        </section>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter your stock"
            aria-label="Filter inventory"
            className="pl-10 rounded-xl bg-white"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12" role="status" aria-label="Loading inventory">
            <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center shadow-sm">
            <Package className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-gray-600">{filterQuery.trim() ? 'No medicines match your filter.' : 'No medicines in your stock yet. Search above to add your first one.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInventory.map((item) => {
              const med = medicineById.get(item.medicine_id) || {};
              const draft = drafts[item.id] || { mrp: '', price: '' };
              return (
                <article key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-gray-800">{item.medicine_name}</h2>
                      <p className="text-xs text-gray-500">{detail(med) || med.generic_name || ''}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge className={item.in_stock ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}>
                        {item.in_stock ? 'Available' : 'Unavailable'}
                      </Badge>
                      {med.rx_only && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Rx</Badge>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="space-y-1 text-sm text-gray-600">
                      <span>MRP (₹)</span>
                      <Input
                        inputMode="decimal"
                        value={draft.mrp}
                        onChange={(e) => setDraft(item.id, 'mrp', e.target.value)}
                        onBlur={() => commitPrices(item)}
                        aria-label={`MRP for ${item.medicine_name}`}
                      />
                    </label>
                    <label className="space-y-1 text-sm text-gray-600">
                      <span>Your price (₹)</span>
                      <Input
                        inputMode="decimal"
                        value={draft.price}
                        onChange={(e) => setDraft(item.id, 'price', e.target.value)}
                        onBlur={() => commitPrices(item)}
                        aria-label={`Selling price for ${item.medicine_name}`}
                      />
                    </label>
                    <label className="space-y-1 text-sm text-gray-600">
                      <span>Stock</span>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={item.stock_quantity ?? ''}
                        onChange={(e) => updateQuantity(item, e.target.value)}
                        placeholder="Optional"
                        aria-label={`Stock quantity for ${item.medicine_name}`}
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Available</p>
                      <p className="text-xs text-gray-400">Visible to patients when enabled</p>
                    </div>
                    <Switch
                      checked={Boolean(item.in_stock)}
                      onCheckedChange={(checked) => saveItem(item, { in_stock: checked }, checked ? 'Marked available.' : 'Marked unavailable.')}
                      disabled={Boolean(savingIds[item.id])}
                      aria-label={`Toggle availability for ${item.medicine_name}`}
                    />
                  </div>
                  {savingIds[item.id] && <span className="text-xs text-blue-600">Saving…</span>}
                  {itemMessages[item.id] && (
                    <p role="status" className={`flex items-center gap-1 text-sm ${isError(itemMessages[item.id]) ? 'text-red-600' : 'text-emerald-700'}`}>
                      {isError(itemMessages[item.id]) ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      {itemMessages[item.id]}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
