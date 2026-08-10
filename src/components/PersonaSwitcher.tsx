import { useState, useRef } from 'react';
import { usePersona, Persona } from '../context/PersonaContext';
import { Settings, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PersonaSwitcherProps {
  onOpenSettings: () => void;
}

export const PersonaSwitcher = ({ onOpenSettings }: PersonaSwitcherProps) => {
  const { personas, activePersonaId, setActivePersonaId, setPersonas } = usePersona();
  const [open, setOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isNew, setIsNew] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 300);
  };

  const startEdit = (persona: Persona) => {
    setEditingPersona({ ...persona });
    setIsNew(false);
  };

  const startAdd = () => {
    setEditingPersona({
      id: `persona_${Date.now()}`,
      name: '',
      avatar: '🙂',
      affinityProfileJson: '{\n  \n}',
    });
    setIsNew(true);
  };

  const saveEdit = () => {
    if (!editingPersona) return;
    if (isNew) {
      setPersonas([...personas, editingPersona]);
    } else {
      setPersonas(personas.map(p => p.id === editingPersona.id ? editingPersona : p));
    }
    setEditingPersona(null);
  };

  const deletePersona = (id: string) => {
    setPersonas(personas.filter(p => p.id !== id));
    if (activePersonaId === id) setActivePersonaId(null);
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Persona list (shown on hover) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex flex-col gap-1 min-w-[200px]"
          >
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 pb-1">Active Persona</p>

            {/* None option */}
            <PersonaRow
              label="None"
              sublabel="Use config defaults"
              avatar="⚙️"
              selected={activePersonaId === null}
              onSelect={() => setActivePersonaId(null)}
            />

            {/* Persona rows */}
            {personas.map(p => (
              <PersonaRow
                key={p.id}
                label={p.name}
                sublabel={summariseAffinity(p.affinityProfileJson)}
                avatar={p.avatar}
                selected={activePersonaId === p.id}
                onSelect={() => setActivePersonaId(p.id)}
                onEdit={() => startEdit(p)}
                onDelete={() => deletePersona(p.id)}
              />
            ))}

            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={startAdd}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <Plus size={13} /> Add persona
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <div className="flex items-center gap-2">
        {/* Active persona bubble */}
        <AnimatePresence>
          {activePersonaId !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-white rounded-full shadow-md border border-gray-200 px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-gray-700"
            >
              <span>{personas.find(p => p.id === activePersonaId)?.avatar}</span>
              <span>{personas.find(p => p.id === activePersonaId)?.name}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings FAB */}
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 bg-black text-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all"
          aria-label="Open settings"
          title="Configure Dynamic Yield API"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Edit / Add modal */}
      <AnimatePresence>
        {editingPersona && (
          <PersonaEditModal
            persona={editingPersona}
            isNew={isNew}
            onChange={setEditingPersona}
            onSave={saveEdit}
            onCancel={() => setEditingPersona(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const PersonaRow = ({
  label, sublabel, avatar, selected, onSelect, onEdit, onDelete,
}: {
  label: string; sublabel?: string; avatar: string;
  selected: boolean;
  onSelect: () => void; onEdit?: () => void; onDelete?: () => void;
}) => (
  <div
    className={`flex items-center gap-2 px-2 py-1.5 rounded-xl cursor-pointer group transition-colors ${selected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
    onClick={onSelect}
  >
    <span className="text-lg w-7 text-center">{avatar}</span>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium truncate ${selected ? 'text-indigo-700' : 'text-gray-800'}`}>{label}</p>
      {sublabel && <p className="text-[10px] text-gray-400 truncate">{sublabel}</p>}
    </div>
    {selected && <Check size={13} className="text-indigo-500 shrink-0" />}
    {onEdit && (
      <button
        onClick={e => { e.stopPropagation(); onEdit(); }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-all"
      >
        <Pencil size={11} className="text-gray-500" />
      </button>
    )}
    {onDelete && (
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 transition-all"
      >
        <Trash2 size={11} className="text-red-400" />
      </button>
    )}
  </div>
);

const PersonaEditModal = ({
  persona, isNew, onChange, onSave, onCancel,
}: {
  persona: Persona; isNew: boolean;
  onChange: (p: Persona) => void;
  onSave: () => void; onCancel: () => void;
}) => {
  const [jsonError, setJsonError] = useState<string | null>(null);

  const validateAndSave = () => {
    try {
      JSON.parse(persona.affinityProfileJson);
      setJsonError(null);
      onSave();
    } catch {
      setJsonError('Invalid JSON');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{isNew ? 'Add Persona' : 'Edit Persona'}</h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Avatar</label>
            <input
              type="text"
              value={persona.avatar}
              onChange={e => onChange({ ...persona, avatar: e.target.value })}
              className="w-16 text-center text-2xl border border-gray-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="🙂"
              maxLength={4}
            />
            <p className="text-[9px] text-gray-400 mt-1 text-center">emoji or URL</p>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
            <input
              type="text"
              value={persona.name}
              onChange={e => onChange({ ...persona, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Dave"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-600">Affinity Profile JSON</label>
            {jsonError && <span className="text-xs text-red-500">{jsonError}</span>}
          </div>
          <textarea
            value={persona.affinityProfileJson}
            onChange={e => onChange({ ...persona, affinityProfileJson: e.target.value })}
            rows={8}
            className={`w-full border rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y ${jsonError ? 'border-red-300' : 'border-gray-200'}`}
            spellCheck={false}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Sent as <code className="bg-gray-100 px-1 rounded">affinityProfile</code> in the DY search request.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={validateAndSave}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            {isNew ? 'Add' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

function summariseAffinity(json: string): string {
  try {
    const obj = JSON.parse(json);
    const parts = Object.entries(obj).flatMap(([, v]) =>
      typeof v === 'object' && v !== null
        ? Object.keys(v as object).slice(0, 2)
        : []
    );
    return parts.slice(0, 3).join(', ') || '—';
  } catch { return '—'; }
}
