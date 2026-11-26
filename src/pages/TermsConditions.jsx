import React from 'react';
import { FileText } from 'lucide-react';
import { LegalLayout, Section, CompanyCard } from '@/components/common/LegalLayout';
import { COMPANY } from '@/config/legal';

export default function TermsConditions() {
  return (
    <LegalLayout title="Terms & Conditions" icon={FileText}>
      <p>
        By creating an account or using {COMPANY.product}, you agree to these Terms. If you do not agree, please do not
        use the app. Doctors and pharmacies must also accept the Provider Terms.
      </p>

      <Section title="1. What MediTrust is">
        <p>
          {COMPANY.product} is an online platform operated by {COMPANY.legalName} that helps patients find doctors and
          pharmacies, request appointments, reserve medicines for pickup, and keep prescription records. We are a
          technology platform. We are not a hospital, clinic or pharmacy, we do not employ the doctors or pharmacists
          listed, and we do not provide medical care.
        </p>
      </Section>

      <Section title="2. Accounts">
        <ul className="list-disc pl-5 space-y-1">
          <li>You must be 18 or older and give accurate information.</li>
          <li>Keep your password private. You are responsible for activity on your account.</li>
          <li>One person, one account. Do not share logins.</li>
          <li>We may suspend accounts that give false information or misuse the service.</li>
        </ul>
      </Section>

      <Section title="3. Doctors and pharmacies listed on the app">
        <p>
          Providers marked as verified have been checked against the details they submitted to us. This is not a
          guarantee of their skill or the quality of their service. Listings that come from public map data are not
          verified by us. Please confirm credentials yourself before relying on any provider.
        </p>
      </Section>

      <Section title="4. Appointments">
        <ul className="list-disc pl-5 space-y-1">
          <li>An appointment is confirmed only when the doctor accepts your request. Token numbers apply to the date shown.</li>
          <li>Consultation fees, if any, are agreed with and paid directly to the doctor at the clinic. MediTrust does not collect them during the pilot.</li>
          <li>Doctors may reschedule or cancel. We are not liable for delays, no-shows or cancellations by providers.</li>
        </ul>
      </Section>

      <Section title="5. Medicine reservations">
        <ul className="list-disc pl-5 space-y-1">
          <li>A reservation asks a pharmacy to hold medicines for you to collect. It is confirmed only when the pharmacy accepts it.</li>
          <li>You pay the pharmacy directly when you collect. Prices and stock are set by the pharmacy.</li>
          <li>Prescription-only medicines need a valid prescription and are dispensed at the pharmacist's discretion.</li>
          <li>We are not responsible for the quality of medicines or any side effects.</li>
        </ul>
      </Section>

      <Section title="6. AI assistant and health information">
        <p>
          The AI assistant and any health information in the app are for education and information only. They are not
          medical advice, diagnosis or a prescription, and they can be wrong. Never delay or ignore professional care
          because of something you read in the app. In an emergency call 108. See the Medical Disclaimer for more.
        </p>
      </Section>

      <Section title="7. Payments and plans">
        <p>
          During the pilot, patients are not charged by MediTrust. Doctors and pharmacies may buy a plan under the
          Provider Terms. Plans are activated manually and do not renew automatically. If we later add online payments,
          we will update these Terms before they start. See the Refund Policy.
        </p>
      </Section>

      <Section title="8. Acceptable use">
        <ul className="list-disc pl-5 space-y-1">
          <li>Do not give false information, impersonate others, or upload content you do not have the right to share.</li>
          <li>Do not try to break, overload or gain unauthorised access to the app or other users' data.</li>
          <li>Do not use the app to harass anyone or to sell prohibited items.</li>
        </ul>
      </Section>

      <Section title="9. Our responsibility">
        <p>
          We work to keep the app available and accurate, but it is provided "as is". To the extent the law allows, we
          are not liable for the acts or advice of doctors, pharmacies or other users, for medical outcomes, or for
          indirect losses. Nothing in these Terms limits any right you have under applicable consumer law, or liability
          that cannot legally be excluded.
        </p>
      </Section>

      <Section title="10. Ending your account">
        <p>You can stop using the app and ask us to delete your account at any time by emailing {COMPANY.email}. We may suspend or close accounts that break these Terms.</p>
      </Section>

      <Section title="11. Changes, governing law and disputes">
        <p>
          We may update these Terms and will change the date above. If you keep using the app after a change, you accept
          the updated Terms; for important changes we will tell you in the app. These Terms are governed by the laws of
          India. Courts in Andhra Pradesh will have jurisdiction, subject to any right you have to approach a consumer
          forum. Please contact us first so we can try to resolve the issue.
        </p>
      </Section>

      <Section title="12. Contact and grievances">
        <p>Grievance officer: {COMPANY.grievanceOfficer}, {COMPANY.email}. We reply within 2 business days.</p>
        <CompanyCard />
      </Section>
    </LegalLayout>
  );
}
