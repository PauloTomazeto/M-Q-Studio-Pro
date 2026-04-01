import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Lightbulb, Zap, Info } from 'lucide-react';
import { LightPoint } from '../../types/studio';
import { LightPointCard } from './LightPointCard';
import { LightPointEditor } from './LightPointEditor';
import { useStudioStore } from '../../store/studioStore';
import { createBlankLightPoint } from '../../utils/lightingUtils';

interface LightPointGridProps {
  lights: LightPoint[];
  imageUrl: string;
}

export const LightPointGrid: React.FC<LightPointGridProps> = ({ lights, imageUrl }) => {
  const [editingLight, setEditingLight] = useState<LightPoint | null>(null);
  const { addLightPoint } = useStudioStore();

  const handleAddLight = () => {
    const newLight = createBlankLightPoint();
    addLightPoint(newLight);
    setEditingLight(newLight);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Pontos de Luz Individuais</h2>
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Catálogo V-Ray</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
          <Info className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{lights.length} Pontos Detectados</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {lights.map((light) => (
            <LightPointCard
              key={light.id}
              light={light}
              onEdit={() => setEditingLight(light)}
            />
          ))}

          {/* Add Light Point Card */}
          <motion.button
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4, borderColor: 'rgba(249, 115, 22, 0.5)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddLight}
            className="group relative flex flex-col items-center justify-center gap-4 p-8 bg-black/20 border-2 border-dashed border-white/10 rounded-2xl hover:bg-orange-500/5 transition-all min-h-[200px]"
          >
            <div className="p-4 bg-white/5 rounded-full group-hover:bg-orange-500/20 group-hover:scale-110 transition-all duration-300">
              <Plus className="w-8 h-8 text-white/20 group-hover:text-orange-400" />
            </div>
            <div className="text-center">
              <span className="block text-sm font-bold text-white/40 group-hover:text-orange-400 transition-colors">Adicionar Ponto de Luz</span>
              <span className="text-[10px] text-white/20 uppercase tracking-widest font-mono">Configuração Manual</span>
            </div>
          </motion.button>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {editingLight && (
          <LightPointEditor
            light={editingLight}
            imageUrl={imageUrl}
            onClose={() => setEditingLight(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
