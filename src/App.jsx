import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import NotificationListener from '@/components/common/NotificationListener'
import { ThemeProvider } from 'next-themes'
import { useAndroidBack } from '@/hooks/useAndroidBack'
import { motion, AnimatePresence } from 'framer-motion'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import OAuthConsent from '@/pages/OAuthConsent';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Checkout from './pages/Checkout';
import HealthTrackerPremium from './pages/HealthTrackerPremium';
import BuilderPanel from './pages/BuilderPanel';
import Notifications from './pages/Notifications';
import About from './pages/About';
import Contact from './pages/Contact';
import AdminDashboard from './pages/AdminDashboard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsConditions from './pages/TermsConditions';
import MedicalDisclaimer from './pages/MedicalDisclaimer';
import RefundPolicy from './pages/RefundPolicy';
import ProviderTerms from './pages/ProviderTerms';
import features from '@/config/features';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const routeFeatureFlags = {
  UnifiedPricing: ['providerPlans', 'adBoosters'],
  SubscriptionPlans: ['providerPlans'],
  AdBoosters: ['adBoosters'],
  Checkout: ['onlinePayments'],
  HealthTrackerPremium: ['premiumHealth'],
  // v1 scope: these patient-side pages are switched off (see src/config/features.js)
  ChatAssistant: ['aiAssistant'],
  SymptomChecker: ['symptomChecker'],
  VerifyMedicine: ['medicineChecker'],
  HealthTracker: ['healthTracker'],
  OrderMedicines: ['pharmacy'],
  Pharmacies: ['pharmacy'],
  PatientReservations: ['pharmacy'],
};

const roleHomePages = {
  patient: 'PatientDashboard',
  doctor: 'DoctorDashboard',
  pharmacy: 'PharmacyDashboard',
  admin: 'AdminDashboard',
};

const pageRoles = {
  BookAppointment: ['patient'],
  ChatAssistant: ['patient'],
  DoctorAnalytics: ['doctor'],
  DoctorAppointments: ['doctor'],
  DoctorDashboard: ['doctor'],
  DoctorProfile: ['doctor'],
  DoctorQueueSettings: ['doctor'],
  FindDoctors: ['patient'],
  OrderMedicines: ['patient'],
  PatientAppointments: ['patient'],
  PatientDashboard: ['patient'],
  PatientPrescriptions: ['patient'],
  PatientReservations: ['patient'],
  Pharmacies: ['patient'],
  PharmacyDashboard: ['pharmacy'],
  PharmacyInventory: ['pharmacy'],
  PharmacyOrders: ['pharmacy'],
  SymptomChecker: ['patient'],
  VerifyMedicine: ['patient'],
  WritePrescription: ['doctor'],
  AdminDashboard: ['admin'],
  BuilderPanel: ['admin'],
  AdBoosters: ['doctor', 'pharmacy'],
  Checkout: ['patient'],
  HealthTracker: ['patient'],
  HealthTrackerPremium: ['patient'],
  SubscriptionPlans: ['doctor', 'pharmacy'],
  UnifiedPricing: ['doctor', 'pharmacy'],
};

const authenticatedPages = ['Notifications', 'Onboarding'];

const GuardedPage = ({ pageName, Page }) => {
  const { user, isAuthenticated } = useAuth();
  const homePage = roleHomePages[user?.role];
  const allowedRoles = pageRoles[pageName];

  if ((pageName === 'Welcome' || pageName === 'SignIn') && homePage) {
    return <Navigate to={`/${homePage}`} replace />;
  }

  if ((allowedRoles || authenticatedPages.includes(pageName)) && !isAuthenticated) {
    return <Navigate to="/Welcome" replace />;
  }

  if (allowedRoles && (!homePage || !allowedRoles.includes(user?.role))) {
    return <Navigate to={homePage ? `/${homePage}` : '/Welcome'} replace />;
  }

  const disabledFlags = routeFeatureFlags[pageName]?.filter((flag) => !features[flag]) || [];
  if (disabledFlags.length > 0) {
    return <Navigate to={homePage ? `/${homePage}` : '/Welcome'} replace />;
  }

  return <Page />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  useAndroidBack();

  // MCP OAuth consent page handles its own auth (redirects to login when signed
  // out, preserving the ctx handle). It MUST bypass the app's auth guard below,
  // which would otherwise strip the ctx context before the page can preserve it.
  const location = useLocation();
  if (location.pathname === '/oauth/consent') {
    return <OAuthConsent />;
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  // Render the main app
  return (
    <AnimatePresence mode="wait">
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
    <Routes location={location}>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <GuardedPage pageName={mainPageKey} Page={MainPage} />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <GuardedPage pageName={path} Page={Page} />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="Checkout" element={<LayoutWrapper currentPageName="Checkout"><GuardedPage pageName="Checkout" Page={Checkout} /></LayoutWrapper>} />
      <Route path="HealthTrackerPremium" element={<LayoutWrapper currentPageName="HealthTrackerPremium"><GuardedPage pageName="HealthTrackerPremium" Page={HealthTrackerPremium} /></LayoutWrapper>} />
      <Route path="BuilderPanel" element={<LayoutWrapper currentPageName="BuilderPanel"><GuardedPage pageName="BuilderPanel" Page={BuilderPanel} /></LayoutWrapper>} />
      <Route path="Notifications" element={<LayoutWrapper currentPageName="Notifications"><GuardedPage pageName="Notifications" Page={Notifications} /></LayoutWrapper>} />
      <Route path="About" element={<LayoutWrapper currentPageName="About"><About /></LayoutWrapper>} />
      <Route path="Contact" element={<LayoutWrapper currentPageName="Contact"><Contact /></LayoutWrapper>} />
      <Route path="AdminDashboard" element={<LayoutWrapper currentPageName="AdminDashboard"><GuardedPage pageName="AdminDashboard" Page={AdminDashboard} /></LayoutWrapper>} />
      <Route path="PrivacyPolicy" element={<LayoutWrapper currentPageName="PrivacyPolicy"><PrivacyPolicy /></LayoutWrapper>} />
      <Route path="TermsConditions" element={<LayoutWrapper currentPageName="TermsConditions"><TermsConditions /></LayoutWrapper>} />
      <Route path="MedicalDisclaimer" element={<LayoutWrapper currentPageName="MedicalDisclaimer"><MedicalDisclaimer /></LayoutWrapper>} />
      <Route path="RefundPolicy" element={<LayoutWrapper currentPageName="RefundPolicy"><RefundPolicy /></LayoutWrapper>} />
      <Route path="ProviderTerms" element={<LayoutWrapper currentPageName="ProviderTerms"><ProviderTerms /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </motion.div>
    </AnimatePresence>
  );
};

function App() {

  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NavigationTracker />
            <NotificationListener />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App