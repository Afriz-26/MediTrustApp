import React from 'react';
import { RotateCcw } from 'lucide-react';
import { LegalLayout, Section, CompanyCard } from '@/components/common/LegalLayout';
import { COMPANY } from '@/config/legal';

export default function RefundPolicy() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" icon={RotateCcw}>
      <p>
        This policy explains refunds and cancellations on {COMPANY.product}, operated by {COMPANY.legalName}. During
        the pilot, MediTrust does not collect payments from patients.
      </p>

      <Section title="1. Patients">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Consultation fees</strong> are paid directly to the doctor at the clinic. Any refund of a fee is between you and the doctor.</li>
          <li><strong>Medicines</strong> are paid for directly at the pharmacy when you collect them. Returns and refunds follow the pharmacy's own policy and the law.</li>
          <li><strong>Cancelling:</strong> you can cancel an appointment request or medicine reservation from the app before it is completed. Please cancel early so someone else can use the slot or stock.</li>
          <li>If a provider cancels or is unavailable, you owe nothing to MediTrust. If you already paid the provider, ask them for a refund. If they do not respond, email us and we will follow up with them.</li>
        </ul>
      </Section>

      <Section title="2. Doctors and pharmacies (plan fees)">
        <ul className="list-disc pl-5 space-y-1">
          <li>Plan fees are paid by UPI and the plan is activated manually by our team after we confirm the payment.</li>
          <li>If your plan is not activated within 3 business days of a confirmed payment, you can ask for a full refund.</li>
          <li>If you paid the wrong amount or paid twice, we will refund the extra amount.</li>
          <li>You can ask for a refund within 7 days of activation if you have not used the paid features.</li>
          <li>After that, plan fees for a period already used are not refundable, but you can stop the plan at any time and it will not renew.</li>
        </ul>
      </Section>

      <Section title="3. How to ask and how long it takes">
        <p>
          Email {COMPANY.email} from your account email with the date, amount and UPI reference. We reply within 2
          business days. Approved refunds are sent to the same UPI ID or account the payment came from, usually within 7
          to 10 business days.
        </p>
      </Section>

      <Section title="4. Online payments in future">
        <p>If we add online payment, this policy will be updated before it starts.</p>
        <CompanyCard heading="Contact" />
      </Section>
    </LegalLayout>
  );
}
