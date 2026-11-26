import React from 'react';
import { Shield } from 'lucide-react';
import { LegalLayout, Section, CompanyCard } from '@/components/common/LegalLayout';
import { COMPANY } from '@/config/legal';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" icon={Shield}>
      <p>
        {COMPANY.product} ("we", "us", "our") is a digital healthcare platform run by {COMPANY.legalName}. It helps
        patients find doctors and pharmacies, book appointments and keep their prescription records. This policy explains
        what personal information we collect, why, who it is shared with, and the choices you have.
      </p>

      <Section title="1. Information we collect">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account information:</strong> name, email address, role (patient, doctor or pharmacy) and your password (stored only in hashed form by our authentication provider, never in readable form).</li>
          <li><strong>Profile information:</strong> phone number, city and, for doctors and pharmacies, professional and business details you enter (for example clinic name, registration number, timings).</li>
          <li><strong>Health information you choose to add:</strong> prescriptions, health records, allergies and similar details. Add only what you are comfortable storing.</li>
          <li><strong>Booking data:</strong> appointment requests, token numbers, medicine reservations and notifications.</li>
          <li><strong>Location:</strong> the city you select, and your device location only if you allow it, to show nearby providers.</li>
          <li><strong>Chat and voice inputs:</strong> messages you type or speak to the AI assistant.</li>
          <li><strong>Technical data:</strong> basic device and usage information needed to run and secure the app.</li>
        </ul>
      </Section>

      <Section title="2. Why we use it">
        <ul className="list-disc pl-5 space-y-1">
          <li>To create and secure your account and show you the right dashboard.</li>
          <li>To let patients book doctors and reserve medicines, and let providers manage those requests.</li>
          <li>To send appointment, token and prescription notifications.</li>
          <li>To review and verify doctors and pharmacies before they are listed.</li>
          <li>To fix bugs, prevent misuse and improve the service.</li>
          <li>To follow the law and respond to lawful requests.</li>
        </ul>
        <p>We use your information only for these purposes. We do not sell your personal data.</p>
      </Section>

      <Section title="3. Who your information is shared with">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>The doctor or pharmacy you choose:</strong> they see the details needed to serve your booking, reservation or prescription.</li>
          <li><strong>Service providers that run the app for us:</strong> Supabase (database, sign-in and file storage) and our web hosting provider. They process data on our behalf.</li>
          <li><strong>Google (Gemini AI):</strong> when you use the AI assistant, the text of your messages is sent to Google's Gemini service to generate a reply. Do not type names, phone numbers, addresses or other identifying details into the assistant. Voice input may be processed by your browser or device vendor's speech service.</li>
          <li><strong>Map services:</strong> city and place searches may be sent to OpenStreetMap-based services to find nearby places.</li>
          <li><strong>Authorities:</strong> where required by law or a valid legal order.</li>
        </ul>
        <p>Your data may be stored on servers outside India by these providers.</p>
      </Section>

      <Section title="4. Security">
        <p>
          We use access controls so that each person can see only the records they are allowed to see, and encrypted
          connections between your device and our servers. No online service is completely secure, so we cannot
          guarantee absolute security. Keep your password private and sign out on shared devices.
        </p>
      </Section>

      <Section title="5. How long we keep it">
        <p>
          We keep your information while your account is active. You can ask us to delete your account and data at any
          time (see section 7). We may keep limited records where the law requires it or to resolve disputes. Medical
          records created by a doctor may also need to be kept by that doctor under their own professional obligations.
        </p>
      </Section>

      <Section title="6. AI features">
        <p>
          The AI assistant provides general educational information only. It does not diagnose conditions or prescribe
          medicines, and its answers can be wrong or incomplete. For medical decisions, consult a licensed doctor. In an
          emergency call 108 or go to the nearest hospital.
        </p>
      </Section>

      <Section title="7. Your rights and choices">
        <ul className="list-disc pl-5 space-y-1">
          <li>Ask what personal data we hold about you and get a copy.</li>
          <li>Ask us to correct wrong information.</li>
          <li>Ask us to delete your account and data.</li>
          <li>Withdraw your consent. This may stop some features from working.</li>
        </ul>
        <p>Email {COMPANY.email} from the address on your account. We reply within 2 business days and aim to complete requests within 15 days.</p>
      </Section>

      <Section title="8. Children">
        <p>The app is for people aged 18 and over. A parent or guardian may use it for a child's care in their own account. We do not knowingly create accounts for children.</p>
      </Section>

      <Section title="9. Changes">
        <p>If we change this policy we will update the date above and, for material changes, tell you in the app.</p>
      </Section>

      <Section title="10. Grievance officer and contact">
        <p>For privacy questions, complaints or to exercise your rights, contact our grievance officer: {COMPANY.grievanceOfficer}, at {COMPANY.email}.</p>
        <CompanyCard />
      </Section>
    </LegalLayout>
  );
}
