import { db } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Stethoscope, Building2, LogIn, UserPlus, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from '@/components/common/Logo';
import LanguageSelector from '@/components/common/LanguageSelector';
import Disclaimer from '@/components/common/Disclaimer';
import { useLanguage, LanguageProvider } from '@/components/ui/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { LegalLinks } from '@/components/common/LegalLayout';

const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true';

function SignInContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { loginAs, signIn, signUp, resetPassword } = useAuth();
  const [selectedRole, setSelectedRole] = useState('patient');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState(true);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    if (['patient', 'doctor', 'pharmacy'].includes(role)) {
      setSelectedRole(role);
    }
    db.auth.isAuthenticated().then((authed) => {
      // Signed-in users are redirected to their home page by the route guard.
      if (!authed) setChecking(false);
    });
  }, []);

  const roles = [
    { id: 'patient', icon: User, label: t('patient') },
    { id: 'doctor', icon: Stethoscope, label: t('doctor') },
    { id: 'pharmacy', icon: Building2, label: t('pharmacy') },
  ];

  const goHome = (role, onboarded) => {
    const dashboard = role === 'doctor' ? 'DoctorDashboard' : role === 'pharmacy' ? 'PharmacyDashboard' : role === 'admin' ? 'AdminDashboard' : 'PatientDashboard';
    navigate(createPageUrl(onboarded ? dashboard : 'Onboarding'));
  };

  const handleMock = async () => {
    await loginAs(selectedRole);
    localStorage.setItem('meditrust_location', JSON.stringify({ city: 'Tirupati', state: 'Andhra Pradesh', country: 'India', display: 'Tirupati, Andhra Pradesh, India' }));
    goHome(selectedRole, true);
  };

  const validate = () => {
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
    if (mode === 'signup') {
      if (!fullName.trim()) return 'Enter your name.';
      if (password.length < 8) return 'Password must be at least 8 characters.';
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password needs letters and numbers.';
      if (!agreed) return 'Please tick the box to accept the Terms and Privacy Policy.';
    } else if (!password) {
      return 'Enter your password.';
    }
    return '';
  };

  const submit = async (e) => {
    e?.preventDefault();
    setError(''); setNotice('');
    if (USE_MOCK) {
      try {
        await handleMock();
      } catch (error) {
        setError(error.message || 'Could not start the sample account.');
      }
      return;
    }
    const problem = validate();
    if (problem) { setError(problem); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const result = await signUp({ email: email.trim(), password, fullName: fullName.trim(), role: selectedRole });
        if (result.needsEmailConfirmation) {
          setNotice('Account created. Check your email and tap the confirmation link, then sign in here.');
          setMode('signin');
          setPassword('');
        }
        // otherwise the route guard moves a signed-in user forward automatically
      } else {
        let u;
        try {
          u = await signIn({ email: email.trim(), password });
        } catch (firstErr) {
          // Phone keyboards sometimes add a space after the last word; retry once without it.
          if (/invalid login/i.test(String(firstErr.message || '')) && password !== password.trim()) {
            u = await signIn({ email: email.trim(), password: password.trim() });
          } else {
            throw firstErr;
          }
        }
        if (u?.role === 'admin') navigate(createPageUrl('AdminDashboard'));
      }
    } catch (err) {
      const msg = String(err.message || '');
      if (/invalid login/i.test(msg)) setError('Wrong email or password.');
      else if (/already registered|already been registered/i.test(msg)) setError('This email already has an account. Try signing in.');
      else if (/confirm/i.test(msg)) setError('Please confirm your email first (check your inbox), then sign in.');
      else setError(msg || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(''); setNotice('');
    if (!email.trim()) { setError('Enter your email above first.'); return; }
    try {
      await resetPassword(email.trim());
      setNotice('If that email has an account, a reset link is on its way.');
    } catch (err) {
      setError(err.message || 'Could not send the reset email.');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 via-white to-emerald-50">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const isSignup = mode === 'signup';

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-72 h-72 bg-sky-200/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl"></div>

      <div className="relative z-10 min-h-screen flex flex-col px-6 py-8 max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
          <Link to={createPageUrl('Welcome')} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6 text-gray-600" /></Link>
          <LanguageSelector />
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center mb-6">
          <Logo size="default" showTagline={false} />
        </motion.div>

        {isSignup && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex bg-gray-100 rounded-2xl p-1.5 mb-5">
            {roles.map((role) => (
              <button key={role.id} type="button" onClick={() => setSelectedRole(role.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${selectedRole === role.id ? 'bg-white shadow-md text-blue-600' : 'text-gray-500'}`}>
                <role.icon className="w-4 h-4" />
                <span className="text-sm">{role.label}</span>
              </button>
            ))}
          </motion.div>
        )}

        <motion.form onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">{isSignup ? 'Create your account' : t('welcome')}</h2>
          <p className="text-sm text-gray-500 text-center mb-5">
            {isSignup ? 'Sign up as a patient, doctor or pharmacy.' : 'Sign in to your Medi Trust account.'}
          </p>

          <div className="space-y-3">
            {isSignup && (
              <Input placeholder={selectedRole === 'pharmacy' ? 'Pharmacy or owner name' : 'Full name'} value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 rounded-xl" autoComplete="name" />
            )}
            <Input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" autoComplete="email" />
            <div className="relative">
              <Input type={showPw ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={isSignup ? 'Password (8+ characters, letters and numbers)' : 'Password'} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl pr-12" autoComplete={isSignup ? 'new-password' : 'current-password'} />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400">
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isSignup && (
            <label className="flex items-start gap-2 mt-4 text-xs text-gray-600 leading-relaxed cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                I am 18 or older and I agree to the{' '}
                <Link to={createPageUrl('TermsConditions')} target="_blank" className="text-blue-600 underline">Terms</Link>,{' '}
                <Link to={createPageUrl('PrivacyPolicy')} target="_blank" className="text-blue-600 underline">Privacy Policy</Link> and{' '}
                <Link to={createPageUrl('MedicalDisclaimer')} target="_blank" className="text-blue-600 underline">Medical Disclaimer</Link>.
                {selectedRole !== 'patient' && (
                  <> I also accept the <Link to={createPageUrl('ProviderTerms')} target="_blank" className="text-blue-600 underline">Provider Terms</Link>.</>
                )}
                {' '}I understand MediTrust gives educational information, not medical advice.
              </span>
            </label>
          )}

          {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
          {notice && <p className="mt-3 text-sm text-emerald-700">{notice}</p>}

          <Button type="submit" disabled={busy}
            className="w-full h-12 mt-4 text-base font-semibold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 rounded-xl">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : (<>{isSignup ? <UserPlus className="w-5 h-5 mr-2" /> : <LogIn className="w-5 h-5 mr-2" />}{isSignup ? 'Create Account' : t('login')}</>)}
          </Button>

          <div className="flex items-center justify-between mt-4 text-sm">
            <button type="button" className="text-blue-600 font-medium" onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(''); setNotice(''); }}>
              {isSignup ? 'I already have an account' : 'Create an account'}
            </button>
            {!isSignup && <button type="button" className="text-gray-500" onClick={forgot}>Forgot password?</button>}
          </div>

          <div className="flex items-center gap-2 mt-5 text-xs text-gray-400 justify-center">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure sign-in powered by Medi Trust</span>
          </div>
        </motion.form>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-auto pt-6">
          <Disclaimer compact />
          <LegalLinks className="mt-4" />
        </motion.div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <LanguageProvider>
      <SignInContent />
    </LanguageProvider>
  );
}