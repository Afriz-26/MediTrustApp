import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LanguageProvider } from '@/components/ui/LanguageContext';
import { COMPANY } from '@/config/legal';

// Shared shell for all legal pages so wording and company details stay consistent.
export function LegalLayout({ title, icon: Icon, children, tone = 'blue' }) {
  const header = tone === 'amber' ? 'from-slate-800 to-amber-700' : 'from-slate-800 to-blue-900';
  const page = tone === 'amber' ? 'to-amber-50' : 'to-blue-50';
  return (
    <LanguageProvider>
      <div className={`min-h-screen bg-gradient-to-b from-slate-50 ${page}`}>
        <div className={`bg-gradient-to-r ${header} pt-8 pb-6 px-4`}>
          <div className="max-w-3xl mx-auto flex items-center gap-4">
            <Link to={createPageUrl('Welcome')} className="p-2 -ml-2" aria-label="Back">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5 text-white" />}
              <h1 className="text-xl font-bold text-white">{title}</h1>
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-sm text-gray-700 leading-relaxed">
          <p className="text-gray-500">Last updated: {COMPANY.lastUpdated}</p>
          {children}
          <LegalLinks />
        </div>
      </div>
    </LanguageProvider>
  );
}

export function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function CompanyCard({ heading = 'Operated by' }) {
  return (
    <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <p className="text-xs uppercase tracking-wide text-gray-500">{heading}</p>
      <p className="font-semibold text-gray-800">{COMPANY.legalName}</p>
      <p className="text-sm text-gray-600 mt-1">LLPIN: {COMPANY.llpin}</p>
      <p className="text-sm text-gray-600 mt-1">Registered office: {COMPANY.registeredOffice}</p>
      <p className="text-sm text-gray-600 mt-1">Operating in: {COMPANY.operatingCity}</p>
      <p className="text-sm text-gray-600 mt-1">
        Email: <a href={`mailto:${COMPANY.email}`} className="text-blue-600 hover:underline">{COMPANY.email}</a>
      </p>
      <p className="text-sm text-gray-600 mt-1">
        Phone: <a href={`tel:${COMPANY.phoneHref}`} className="text-blue-600 hover:underline">{COMPANY.phone}</a>
      </p>
    </div>
  );
}

const LINKS = [
  ['PrivacyPolicy', 'Privacy Policy'],
  ['TermsConditions', 'Terms'],
  ['RefundPolicy', 'Refunds'],
  ['ProviderTerms', 'Provider Terms'],
  ['MedicalDisclaimer', 'Medical Disclaimer'],
  ['Contact', 'Contact'],
];

export function LegalLinks({ className = '' }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pt-4 border-t border-slate-200 ${className}`}>
      {LINKS.map(([page, label]) => (
        <Link key={page} to={createPageUrl(page)} className="underline hover:text-blue-600">{label}</Link>
      ))}
    </div>
  );
}

export default LegalLayout;
