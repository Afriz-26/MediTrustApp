import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, ArrowLeft, Send, ShieldAlert } from 'lucide-react';
import { LanguageProvider } from '@/components/ui/LanguageContext';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LegalLinks } from '@/components/common/LegalLayout';
import { COMPANY } from '@/config/legal';

function ContactContent() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // There is no mail server behind this form, so it opens the person's own email app
  // with the message filled in. It never claims a message was sent when it was not.
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    const subject = encodeURIComponent(`MediTrust enquiry from ${form.name}`);
    const body = encodeURIComponent(`${form.message}\n\nName: ${form.name}\nReply to: ${form.email}`);
    window.location.href = `mailto:${COMPANY.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 pt-12 pb-6 px-4 rounded-b-3xl">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link to={createPageUrl('Welcome')} className="p-2 -ml-2" aria-label="Back">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Mail className="w-7 h-7" /> Contact Us
          </h1>
          <p className="text-white/80 text-sm mt-2">Questions, feedback, complaints or partnership enquiries. We reply within 2 business days.</p>
        </div>
      </div>

      <div className="px-4 py-8 max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Mail className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h3 className="font-semibold text-slate-800">Email</h3>
              <a href={`mailto:${COMPANY.email}`} className="text-sm text-blue-600 hover:underline break-all">{COMPANY.email}</a>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Phone className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <h3 className="font-semibold text-slate-800">Phone</h3>
              <a href={`tel:${COMPANY.phoneHref}`} className="text-sm text-blue-600 hover:underline">{COMPANY.phone}</a>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0"><MapPin className="w-5 h-5 text-rose-600" /></div>
            <div>
              <h3 className="font-semibold text-slate-800">{COMPANY.legalName}</h3>
              <p className="text-sm text-slate-600">LLPIN: {COMPANY.llpin}</p>
              <p className="text-sm text-slate-600">Registered office: {COMPANY.registeredOffice}</p>
              <p className="text-sm text-slate-600">Operating in: {COMPANY.operatingCity}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0"><ShieldAlert className="w-5 h-5 text-amber-600" /></div>
            <div>
              <h3 className="font-semibold text-slate-800">Grievance officer</h3>
              <p className="text-sm text-slate-600">{COMPANY.grievanceOfficer}</p>
              <p className="text-sm text-slate-600">Privacy and complaint requests: {COMPANY.email}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Name</label>
            <Input name="name" value={form.name} onChange={handleChange} placeholder="Your name" className="mt-1" required />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Your email</label>
            <Input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" className="mt-1" required />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Message</label>
            <Textarea name="message" value={form.message} onChange={handleChange} placeholder="How can we help?" className="mt-1" rows={4} required />
          </div>
          <Button type="submit" className="w-full"><Send className="w-4 h-4" /> Open in my email app</Button>
          <p className="text-xs text-slate-500">This opens your email app with the message ready to send. For a medical emergency call 108. Do not email health emergencies.</p>
        </form>
      </div>

      <div className="px-4 pb-10 max-w-3xl mx-auto"><LegalLinks /></div>
    </div>
  );
}

export default function Contact() {
  return (
    <LanguageProvider>
      <ContactContent />
    </LanguageProvider>
  );
}
