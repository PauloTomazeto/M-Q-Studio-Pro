import React from 'react';
import { useStudioStore } from '../../store/studioStore';
import { useCredits } from '../../hooks/useCredits';
import { Palette, Video, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const ModeSelect: React.FC = () => {
  const { setMode, setStep } = useStudioStore();
  const { userProfile, logModeSelection } = useCredits();

  const handleSelect = async (mode: 'prompt' | 'move') => {
    setMode(mode);
    await logModeSelection(mode);
    setStep('upload');
  };

  const getSuggestion = () => {
    if (!userProfile?.modeHistory || userProfile.modeHistory.length === 0) return null;
    
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    const recentHistory = userProfile.modeHistory.filter((h: any) => new Date(h.timestamp) > last7Days);
    const promptCount = recentHistory.filter((h: any) => h.mode === 'prompt').length;
    const moveCount = recentHistory.filter((h: any) => h.mode === 'move').length;
    
    if (promptCount > moveCount) {
      return `Com base no histórico, você usou Prompt ${promptCount}x nos últimos 7 dias`;
    } else if (moveCount > promptCount) {
      return `Com base no histórico, você usou Move ${moveCount}x nos últimos 7 dias`;
    }
    return null;
  };

  const suggestion = getSuggestion();

  return (
    <div className="space-y-8">
      {suggestion && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/10 border border-primary/20 p-4 rounded-2xl flex items-center gap-3 text-primary"
        >
          <Sparkles size={20} />
          <p className="text-sm font-medium">{suggestion}</p>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleSelect('prompt')}
          className="group bg-white dark:bg-neutral-900 p-8 rounded-3xl border-2 border-transparent hover:border-primary transition-all text-left shadow-sm hover:shadow-xl hover:shadow-primary/5"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
            <Palette size={32} />
          </div>
          <h3 className="text-2xl font-bold mb-2">Modo Prompt</h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
            Gere prompts técnicos detalhados para renderização arquitetural de alta fidelidade. Ideal para Midjourney e Stable Diffusion.
          </p>
          <div className="flex items-center gap-2 text-primary font-bold">
            Selecionar
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleSelect('move')}
          className="group bg-white dark:bg-neutral-900 p-8 rounded-3xl border-2 border-transparent hover:border-secondary transition-all text-left shadow-sm hover:shadow-xl hover:shadow-secondary/5"
        >
          <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary mb-6 group-hover:scale-110 transition-transform">
            <Video size={32} />
          </div>
          <h3 className="text-2xl font-bold mb-2">Modo Move</h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
            Crie animações e sequências de vídeo a partir de suas imagens. Controle câmera, velocidade e dinâmica visual.
          </p>
          <div className="flex items-center gap-2 text-secondary font-bold">
            Selecionar
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>
      </div>
    </div>
  );
};

export default ModeSelect;
