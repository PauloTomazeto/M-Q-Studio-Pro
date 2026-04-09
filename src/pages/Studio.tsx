import React, { useEffect } from 'react';
import { useStudioStore } from '../store/studioStore';
import ModeSelect from '../components/studio/ModeSelect';
import UploadStep from '../components/studio/UploadStep';
import DiagnosisStep from '../components/studio/DiagnosisStep';
import ConfigStep from '../components/studio/ConfigStep';
import ResultStep from '../components/studio/ResultStep';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, RotateCcw, Lock } from 'lucide-react';
import { useCredits } from '../hooks/useCredits';

const Studio: React.FC = () => {
  const { 
    currentStep, 
    setStep, 
    reset, 
    mode, 
    image, 
    scanResult, 
    isModeLocked,
    setAvailableModes 
  } = useStudioStore();
  const { userProfile } = useCredits();

  useEffect(() => {
    if (userProfile) {
      const modes: ('single' | 'blocks')[] = ['single'];
      if (userProfile.plan === 'premium' || userProfile.role === 'admin') {
        modes.push('blocks');
      }
      setAvailableModes(modes);
    }
  }, [userProfile, setAvailableModes]);

  useEffect(() => {
    if (!mode && currentStep !== 'select') {
      setStep('select');
    }
  }, [mode, currentStep, setStep]);

  const steps = [
    { id: 'select', label: 'Modo' },
    { id: 'upload', label: 'Upload' },
    { id: 'diagnosis', label: 'Diagnóstico' },
    { id: 'config', label: 'Configuração' },
    { id: 'result', label: 'Resultado' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const isStepDisabled = (index: number) => {
    if (isModeLocked) return true;
    if (index === 0) return false;
    if (index === 1) return !mode;
    if (index === 2) return !image;
    if (index === 3) return !scanResult;
    if (index === 4) return !scanResult;
    return true;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'select': return <ModeSelect />;
      case 'upload': return <UploadStep />;
      case 'diagnosis': return <DiagnosisStep />;
      case 'config': return <ConfigStep />;
      case 'result': return <ResultStep />;
      default: return <ModeSelect />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col gap-6">
        {currentStep === 'select' ? (
          <div className="text-center space-y-4 py-8">
            <h1 className="text-4xl font-bold tracking-tight">Escolha seu fluxo de trabalho</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-lg max-w-2xl mx-auto">
              Selecione o modo que melhor se adapta ao seu projeto atual.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
              {steps.map((step, i) => {
                const disabled = isStepDisabled(i);
                return (
                  <React.Fragment key={step.id}>
                    <button 
                      onClick={() => !disabled && setStep(step.id as any)}
                      disabled={disabled}
                      className={`flex items-center gap-2 flex-shrink-0 group outline-none transition-all relative ${
                        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                        i <= currentStepIndex 
                          ? "bg-primary text-white group-hover:shadow-primary/20" 
                          : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                      } ${i === currentStepIndex ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-neutral-950" : ""}`}>
                        {disabled && isModeLocked ? <Lock size={12} /> : i + 1}
                      </div>
                      <span className={`text-sm font-bold whitespace-nowrap transition-colors ${
                        i === currentStepIndex ? "text-primary" : "text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300"
                      }`}>
                        {step.label}
                      </span>
                    </button>
                    {i < steps.length - 1 && (
                      <div className={`w-8 h-[2px] flex-shrink-0 ${
                        i < currentStepIndex ? "bg-primary" : "bg-neutral-200 dark:bg-neutral-800"
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            
            <button 
              onClick={reset}
              className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              title="Reiniciar Sessão"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        )}
      </div>

      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Studio;
