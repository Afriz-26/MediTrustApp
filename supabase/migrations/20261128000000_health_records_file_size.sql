-- Health records: remember each uploaded file's size so the storage bar and plan limits work.
-- Applied to the live project on 2026-11-28. Safe to run again.
alter table public.health_records add column if not exists file_size bigint not null default 0;

-- The "health-records" bucket (private) is limited to 10 MB per file and PDF/image types only.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']
 where id = 'health-records';
