import React from "react";
import { formatBytes } from "@/lib/healthTiers";

// Storage usage bar with colour thresholds (green / amber / red).
export default function StorageUsageBar({ used, limit, tierLabel }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  const textColor = pct >= 90 ? "text-red-600" : pct >= 70 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">Storage Used</span>
        <span className={`text-sm font-bold ${textColor}`}>
          {formatBytes(used)} / {formatBytes(limit)}
        </span>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">{tierLabel} plan</span>
        <span className="text-xs text-gray-400">{pct.toFixed(0)}% used</span>
      </div>
    </div>
  );
}