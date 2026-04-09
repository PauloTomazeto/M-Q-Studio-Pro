import React from 'react';
import { motion } from 'framer-motion';
import { Palette, Video, ArrowRight, Sparkles } from 'lucide-react';
import { useStudioStore, StudioMode } from '../../store/studioStore';
import { useCredits } from '../../hooks/useCredits';
import { useNavigate } from 'react-router-dom';

interface ModeSelectionProps {
  onSelect?: (mode: StudioMode) => void;
}

const ModeSelection: React.FC<ModeSelectionProps> = ({ onSelect }) => {
  const { setMode, setStep } = useStudioStore();
  const { userProfile, logModeSelection } = useCredits();
  const navigate = useNavigate();

  const handleSelect = async (mode: StudioMode) => {
    setMode(mode);
    await logModeSelection(mode);
    if (onSelect) {
      onSelect(mode);
    } else {
      setStep('upload');
      navigate('/studio');
    }
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
      return `Com base no histórico, você usou Mov ${moveCount}x nos últimos 7 dias`;
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

      <div className="grid md:grid-cols-2 gap-8">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleSelect('prompt')}
          className="group bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border-2 border-transparent hover:border-primary transition-all text-left shadow-sm hover:shadow-2xl hover:shadow-primary/5 flex flex-col h-full"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-8 group-hover:scale-110 transition-transform">
            <Palette size={40} />
          </div>
          <h3 className="text-3xl font-bold mb-4">Modo Prompt</h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed flex-1 text-lg">
            Gere prompts técnicos detalhados para renderização arquitetural de alta fidelidade. 
            Análise completa de materiais, iluminação e composição.
          </p>
          <ul className="space-y-3 mb-10 text-sm text-neutral-600 dark:text-neutral-400">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Análise inteligente de materiais PBR
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Configuração V-Ray avançada
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Otimizado para Midjourney
            </li>
          </ul>
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            Selecionar
            <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleSelect('move')}
          className="group bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border-2 border-transparent hover:border-secondary transition-all text-left shadow-sm hover:shadow-2xl hover:shadow-secondary/5 flex flex-col h-full"
        >
          <div className="w-20 h-20 bg-secondary/10 rounded-3xl flex items-center justify-center text-secondary mb-8 group-hover:scale-110 transition-transform">
            <Video size={40} />
          </div>
          <h3 className="text-3xl font-bold mb-4">Modo Move</h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed flex-1 text-lg">
            Crie animações e sequências de vídeo a partir de suas imagens. 
            Controle total de câmera, velocidade e dinâmica visual.
          </p>
          <ul className="space-y-3 mb-10 text-sm text-neutral-600 dark:text-neutral-400">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
              Análise de mobilidade de elementos
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
              Editor de path de câmera 3D
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
              Geração de vídeo via Kling 2.5
            </li>
          </ul>
          <div className="flex items-center gap-2 text-secondary font-bold text-lg">
            Selecionar
            <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
          </div>
        </motion.button>
      </div>
    </div>
  );
};

export default ModeSelection;
