import React, { createContext, useContext, useState } from 'react';

export interface Persona {
  id: string;
  name: string;
  avatar: string; // URL or emoji fallback
  affinityProfileJson: string;
}

interface PersonaContextValue {
  personas: Persona[];
  activePersonaId: string | null; // null = "none" (use config defaults)
  setActivePersonaId: (id: string | null) => void;
  setPersonas: (personas: Persona[]) => void;
  activePersona: Persona | null;
}

const STORAGE_KEY = 'dy_sinsay_personas';
const ACTIVE_KEY = 'dy_sinsay_active_persona';

const defaultPersonas: Persona[] = [
  {
    id: 'dave',
    name: 'Dave',
    avatar: '👨',
    affinityProfileJson: JSON.stringify({
      colors: { czerwony: 100 },
      ageGroup: { adult: 100 }
    }, null, 2),
  },
  {
    id: 'anna',
    name: 'Anna',
    avatar: '👩',
    affinityProfileJson: JSON.stringify({
      colors: { niebieski: 100 },
      ageGroup: { kids: 100 }
    }, null, 2),
  },
];

const PersonaContext = createContext<PersonaContextValue | null>(null);

export const PersonaProvider = ({ children }: { children: React.ReactNode }) => {
  const [personas, setPersonasState] = useState<Persona[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultPersonas;
    } catch { return defaultPersonas; }
  });

  const [activePersonaId, setActivePersonaIdState] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_KEY) ?? null;
  });

  const setPersonas = (next: Persona[]) => {
    setPersonasState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const setActivePersonaId = (id: string | null) => {
    setActivePersonaIdState(id);
    if (id === null) localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, id);
  };

  const activePersona = personas.find(p => p.id === activePersonaId) ?? null;

  return (
    <PersonaContext.Provider value={{ personas, activePersonaId, setActivePersonaId, setPersonas, activePersona }}>
      {children}
    </PersonaContext.Provider>
  );
};

export const usePersona = () => {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error('usePersona must be used within PersonaProvider');
  return ctx;
};
