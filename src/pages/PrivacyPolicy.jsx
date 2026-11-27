import React from 'react';
import { Shield } from 'lucide-react';
import { LegalLayout, Section, CompanyCard } from '@/components/common/LegalLayout';
import { COMPANY } from '@/config/legal';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" icon={Shield}>
      <p>
        {COMPANY.product} ("we", "us", "our") is a digital healthcare platform run by {COMPANY.legalName}. It helps
        patients find doctors and pharmacies, book appointments, reserve medicines and keep their prescription records.
        This policy explains what personal information we collect, why, who it is shared with, how long we keep it, how
        we protect it, and how you can use your rights. By creating an account you consent to what is described here.
      </p>

      <Section title="1. Information we collect">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account information:</strong> name, email address, role (patient, doctor or pharmacy) and your password (kept only in hashed form by our authentication provider, never in readable form).</li>
          <li><strong>Profile information:</strong> phone number, city and, for doctors and pharmacies, professional and business details you enter (for example clinic name, registration or licence number, timings, fees).</li>
          <li><strong>Health information you choose to add:</strong> prescriptions, health records, allergies, medical history and similar details. Add only what you are comfortable storing.</li>
          <li><strong>Booking data:</strong> appointment requests, token numbers, medicine reservations and notifications.</li>
          <li><strong>Location:</strong> the city you select, and your device location only if you allow it, to show nearby providers.</li>
          <li><strong>AI assistant and voice inputs:</strong> messages you type or speak to the AI assistant, and its replies.</li>
          <li><strong>Technical data:</strong> basic device, browser and usage information needed to run and secure the app.</li>
        </ul>
      </Section>

      <Section title="2. Why we use it">
        <ul className="list-disc pl-5 space-y-1">
          <li>To create and secure your account and show you the right dashboard.</li>
          <li>To let patients book doctors and reserve medicines, and let providers manage those requests.</li>
          <li>To send appointment, token and prescription notifications. We keep these limited to important updates.</li>
          <li>To review and verify doctors and pharmacies before they are listed.</li>
          <li>To fix bugs, prevent misuse and improve the service.</li>
          <li>To follow the law and respond to lawful requests.</li>
        </ul>
        <p>We use your information only for these purposes. We do not sell your personal data.</p>
      </Section>

      <Section title="3. AI assistant and your privacy">
        <ul className="list-disc pl-5 space-y-1">
          <li>When you use the AI assistant, the text of your message is sent to an AI service provider, Google (Gemini), which processes it to write a reply. This happens outside MediTrust's own systems.</li>
          <li><strong>Please do not type identifiable health details</strong> into the assistant: your full name, phone number, address, ID numbers, or detailed medical records. Ask general questions instead.</li>
          <li>The assistant gives educational information only. It does not diagnose or prescribe, and it can be wrong. See the Medical Disclaimer.</li>
          <li>Your chat history is saved in your account so you can see it again. You can ask us to delete it, and it is also removed when your account is deleted.</li>
          <li>Voice input may be processed by your browser or device vendor's speech service before it reaches us.</li>
        </ul>
      </Section>

      <Section title="4. Who your information is shared with">
        <p>We share personal data only with the following, and only for the reason shown:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>The doctor or pharmacy you choose:</strong> they see the details needed to serve your booking, reservation or prescription. Nobody else on the platform can see them.</li>
          <li><strong>Supabase:</strong> our database, sign-in and file-storage provider. It stores your account, records and uploaded files on our behalf.</li>
          <li><strong>Netlify:</strong> our web hosting provider. It delivers the app and handles basic technical request data such as IP address.</li>
          <li><strong>Google (Gemini):</strong> AI assistant messages, as described in section 3.</li>
          <li><strong>OpenStreetMap services (Nominatim, Photon, Overpass):</strong> place searches and approximate coordinates, to find nearby doctors and pharmacies. No account details are sent.</li>
          <li><strong>Payment provider:</strong> none at present. If we add online payments we will update this policy first.</li>
          <li><strong>Authorities:</strong> where required by law or a valid legal order.</li>
        </ul>
        <p>Some of these providers store data on servers outside India.</p>
      </Section>

      <Section title="5. How we protect your information">
        <ul className="list-disc pl-5 space-y-1">
          <li>Each person can see only the records they are allowed to see. Patients see their own data, and doctors and pharmacies see only the bookings made with them.</li>
          <li>Connections between your device and our servers are encrypted.</li>
          <li>Administrator access is limited to authorised people at {COMPANY.legalName} and is used only for support, verification and safety.</li>
          <li>Uploaded files are kept in private storage, not on public links.</li>
          <li>We review our systems for security problems and fix what we find.</li>
        </ul>
        <p>No online service is completely secure, so we cannot guarantee absolute security. Keep your password private and sign out on shared devices.</p>
        <p>
          If a data breach affects your personal information, we will investigate and contain it, and tell the people
          affected and the authorities as the law requires, without unreasonable delay.
        </p>
      </Section>

      <Section title="6. How long we keep it">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account and profile:</strong> while your account is active, and removed within 30 days after a verified deletion request.</li>
          <li><strong>Health records and documents you add:</strong> until you delete them or your account is deleted.</li>
          <li><strong>Appointment and medicine reservation records:</strong> up to 3 years after the visit or pickup, for dispute handling and legal reasons. After a deletion request they are kept without your name and contact details.</li>
          <li><strong>Prescriptions:</strong> the doctor who wrote a prescription may need to keep their own copy for the period required by their profession. We keep it without your name and contact details after your account is deleted.</li>
          <li><strong>AI chat history:</strong> up to 12 months, or until you ask us to delete it.</li>
          <li><strong>Notifications:</strong> up to 90 days.</li>
          <li><strong>Doctor and pharmacy verification details:</strong> while the provider is listed and for 3 years after.</li>
          <li><strong>Technical and security logs:</strong> for the limited period our hosting and database providers keep them.</li>
        </ul>
        <p>We may keep information for longer only where the law requires it or to resolve a dispute.</p>
      </Section>

      <Section title="7. Your rights and how to use them">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Access:</strong> ask what personal data we hold about you and get a copy.</li>
          <li><strong>Correction:</strong> ask us to fix wrong or incomplete information. Where the app lets you edit a detail yourself, you can do so directly.</li>
          <li><strong>Deletion:</strong> ask us to delete your account and data.</li>
          <li><strong>Withdraw consent:</strong> you can withdraw your consent at any time. Some features may then stop working.</li>
          <li><strong>Grievance:</strong> complain to our grievance officer (section 10).</li>
        </ul>
        <p>
          <strong>How:</strong> email {COMPANY.email} from the address on your account, with the subject "Privacy request"
          and what you want. We confirm it is you, reply within 2 business days, and complete access and correction
          requests within 15 days.
        </p>
      </Section>

      <Section title="8. Deleting your account">
        <ul className="list-disc pl-5 space-y-1">
          <li>Email {COMPANY.email} from your account address with the subject "Delete my account".</li>
          <li>We verify that the request is from you, then confirm the date and what will be removed.</li>
          <li>Within 30 days we delete your profile, health records, uploaded files, AI chat history, notifications and sign-in. We remove your name and contact details from the booking and prescription records we must keep (see section 6).</li>
          <li>We email you when it is done. Deletion cannot be undone.</li>
        </ul>
      </Section>

      <Section title="9. Children and changes">
        <p>The app is for people aged 18 and over. A parent or guardian may use it for a child's care in their own account. We do not knowingly create accounts for children.</p>
        <p>If we change this policy we will update the date above and, for material changes, tell you in the app.</p>
      </Section>

      <Section title="10. Grievance officer and contact">
        <p>For privacy questions, complaints or to exercise your rights, contact our grievance officer: {COMPANY.grievanceOfficer}, at {COMPANY.email}.</p>
        <CompanyCard />
      </Section>
    </LegalLayout>
  );
}
