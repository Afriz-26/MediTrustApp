import React, { useState, useRef, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

const THRESHOLD = 60;
const MAX_PULL = 100;

/**
 * Native-style pull-to-refresh wrapper for touch devices.
 * Place around any scrollable content. On touch, when scrollTop === 0,
 * dragging down reveals a spinner; release past THRESHOLD triggers onRefresh.
 */
export default function PullToRefresh({ onRefresh, children, className = '' }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (refreshing) return;
    const el = e.currentTarget;
    if (el.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    } else {
      pulling.current = false;
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!pulling.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    // Dampen the pull: slower as it gets longer
    const dampened = Math.min(delta * 0.5, MAX_PULL);
    setPullDistance(dampened);
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= THRESHOLD && onRefresh) {
      setRefreshing(true);
      setPullDistance(40);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const showSpinner = refreshing || pullDistance > 0;

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {showSpinner && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: pullDistance }}
        >
          {refreshing ? (
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          ) : (
            <RefreshCw
              className="w-6 h-6 text-blue-500 transition-transform"
              style={{ transform: `rotate(${progress * 360}deg)`, opacity: progress }}
            />
          )}
        </div>
      )}
      {children}
    </div>
  );
}