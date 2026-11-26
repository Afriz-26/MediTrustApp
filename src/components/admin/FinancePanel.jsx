
import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { CreditCard, TrendingUp, Rocket, Loader2, IndianRupee } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { activateSubscription } from '@/lib/subscriptions';

const FINANCE_TABS = [
  { id: 'payments', label: 'Payments', icon: CreditCard, entity: 'Payment' },
  { id: 'subscriptions', label: 'Subscriptions', icon: TrendingUp, entity: 'Subscription' },
  { id: 'boosters', label: 'Ad Boosters', icon: Rocket, entity: 'AdBooster' },
];

const statusColor = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  active: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-600',
  refunded: 'bg-blue-100 text-blue-700',
};

const boosterLabels = {
  featured_profile: 'Featured Profile',
  search_booster: 'Search Booster',
  premium_visibility: 'Premium Visibility',
  homepage_promotion: 'Homepage Promotion',
  city_spotlight: 'City Spotlight',
};

function ActivateCell({ sub, onDone }) {
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (sub.status !== 'pending') return <span className="text-xs text-gray-400">{sub.end_date ? `until ${sub.end_date}` : '-'}</span>;
  const go = async () => {
    setBusy(true); setErr('');
    try { await activateSubscription(sub, ref); onDone(); }
    catch (e) { console.error(e); setErr(e.message || 'Could not activate'); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex gap-1">
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Payment ref" className="border rounded-lg px-2 py-1 text-xs w-28" />
        <Button type="button" size="sm" disabled={busy} onClick={go} className="h-7 text-xs">{busy ? '...' : 'Activate'}</Button>
      </div>
      {err && <span className="text-[10px] text-red-600">{err}</span>}
    </div>
  );
}

const tierLabels = { basic: 'Basic', pro: 'Pro', elite: 'Elite' };

export default function FinancePanel({ stats }) {
  const [tab, setTab] = useState('payments');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const config = FINANCE_TABS.find((t) => t.id === tab);
    try {
      const page = await db.entities[config.entity].list({ sort: '-created_date', limit: 100 });
      setRows(page);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-5 h-5 text-green-600" />
            <p className="text-sm text-gray-500">Total Revenue</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">₹{stats?.revenue || 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-gray-500">Active Subscriptions</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats?.activeSubs || 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="w-5 h-5 text-violet-600" />
            <p className="text-sm text-gray-500">Active Ad Boosters</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats?.activeBoosters || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {FINANCE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-slate-800 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CreditCard className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No {tab} yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {tab === 'payments' && (
                    <>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    </>
                  )}
                  {tab === 'subscriptions' && (
                    <>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Provider</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Tier</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Cycle</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Action</th>
                    </>
                  )}
                  {tab === 'boosters' && (
                    <>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Provider</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Booster</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    {tab === 'payments' && (
                      <>
                        <td className="px-4 py-3 text-gray-700">{r.user_email}</td>
                        <td className="px-4 py-3 text-gray-500 capitalize">{(r.payment_type || '').replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">₹{r.amount}</td>
                        <td className="px-4 py-3 text-center"><Badge className={`${statusColor[r.status] || statusColor.pending} text-[10px] capitalize`}>{r.status}</Badge></td>
                      </>
                    )}
                    {tab === 'subscriptions' && (
                      <>
                        <td className="px-4 py-3 text-gray-700">{r.provider_email}</td>
                        <td className="px-4 py-3 text-gray-600">{tierLabels[r.tier] || r.tier}</td>
                        <td className="px-4 py-3 text-gray-500 capitalize">{r.billing_cycle}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">₹{r.amount}</td>
                        <td className="px-4 py-3 text-center"><Badge className={`${statusColor[r.status] || statusColor.pending} text-[10px] capitalize`}>{r.status}</Badge></td>
                      <td className="px-4 py-3 text-right"><ActivateCell sub={r} onDone={load} /></td>
                      </>
                    )}
                    {tab === 'boosters' && (
                      <>
                        <td className="px-4 py-3 text-gray-700">{r.provider_email}</td>
                        <td className="px-4 py-3 text-gray-600">{boosterLabels[r.booster_type] || r.booster_type}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">₹{r.amount}</td>
                        <td className="px-4 py-3 text-center"><Badge className={`${statusColor[r.status] || statusColor.pending} text-[10px] capitalize`}>{r.status}</Badge></td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}