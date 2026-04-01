
import React, { useState } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { IMAGE_TYPE_LABELS } from '../../types/studio';
import { ShieldCheck, AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import TypeOverrideModal from './TypeOverrideModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TypeBadge: React.FC = () => {
  const { typeMetadata } = useStudioStore();
  const [showModal, setShowModal] = useState(false);

  if (!typeMetadata) return null;

  const { imageType, confidence, isAmbiguous, source } = typeMetadata;

  const getConfidenceColor = (score: number) => {
    if (score >= 75) return 'text-green-600 bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800/30';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-800/30';
    if (score >= 30) return 'text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800/30';
    return 'text-red-600 bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800/30';
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-bold transition-all hover:scale-105 active:scale-95",
              getConfidenceColor(confidence)
            )}
          >
            {confidence >= 75 ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
            {IMAGE_TYPE_LABELS[imageType]}
            <ChevronDown size={14} className="ml-1 opacity-50" />
          </button>
          
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <span className={cn(
              "w-2 h-2 rounded-full",
              confidence >= 75 ? "bg-green-500" : confidence >= 50 ? "bg-yellow-500" : "bg-red-500"
            )} />
            {confidence}% confiança
          </div>
        </div>

        <AnimatePresence>
          {isAmbiguous && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800/30 p-3 rounded-xl flex gap-3"
            >
              <Info className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-700 dark:text-yellow-500">
                <p className="font-bold mb-1">Detecção Ambígua</p>
                <p>O sistema detectou este tipo com baixa confiança. Verifique se está correto ou altere manualmente.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TypeOverrideModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};

export default TypeBadge;
