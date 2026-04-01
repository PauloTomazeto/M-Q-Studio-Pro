
import React, { useState } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { ImageType, IMAGE_TYPE_LABELS, IMAGE_TYPE_DESCRIPTIONS } from '../../types/studio';
import { X, CheckCircle2, Info, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TypeOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TypeOverrideModal: React.FC<TypeOverrideModalProps> = ({ isOpen, onClose }) => {
  const { typeMetadata, setImageType } = useStudioStore();
  const [selectedType, setSelectedType] = useState<ImageType | null>(typeMetadata?.imageType || null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedType) {
      setImageType(selectedType, 'manual_override', 100);
      onClose();
    }
  };

  const types: ImageType[] = ['PLANTA_BAIXA', 'PERSPECTIVA', 'FACHADA', 'CORTE', 'ELEVAÇÃO', 'DETALHE', '3D_MOCK'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
      >
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Alterar Tipo de Imagem</h3>
            <p className="text-sm text-neutral-500">Ajuste o tipo para otimizar os parâmetros de análise e geração.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 gap-4">
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left group",
                  selectedType === type 
                    ? "border-primary bg-primary/5 ring-4 ring-primary/10" 
                    : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  selectedType === type ? "bg-primary text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-neutral-600"
                )}>
                  {selectedType === type ? <CheckCircle2 size={24} /> : <div className="w-2 h-2 rounded-full bg-current" />}
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "font-bold text-lg",
                    selectedType === type ? "text-primary" : "text-neutral-900 dark:text-white"
                  )}>
                    {IMAGE_TYPE_LABELS[type]}
                  </p>
                  <p className="text-sm text-neutral-500">{IMAGE_TYPE_DESCRIPTIONS[type]}</p>
                </div>
                {selectedType === type && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <ArrowRight className="text-primary" />
                  </motion.div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8 bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-neutral-500 max-w-[60%]">
            <Info size={16} className="shrink-0" />
            <p>Ao alterar o tipo, os parâmetros de câmera, luz e modo de análise serão reajustados automaticamente.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedType}
              className="px-8 py-3 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95 disabled:opacity-50"
            >
              Confirmar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TypeOverrideModal;
