import React from 'react';
import { Button } from '@/components/ui/button';

export function DataError({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
      <p className="text-sm text-red-700">{message}</p>
      <Button type="button" size="sm" variant="outline" className="mt-3 rounded-xl" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function DataEmpty({ message, actionLabel, onAction }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 text-center">
      <p className="text-sm text-gray-500">{message}</p>
      {actionLabel && onAction && (
        <Button type="button" size="sm" variant="outline" className="mt-3 rounded-xl" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
