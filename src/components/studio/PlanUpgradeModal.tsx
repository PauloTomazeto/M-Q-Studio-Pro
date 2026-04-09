import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Check, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PlanUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PlanUpgradeModal: React.FC<PlanUpgradeModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate('/pricing');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-neutral-100 rounded-full transition-colors z-10"
            >
              <X size={20} />
            </button>

            <div className="p-8 pt-12 text-center">
              <div className="w-20 h-20 bg-[#cfa697]/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Zap className="text-[#cfa697]" size={40} />
              </div>
              
              <h2 className="text-3xl font-bold mb-4 tracking-tight">Créditos <span className="text-[#cfa697]">Insuficientes</span></h2>
              <p className="text-neutral-500 mb-8 leading-relaxed">
                Você não possui créditos suficientes para esta operação. Faça o upgrade para um plano superior ou adquira um pacote de créditos avulsos.
              </p>

              <div className="bg-[#f2f2f2] rounded-3xl p-6 mb-8 text-left space-y-4">
                <p className="font-bold text-sm text-neutral-400 uppercase tracking-widest mb-2">Benefícios do Plano Pro:</p>
                {[
                  "1.000 créditos para geração",
                  "Imagens em resolução 4K",
                  "Geração de vídeos cinematográficos",
                  "Prioridade máxima no processamento",
                  "Suporte prioritário 24/7"
                ].map((benefit, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#cfa697] flex items-center justify-center text-white">
                      <Check size={12} />
                    </div>
                    <span className="text-sm font-semibold text-neutral-700">{benefit}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleUpgrade}
                className="w-full py-4 bg-[#cfa697] hover:bg-[#b88f80] text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-[#cfa697]/30 active:scale-95 flex items-center justify-center gap-2"
              >
                Ver Planos de Assinatura
                <ArrowRight size={20} />
              </button>
              
              <button
                onClick={onClose}
                className="mt-4 text-sm font-bold text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                Talvez mais tarde
              </button>
            </div>

            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#cfa697]/5 rounded-full blur-3xl" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PlanUpgradeModal;
