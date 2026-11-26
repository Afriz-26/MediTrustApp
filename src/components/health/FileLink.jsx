import React, { useState, useEffect } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { getSignedFileUrl } from '@/lib/fileAccess';

// Renders a "View file" link that generates a signed URL on click.
export default function FileLink({ fileUri, label = 'View file' }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!fileUri) return;
    setLoading(true);
    getSignedFileUrl(fileUri).then((u) => {
      if (active) { setUrl(u); setLoading(false); }
    });
    return () => { active = false; };
  }, [fileUri]);

  if (loading) {
    return (
      <span className="text-xs text-teal-600 flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading...
      </span>
    );
  }

  if (!url) {
    return (
      <span className="text-xs text-gray-400">File unavailable</span>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs text-teal-600 underline flex items-center gap-1">
      <Upload className="w-3 h-3" /> {label}
    </a>
  );
}