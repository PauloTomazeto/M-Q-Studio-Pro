import React from 'react';
import { motion } from 'motion/react';
import { Sun, Moon, Cloud, Zap, Thermometer, Compass, Maximize2, Info, CheckCircle2 } from 'lucide-react';
import { AmbientLight, LightPeriod, AzimuthDirection, LightQuality } from '../../types/studio';
import { useStudioStore } from '../../store/studioStore';

interface AmbientLightCardProps {
  light: AmbientLight;
}

const periodLabels: Record<LightPeriod, string> = {
  golden_hour: 'Hora Dourada',
  morning: 'Manhã',
  afternoon: 'Tarde',
  late_afternoon: 'Final da Tarde',
  evening: 'Anoitecer',
  night: 'Noite',
  blue_hour: 'Hora Azul',
  overcast: 'Nublado',
  indoor_artificial: 'Artificial Interno'
};

const qualityLabels: Record<LightQuality, string> = {
  hard: 'Dura',
  soft: 'Suave',
  diffuse: 'Difusa',
  volumetric: 'Volumétrica'
};

export const AmbientLightCard: React.FC<AmbientLightCardProps> = ({ light }) => {
  const { setAmbientLight } = useStudioStore();

  const handleUpdate = (updates: Partial<AmbientLight>) => {
    setAmbientLight({ ...light, ...updates });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#151619] border border-white/10 rounded-2xl overflow-hidden shadow-xl"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Sun className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Luz Ambiente</h2>
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Configuração Global</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">{light.confidence}% Confiança</span>
        </div>
      </div>

      <div className="p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Period Selection */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Sun className="w-3.5 h-3.5" /> Período do Dia
            </label>
            <select
              value={light.period}
              onChange={(e) => handleUpdate({ period: e.target.value as LightPeriod })}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
            >
              {Object.entries(periodLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Thermometer className="w-3.5 h-3.5" /> Temperatura de Cor
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="2700"
                max="8000"
                step="100"
                value={light.temp_k}
                onChange={(e) => handleUpdate({ temp_k: parseInt(e.target.value) })}
                className="flex-1 accent-orange-500"
              />
              <span className="text-sm font-mono text-white w-16">{light.temp_k}K</span>
            </div>
          </div>

          {/* Direction */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Compass className="w-3.5 h-3.5" /> Direção (Azimute)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((dir) => (
                <button
                  key={dir}
                  onClick={() => handleUpdate({ azimuthal_direction: dir as AzimuthDirection })}
                  className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
                    light.azimuthal_direction === dir
                      ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                      : 'bg-black/30 border-white/5 text-white/40 hover:border-white/20'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-8 border-t border-white/5">
          {/* Quality */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5" /> Qualidade da Luz
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(qualityLabels).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => handleUpdate({ quality: value as LightQuality })}
                  className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                    light.quality === value
                      ? 'bg-orange-500/10 border-orange-500/50 text-orange-400'
                      : 'bg-black/30 border-white/5 text-white/40 hover:border-white/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Indirect Ratio */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Maximize2 className="w-3.5 h-3.5" /> Razão de Luz Indireta
            </label>
            <input
              type="text"
              value={light.indirect_ratio}
              onChange={(e) => handleUpdate({ indirect_ratio: e.target.value })}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
              placeholder="Ex: 2:1, 1:1..."
            />
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" /> Efeitos Globais
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => handleUpdate({ bloom_glare: !light.bloom_glare })}
                className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  light.bloom_glare
                    ? 'bg-orange-500/10 border-orange-500/50 text-orange-400'
                    : 'bg-black/30 border-white/5 text-white/40'
                }`}
              >
                Bloom & Glare
              </button>
              <button
                onClick={() => handleUpdate({ has_shadow_direction: !light.has_shadow_direction })}
                className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  light.has_shadow_direction
                    ? 'bg-orange-500/10 border-orange-500/50 text-orange-400'
                    : 'bg-black/30 border-white/5 text-white/40'
                }`}
              >
                Sombra Direcional
              </button>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="pt-8 border-t border-white/5">
          <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2 mb-4">
            <Info className="w-3.5 h-3.5" /> Descrição da Mistura de Luzes
          </label>
          <textarea
            value={light.light_mixing_description}
            onChange={(e) => handleUpdate({ light_mixing_description: e.target.value })}
            className="w-full bg-black/30 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors min-h-[100px] text-sm leading-relaxed"
            placeholder="Descreva como as fontes de luz interagem no ambiente..."
          />
        </div>
      </div>
    </motion.div>
  );
};
