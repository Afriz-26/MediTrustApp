ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS prescription_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_prescription_id_unique
  ON public.notifications (prescription_id)
  WHERE prescription_id IS NOT NULL;

INSERT INTO public.notifications (
  user_id,
  title,
  message,
  type,
  link,
  is_read,
  prescription_id
)
SELECT
  prescription.patient_id,
  'New Prescription',
  'Your doctor added a prescription. Open it to view or download it from your health records.',
  'general',
  '/PatientPrescriptions',
  false,
  prescription.id
FROM public.prescriptions AS prescription
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notifications AS notification
  WHERE notification.prescription_id = prescription.id
     OR (
       notification.user_id = prescription.patient_id
       AND notification.title ILIKE '%prescription%'
       AND notification.created_at BETWEEN prescription.created_at - INTERVAL '1 minute'
                                        AND prescription.created_at + INTERVAL '1 minute'
     )
)
ON CONFLICT (prescription_id) WHERE prescription_id IS NOT NULL DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_patient_of_prescription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  doctor_name text;
BEGIN
  SELECT COALESCE(NULLIF(doctor.name, ''), NULLIF(profile.full_name, ''), 'Your doctor')
  INTO doctor_name
  FROM public.doctors AS doctor
  LEFT JOIN public.profiles AS profile ON profile.id = doctor.user_id
  WHERE doctor.id = NEW.doctor_id;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    link,
    is_read,
    prescription_id
  )
  VALUES (
    NEW.patient_id,
    'New Prescription',
    COALESCE(doctor_name, 'Your doctor')
      || ' added a prescription. Open it to view or download it from your health records.',
    'general',
    '/PatientPrescriptions',
    false,
    NEW.id
  )
  ON CONFLICT (prescription_id) WHERE prescription_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prescriptions_notify_patient ON public.prescriptions;

CREATE TRIGGER prescriptions_notify_patient
AFTER INSERT ON public.prescriptions
FOR EACH ROW
EXECUTE FUNCTION public.notify_patient_of_prescription();
