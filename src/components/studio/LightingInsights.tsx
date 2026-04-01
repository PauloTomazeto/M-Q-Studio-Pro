import React from 'react';
import { motion } from 'motion/react';
import { Zap, Target, Shield, AlertCircle, Info } from 'lucide-react';
import { LightingMetrics } from '../../types/studio';

interface LightingInsightsProps {
  metrics: LightingMetrics;
}

export const LightingInsights: React.FC<LightingInsightsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Realism Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#151619] border border-white/10 rounded-2xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 bg-orange-500/10 blur-2xl rounded-full" />
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Shield className="w-5 h-5 text-orange-400" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Realismo Físico</h3>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-white tracking-tighter">{metrics.realism_score}%</span>
          <span className="text-xs text-white/40 font-medium mb-1.5 uppercase tracking-widest">Score</span>
        </div>
        <div className="mt-4 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${metrics.realism_score}%` }}
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
          />
        </div>
      </motion.div>

      {/* Compatibility */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#151619] border border-white/10 rounded-2xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 bg-blue-500/10 blur-2xl rounded-full" />
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Target className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Compatibilidade PBR</h3>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-white tracking-tighter">{metrics.compatibility_with_materials}%</span>
          <span className="text-xs text-white/40 font-medium mb-1.5 uppercase tracking-widest">Match</span>
        </div>
        <div className="mt-4 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${metrics.compatibility_with_materials}%` }}
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
          />
        </div>
      </motion.div>

      {/* Shadow Quality */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#151619] border border-white/10 rounded-2xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 bg-purple-500/10 blur-2xl rounded-full" />
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Qualidade de Sombra</h3>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-white tracking-tighter uppercase">{metrics.shadow_quality}</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${metrics.shadow_quality === 'soft' ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Ray-Tracing Ativo</span>
        </div>
      </motion.div>

      {/* Lighting Quality */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[#151619] border border-white/10 rounded-2xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 bg-green-500/10 blur-2xl rounded-full" />
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Avaliação Geral</h3>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-white tracking-tighter uppercase">{metrics.overall_lighting_quality}</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-white/20" />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Pronto para Render</span>
        </div>
      </motion.div>
    </div>
  );
};
