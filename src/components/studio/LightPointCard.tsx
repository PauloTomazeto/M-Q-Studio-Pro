import React from 'react';
import { motion } from 'motion/react';
import { Lightbulb, Thermometer, Zap, Target, Eye, EyeOff, Edit3, Trash2 } from 'lucide-react';
import { LightPoint } from '../../types/studio';
import { kelvinToColor } from '../../utils/lightingUtils';
import { useStudioStore } from '../../store/studioStore';

interface LightPointCardProps {
  light: LightPoint;
  onEdit: () => void;
}

export const LightPointCard: React.FC<LightPointCardProps> = ({ light, onEdit }) => {
  const { deleteLightPoint } = useStudioStore();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Excluir este ponto de luz?')) {
      deleteLightPoint(light.id);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      onClick={onEdit}
      className="group relative bg-[#151619] border border-white/10 rounded-2xl overflow-hidden cursor-pointer hover:border-orange-500/30 transition-all shadow-lg"
    >
      {/* Visual Indicator Background */}
      <div 
        className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 opacity-10 blur-3xl rounded-full"
        style={{ backgroundColor: light.color_hex }}
      />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${
              light.user_added ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-white/60 group-hover:text-orange-400'
            }`}>
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors line-clamp-1">
                {light.location_description || 'Ponto de Luz'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">{light.type}</span>
                {light.user_added && (
                  <span className="text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded border border-orange-500/20 font-bold uppercase tracking-tighter">Manual</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={handleDelete}
              className="p-1.5 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button className="p-1.5 hover:bg-white/10 text-white/20 hover:text-white rounded-lg transition-colors">
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/30 rounded-xl p-2.5 border border-white/5 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-1">
              <Zap className="w-3 h-3" /> Intensidade
            </span>
            <span className="text-sm font-mono text-white">{light.intensity_initial}%</span>
          </div>
          <div className="bg-black/30 rounded-xl p-2.5 border border-white/5 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-1">
              <Thermometer className="w-3 h-3" /> Temperatura
            </span>
            <span className={`text-sm font-mono ${kelvinToColor(light.temp_k_initial)}`}>
              {light.temp_k_initial}K
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-white/30" />
              <span className="text-[10px] font-mono text-white/40">
                {Math.round(light.spatial_x_pct)}%, {Math.round(light.spatial_y_pct)}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {light.visible_in_render ? (
              <Eye className="w-3.5 h-3.5 text-green-500/50" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-white/20" />
            )}
            <div 
              className="w-3 h-3 rounded-full border border-white/20 shadow-sm"
              style={{ backgroundColor: light.color_hex }}
            />
          </div>
        </div>
      </div>

      {/* Progress Bar for Confidence */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${light.confidence}%` }}
          className={`h-full ${light.confidence > 80 ? 'bg-green-500/50' : 'bg-yellow-500/50'}`}
        />
      </div>
    </motion.div>
  );
};
