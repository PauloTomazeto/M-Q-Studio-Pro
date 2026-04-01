import React, { useState } from 'react';
import { useStudioStore, StudioMode } from '../../store/studioStore';
import { useCredits } from '../../hooks/useCredits';
import { Palette, Video, ChevronDown, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const ModeSwitcher: React.FC = () => {
  const { mode, setMode, setStep, reset } = useStudioStore();
  const { logModeSelection } = useCredits();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<StudioMode | null>(null);
  const navigate = useNavigate();

  const handleModeChange = (newMode: StudioMode) => {
    if (newMode === mode) {
      setIsOpen(false);
      return;
    }
    setPendingMode(newMode);
    setIsOpen(false);
  };

  const confirmChange = async () => {
    if (pendingMode) {
      setMode(pendingMode);
      await logModeSelection(pendingMode);
      reset(); // Reset studio state as per PRD
      setStep('upload');
      navigate('/studio');
      setPendingMode(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all border border-neutral-200 dark:border-neutral-700"
      >
        {mode === 'prompt' ? (
          <Palette size={16} className="text-primary" />
        ) : (
          <Video size={16} className="text-secondary" />
        )}
        <span className="text-sm font-bold capitalize">{mode || 'Selecionar Modo'}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl z-50 overflow-hidden"
            >
              <div className="p-2">
                <button
                  onClick={() => handleModeChange('prompt')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    mode === 'prompt' 
                      ? "bg-primary/10 text-primary" 
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <Palette size={18} />
                  <div className="text-left">
                    <p className="text-sm font-bold">Modo Prompt</p>
                    <p className="text-[10px] opacity-60">Renderização estática</p>
                  </div>
                </button>
                <button
                  onClick={() => handleModeChange('move')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mt-1 ${
                    mode === 'move' 
                      ? "bg-secondary/10 text-secondary" 
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <Video size={18} />
                  <div className="text-left">
                    <p className="text-sm font-bold">Modo Move</p>
                    <p className="text-[10px] opacity-60">Animação e vídeo</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}

        {pendingMode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-neutral-900 max-w-sm w-full p-8 rounded-[2rem] shadow-2xl border border-neutral-200 dark:border-neutral-800 text-center"
            >
              <div className="w-16 h-16 bg-warning/10 rounded-2xl flex items-center justify-center text-warning mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Alterar Modo?</h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
                Você será redirecionado para o início do fluxo do novo modo. O progresso atual da sessão será reiniciado.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmChange}
                  className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-dark transition-all"
                >
                  Confirmar Mudança
                </button>
                <button
                  onClick={() => setPendingMode(null)}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-bold py-3 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModeSwitcher;
