export const features = {
  video: false,
  audioChat: false,
  delivery: false,
  adBoosters: false,
  providerPlans: true,
  premiumHealth: false,
  onlinePayments: false,
  // Nearby public OpenStreetMap listings are enabled for provider discovery.
  externalListings: true,

  // ── v1 scope: doctor booking + token queue, with patient prescription records ──
  aiAssistant: true,      // AI chat + voice assistant (health advice is educational, not diagnosis)
  symptomChecker: false,  // Symptom Checker
  medicineChecker: false, // Medicine Checker / medicine info
  pharmacy: true,         // Pharmacy role, pharmacy listing, medicine reservations, "My medicine orders" (back ON Nov 5 for testing)
  healthTracker: true,    // Patient health records include saved prescriptions
};

export default features;
