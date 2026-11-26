import React from 'react';
import { Stethoscope } from 'lucide-react';
import { LegalLayout, Section, CompanyCard } from '@/components/common/LegalLayout';
import { COMPANY } from '@/config/legal';

export default function ProviderTerms() {
  return (
    <LegalLayout title="Provider Terms (Doctors & Pharmacies)" icon={Stethoscope}>
      <p>
        These terms apply to doctors and pharmacies who list on {COMPANY.product}, operated by {COMPANY.legalName}, in
        addition to the general Terms & Conditions and Privacy Policy. By registering as a provider you accept them.
      </p>

      <Section title="1. Who can list">
        <ul className="list-disc pl-5 space-y-1">
          <li>Doctors must hold a valid registration to practise in India and give the registration details we ask for.</li>
          <li>Pharmacies must hold a valid drug licence and have a licensed pharmacist on duty.</li>
          <li>All details you give must be true and kept up to date. We may ask for documents and may decline or remove a listing.</li>
        </ul>
      </Section>

      <Section title="2. Your professional responsibility">
        <ul className="list-disc pl-5 space-y-1">
          <li>You alone are responsible for medical advice, prescriptions, dispensing and patient care. MediTrust does not supervise or endorse them.</li>
          <li>Prescriptions written in the app must follow the law and your professional standards.</li>
          <li>Pharmacies must follow drug rules, including for prescription-only medicines, and must keep stock and prices accurate.</li>
          <li>Do not make false claims about your services, results or qualifications.</li>
        </ul>
      </Section>

      <Section title="3. Patient data">
        <ul className="list-disc pl-5 space-y-1">
          <li>Use patient information only to provide the service the patient asked for.</li>
          <li>Do not share, sell, copy or contact patients for unrelated marketing.</li>
          <li>Keep your login private and tell us at once if you think your account has been misused.</li>
          <li>You must follow the data and record-keeping rules that apply to your profession.</li>
        </ul>
      </Section>

      <Section title="4. Plans, fees and trial">
        <ul className="list-disc pl-5 space-y-1">
          <li>Plan names, prices and what each includes are shown in the app. Only plans marked as available can be bought.</li>
          <li>During the pilot, a free trial may be offered to early providers. The length is stated to you when you are onboarded.</li>
          <li>Fees are paid by UPI and the plan is activated manually after we confirm the payment. Plans do not renew automatically.</li>
          <li>Refunds follow the Refund Policy. We may change prices for future periods with notice in the app.</li>
        </ul>
      </Section>

      <Section title="5. Fees between you and patients">
        <p>You set and collect your own consultation and medicine charges. MediTrust does not take a commission on them during the pilot.</p>
      </Section>

      <Section title="6. Suspension and removal">
        <p>
          We may suspend or remove a listing for false information, patient complaints, unsafe or unlawful conduct, or
          breach of these terms. You can ask us to close your account at any time.
        </p>
      </Section>

      <Section title="7. Liability">
        <p>
          We provide a platform and do not guarantee that you will receive any number of patients. You agree to
          compensate {COMPANY.legalName} for losses caused by your breach of these terms or by your professional acts.
        </p>
      </Section>

      <Section title="8. Contact">
        <CompanyCard />
      </Section>
    </LegalLayout>
  );
}
