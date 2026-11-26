// Curated medicine catalog supporting keyword / symptom fuzzy search.
// Users often don't know exact names, so we match on name, generic, uses, and symptoms.

export const medicineCatalog = [
  { id: "paracetamol500", name: "Paracetamol 500mg", generic: "Paracetamol", category: "pain_relief", price: 25, uses: "Fever, headache, body pain", symptoms: ["fever", "headache", "pain", "body pain", "cold"], rx: false },
  { id: "dolo650", name: "Dolo 650", generic: "Paracetamol", category: "pain_relief", price: 30, uses: "Fever, headache, body pain (higher dose)", symptoms: ["fever", "headache", "pain", "body pain", "cold"], rx: false },
  { id: "ibuprofen400", name: "Ibuprofen 400mg", generic: "Ibuprofen", category: "pain_relief", price: 35, uses: "Pain, inflammation, fever, arthritis, menstrual cramps", symptoms: ["pain", "inflammation", "fever", "arthritis", "cramps", "swelling"], rx: false },
  { id: "diclofenac", name: "Diclofenac 50mg", generic: "Diclofenac", category: "pain_relief", price: 30, uses: "Pain, inflammation, joint pain, sprains", symptoms: ["pain", "joint pain", "sprain", "inflammation", "back pain"], rx: false },
  { id: "cetirizine10", name: "Cetirizine 10mg", generic: "Cetirizine", category: "allergy", price: 30, uses: "Allergies, hay fever, hives, allergic rhinitis", symptoms: ["allergy", "sneezing", "itching", "hives", "hay fever", "running nose"], rx: false },
  { id: "montelukast", name: "Montelukast 10mg", generic: "Montelukast", category: "respiratory", price: 130, uses: "Asthma, allergic rhinitis, breathing", symptoms: ["asthma", "wheezing", "breathing", "allergy", "cough"], rx: true },
  { id: "salbutamol", name: "Salbutamol Inhaler", generic: "Salbutamol", category: "respiratory", price: 220, uses: "Quick relief from asthma, breathing difficulty", symptoms: ["asthma", "breathing", "wheezing", "shortness of breath"], rx: true },
  { id: "coughsyrup", name: "Cough Syrup (Benadryl)", generic: "Diphenhydramine", category: "respiratory", price: 110, uses: "Cough, cold, throat irritation", symptoms: ["cough", "cold", "throat", "congestion"], rx: false },
  { id: "amoxicillin250", name: "Amoxicillin 250mg", generic: "Amoxicillin", category: "antibiotics", price: 120, uses: "Bacterial infections: respiratory, ear, throat", symptoms: ["infection", "throat infection", "ear infection", "bacterial", "antibiotic"], rx: true },
  { id: "azithromycin500", name: "Azithromycin 500mg", generic: "Azithromycin", category: "antibiotics", price: 95, uses: "Respiratory, skin, soft tissue infections", symptoms: ["infection", "cough", "throat", "skin infection", "antibiotic"], rx: true },
  { id: "vitc500", name: "Vitamin C 500mg", generic: "Ascorbic Acid", category: "vitamins", price: 45, uses: "Immunity, antioxidant, wound healing", symptoms: ["immunity", "weakness", "cold prevention", "vitamin"], rx: false },
  { id: "vitd3", name: "Vitamin D3 60K", generic: "Cholecalciferol", category: "vitamins", price: 120, uses: "Bone health, calcium absorption", symptoms: ["bone pain", "weakness", "vitamin d", "calcium"], rx: false },
  { id: "multivitamin", name: "Multivitamin Complex", generic: "Multivitamin", category: "vitamins", price: 180, uses: "Daily vitamins and minerals for overall health", symptoms: ["weakness", "fatigue", "supplement", "vitamin"], rx: false },
  { id: "ironfolic", name: "Iron + Folic Acid", generic: "Ferrous Fumarate", category: "vitamins", price: 65, uses: "Anemia, iron deficiency, pregnancy supplement", symptoms: ["anemia", "weakness", "iron", "tired", "pregnancy"], rx: false },
  { id: "omeprazole20", name: "Omeprazole 20mg", generic: "Omeprazole", category: "digestive", price: 80, uses: "Acid reflux, heartburn, stomach ulcers, GERD", symptoms: ["acidity", "heartburn", "reflux", "stomach pain", "ulcer", "gas", "indigestion"], rx: false },
  { id: "pantop40", name: "Pantoprazole 40mg", generic: "Pantoprazole", category: "digestive", price: 90, uses: "Acidity, reflux, GERD", symptoms: ["acidity", "heartburn", "reflux", "gas", "stomach"], rx: false },
  { id: "ranitidine", name: "Ranitidine 150mg", generic: "Ranitidine", category: "digestive", price: 40, uses: "Acidity, stomach ulcers", symptoms: ["acidity", "stomach pain", "ulcer", "gas"], rx: false },
  { id: "ors", name: "ORS Electrolyte Powder", generic: "Oral Rehydration Salts", category: "digestive", price: 20, uses: "Dehydration, diarrhea, electrolyte loss", symptoms: ["diarrhea", "dehydration", "loose motion", "vomiting"], rx: false },
  { id: "clindamycingel", name: "Clindamycin Gel 1%", generic: "Clindamycin", category: "skin_care", price: 150, uses: "Acne, bacterial skin infections", symptoms: ["acne", "pimples", "skin infection", "rash"], rx: true },
  { id: "povidone", name: "Povidone Iodine Ointment", generic: "Povidone Iodine", category: "skin_care", price: 75, uses: "Wound antiseptic, cuts, burns", symptoms: ["wound", "cut", "burn", "antiseptic", "injury"], rx: false },
  { id: "metformin500", name: "Metformin 500mg", generic: "Metformin", category: "diabetic", price: 60, uses: "Type 2 diabetes, blood sugar control", symptoms: ["diabetes", "blood sugar", "sugar"], rx: true },
  { id: "insulinglargine", name: "Insulin Glargine 100IU", generic: "Insulin Glargine", category: "diabetic", price: 850, uses: "Long-acting insulin for diabetes", symptoms: ["diabetes", "insulin", "blood sugar"], rx: true },
  { id: "amlodipine5", name: "Amlodipine 5mg", generic: "Amlodipine", category: "cardiac", price: 55, uses: "High blood pressure, hypertension", symptoms: ["blood pressure", "hypertension", "bp"], rx: true },
  { id: "atorvastatin10", name: "Atorvastatin 10mg", generic: "Atorvastatin", category: "cardiac", price: 110, uses: "High cholesterol, lipid control", symptoms: ["cholesterol", "lipid", "heart"], rx: true },
];

export const medicineCategories = [
  { id: "all", name: "All Medicines" },
  { id: "pain_relief", name: "Pain & Fever" },
  { id: "allergy", name: "Allergy" },
  { id: "antibiotics", name: "Antibiotics" },
  { id: "respiratory", name: "Respiratory" },
  { id: "digestive", name: "Digestive" },
  { id: "vitamins", name: "Vitamins" },
  { id: "skin_care", name: "Skin Care" },
  { id: "cardiac", name: "Cardiac" },
  { id: "diabetic", name: "Diabetic" },
];

/**
 * Fuzzy keyword search across name, generic, uses, and symptoms.
 * Returns ranked matches.
 */
export function searchMedicines(query) {
  if (!query || !query.trim()) return medicineCatalog;
  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/);
  return medicineCatalog
    .map((m) => {
      const haystack = [m.name, m.generic, m.uses, ...(m.symptoms || []), m.category]
        .join(" ")
        .toLowerCase();
      let score = 0;
      if (m.name.toLowerCase().includes(q)) score += 10;
      if (m.generic.toLowerCase().includes(q)) score += 8;
      for (const term of terms) {
        if (haystack.includes(term)) score += 3;
        if ((m.symptoms || []).some((s) => s.includes(term) || term.includes(s))) score += 2;
      }
      return { ...m, _score: score };
    })
    .filter((m) => m._score > 0)
    .sort((a, b) => b._score - a._score);
}