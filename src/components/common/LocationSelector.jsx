import React, { useState, useEffect } from 'react';
import { MapPin, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import MobileDrawerSelect from '@/components/common/MobileDrawerSelect';
import { useLanguage } from '../ui/LanguageContext';

const locationData = {
  India: {
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'],
    'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Trichy'],
    'Karnataka': ['Bangalore', 'Mysore', 'Mangalore', 'Hubli'],
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
    'Delhi': ['New Delhi', 'South Delhi', 'North Delhi', 'East Delhi'],
  },
  USA: {
    'California': ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento'],
    'New York': ['New York City', 'Buffalo', 'Rochester', 'Albany'],
    'Texas': ['Houston', 'Dallas', 'Austin', 'San Antonio'],
  }
};

export default function LocationSelector({ onLocationSet, compact = false }) {
  const { t } = useLanguage();
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('meditrust_location');
    if (saved) {
      const loc = JSON.parse(saved);
      setCountry(loc.country || '');
      setState(loc.state || '');
      setCity(loc.city || '');
    }
  }, []);

  const handleSave = () => {
    const location = { country, state, city };
    localStorage.setItem('meditrust_location', JSON.stringify(location));
    if (onLocationSet) {
      onLocationSet(location);
    }
  };

  const countries = Object.keys(locationData);
  const states = country ? Object.keys(locationData[country]) : [];
  const cities = state && country ? locationData[country][state] : [];

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="w-4 h-4 text-gray-500" />
        <span className="text-gray-700">
          {city ? `${city}, ${state}` : 'Set Location'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-sky-100 rounded-xl flex items-center justify-center">
          <MapPin className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Select Your Location</h3>
          <p className="text-xs text-gray-500">Find local doctors & pharmacies</p>
        </div>
      </div>

      <div className="space-y-3">
        <MobileDrawerSelect
          value={country}
          onChange={(val) => { setCountry(val); setState(''); setCity(''); }}
          options={countries.map(c => ({ value: c, label: c }))}
          placeholder="Select Country"
          title="Select Country"
          triggerClassName="h-12 rounded-xl"
        />

        <MobileDrawerSelect
          value={state}
          onChange={(val) => { setState(val); setCity(''); }}
          options={states.map(s => ({ value: s, label: s }))}
          placeholder="Select State"
          title="Select State"
          triggerClassName="h-12 rounded-xl"
        />

        <MobileDrawerSelect
          value={city}
          onChange={setCity}
          options={cities.map(c => ({ value: c, label: c }))}
          placeholder="Select City"
          title="Select City"
          triggerClassName="h-12 rounded-xl"
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={!city}
        className="w-full h-12 bg-gradient-to-r from-blue-500 to-sky-500 rounded-xl font-medium"
      >
        Save Location
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}