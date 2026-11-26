import React from 'react';

export default function Layout({ children, currentPageName }) {
  // Pages that should not have any layout wrapper
  const noLayoutPages = ['Welcome', 'SignIn', 'PatientDashboard', 'DoctorDashboard', 'PharmacyDashboard'];
  
  if (noLayoutPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background dark:bg-zinc-950">
      {children}
    </div>
  );
}