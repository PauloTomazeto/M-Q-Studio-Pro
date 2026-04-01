import React, { useMemo } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { Sparkles, Info, AlertTriangle, CheckCircle2, RotateCcw, Palette, Zap, Sun, Moon, Cloud, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const BLOOM_PRESETS: Record<string, any> = {
  studio_neutral: {
    name: 'Studio Neutral',
    description: 'Estúdio Profissional - Sutil e preciso',
    bloom_intensity: 10,
    bloom_threshold: 1.2,
    bloom_color_tint: '#ffffff',
    icon: Sun
  },
  natural_light: {
    name: 'Natural Light',
    description: 'Luz Natural - Brilho em vidros e metais',
    bloom_intensity: 15,
    bloom_threshold: 1.1,
    bloom_color_tint: '#ffffff',
    icon: Cloud
  },
  cinematic: {
    name: 'Cinematic',
    description: 'Cinematográfico - Impacto visual e halos',
    bloom_intensity: 40,
    bloom_threshold: 0.8,
    bloom_color_tint: '#ffffff',
    icon: Wand2
  },
  dramatic_sunset: {
    name: 'Dramatic Sunset',
    description: 'Pôr do Sol - Atmosfera quente e dourada',
    bloom_intensity: 50,
    bloom_threshold: 0.7,
    bloom_color_tint: '#ffaa33',
    icon: Sun
  },
  night_scene: {
    name: 'Night Scene',
    description: 'Cena Noturna - Pontos de luz artificiais',
    bloom_intensity: 30,
    bloom_threshold: 0.6,
    bloom_color_tint: '#ffddaa',
    icon: Moon
  },
  high_key: {
    name: 'High Key Bright',
    description: 'Muito Claro - Ambientes comerciais',
    bloom_intensity: 20,
    bloom_threshold: 1.3,
    bloom_color_tint: '#ffffff',
    icon: Zap
  },
  low_key: {
    name: 'Low Key Dramatic',
    description: 'Pouco Iluminado - Contraste forte',
    bloom_intensity: 60,
    bloom_threshold: 0.5,
    bloom_color_tint: '#ff6633',
    icon: Zap
  },
  overcast: {
    name: 'Overcast Day',
    description: 'Dia Nublado - Luz uniforme, bloom mínimo',
    bloom_intensity: 5,
    bloom_threshold: 1.5,
    bloom_color_tint: '#ffffff',
    icon: Cloud
  },
  immersive: {
    name: 'Immersive Wide',
    description: 'Imersivo - Impacto em bordas e halos',
    bloom_intensity: 35,
    bloom_threshold: 0.9,
    bloom_color_tint: '#ffffff',
    icon: Sparkles
  }
};

const BloomParametersPanel: React.FC = () => {
  const { configParams, updateConfig, scanResult, materials, cameraData } = useStudioStore();

  const handleParamChange = (name: string, value: any) => {
    let clampedValue = value;
    
    if (name === 'bloom_intensity') {
      clampedValue = Math.max(0, Math.min(100, value));
      if (clampedValue === 0) toast.info("Bloom desligado, efeito invisível");
      if (clampedValue > 80) toast.warning("Bloom muito intenso, pode parecer artificial");
    } else if (name === 'bloom_threshold') {
      clampedValue = Math.max(0, Math.min(2, value));
      clampedValue = Math.round(clampedValue * 10) / 10;
      if (clampedValue < 0.3) toast.warning("Muito bloom pode impactar performance");
    }

    updateConfig({ [name]: clampedValue });
  };

  const handlePresetChange = (id: string) => {
    const preset = BLOOM_PRESETS[id];
    if (preset) {
      updateConfig({
        bloom_intensity: preset.bloom_intensity,
        bloom_threshold: preset.bloom_threshold,
        bloom_color_tint: preset.bloom_color_tint
      });
      toast.success(`Preset "${preset.name}" aplicado`);
    }
  };

  const compatibilityWarnings = useMemo(() => {
    const warnings: string[] = [];
    const { bloom_intensity, bloom_threshold, bloom_color_tint, temperature, atmosphere_type } = configParams;

    // Intensity-Threshold Relationship
    if (bloom_intensity > 0) {
      if (bloom_intensity <= 10 && bloom_threshold < 1.0) {
        warnings.push('Intensidade baixa com threshold baixo: o efeito pode ser imperceptível ou ruidoso.');
      }
      if (bloom_intensity >= 70 && bloom_threshold > 1.0) {
        warnings.push('Intensidade alta com threshold alto: pode criar halos excessivamente seletivos e artificiais.');
      }
    }

    // Color Temperature Coherence
    if (temperature < 4000 && !bloom_color_tint.match(/#(ff|ee|dd)/i)) {
      warnings.push('Temperatura quente detectada: considere um tom de bloom amarelado ou alaranjado para coerência.');
    }

    // Atmosphere Coherence
    if (atmosphere_type === 'sunset' && bloom_intensity < 40) {
      warnings.push('Cena de Pôr do Sol: recomenda-se intensidade de bloom acima de 40% para capturar o brilho solar.');
    }
    if (atmosphere_type === 'night' && bloom_threshold > 1.0) {
      warnings.push('Cena Noturna: recomenda-se threshold abaixo de 1.0 para destacar luzes artificiais.');
    }

    // Camera Coherence
    if (cameraData?.focal_apparent) {
      if (cameraData.focal_apparent < 35 && bloom_threshold > 1.0) {
        warnings.push('Grande angular detectada: threshold menor que 1.0 ajuda a destacar o brilho em toda a cena.');
      }
    }

    // Material Coherence
    const hasGlossy = materials.some(m => ['gloss', 'espelhado'].includes(m.reflectancia));
    if (hasGlossy && bloom_intensity < 25) {
      warnings.push('Materiais brilhosos detectados: aumente a intensidade para destacar as reflexões.');
    }

    return warnings;
  }, [configParams, materials, cameraData]);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold">Efeitos de Luz (Bloom)</h3>
            <p className="text-xs text-neutral-500">Brilho radiante e halos de luz</p>
          </div>
        </div>
        
        <button 
          onClick={() => handleParamChange('bloom_intensity', 0)}
          className="p-2 text-neutral-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
          title="Resetar Bloom"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="p-8 grid lg:grid-cols-2 gap-12">
        {/* Presets Selection */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Presets de Bloom</h4>
          </div>

          <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(BLOOM_PRESETS).map(([id, preset]) => (
              <button
                key={id}
                onClick={() => handlePresetChange(id)}
                className={`group p-4 rounded-2xl border transition-all text-left flex items-center gap-4 ${
                  configParams.bloom_intensity === preset.bloom_intensity && configParams.bloom_threshold === preset.bloom_threshold
                    ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                    : "border-neutral-100 dark:border-neutral-800 hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                <div className={`p-3 rounded-xl transition-colors ${
                  configParams.bloom_intensity === preset.bloom_intensity && configParams.bloom_threshold === preset.bloom_threshold 
                    ? "bg-primary text-white" 
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-primary"
                }`}>
                  <preset.icon size={20} />
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${configParams.bloom_intensity === preset.bloom_intensity && configParams.bloom_threshold === preset.bloom_threshold ? "text-primary" : "text-neutral-700 dark:text-neutral-300"}`}>
                    {preset.name}
                  </p>
                  <p className="text-[10px] text-neutral-500 leading-tight">{preset.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Sliders Section */}
        <div className="space-y-8">
          <div className="space-y-6">
            {/* Bloom Intensity */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-neutral-400" />
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Intensidade do Bloom</label>
                </div>
                <span className="text-sm font-mono font-bold text-primary">{configParams.bloom_intensity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={configParams.bloom_intensity}
                onChange={(e) => handleParamChange('bloom_intensity', Number(e.target.value))}
                className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 font-medium px-1">
                <span>Desligado</span>
                <span>Sutil</span>
                <span>Moderado</span>
                <span>Forte</span>
                <span>Extremo</span>
              </div>
            </div>

            {/* Bloom Threshold */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-neutral-400" />
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Limiar (Threshold)</label>
                </div>
                <span className="text-sm font-mono font-bold text-primary">{configParams.bloom_threshold.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={configParams.bloom_threshold}
                onChange={(e) => handleParamChange('bloom_threshold', Number(e.target.value))}
                className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 font-medium px-1">
                <span>Tudo Brilha</span>
                <span>Padrão</span>
                <span>Apenas Brilho Extremo</span>
              </div>
            </div>

            {/* Bloom Color Tint */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Palette size={16} className="text-neutral-400" />
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Tom do Bloom (Tint)</label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-neutral-400 uppercase">{configParams.bloom_color_tint}</span>
                  <div 
                    className="w-6 h-6 rounded-full border border-neutral-200 shadow-sm" 
                    style={{ backgroundColor: configParams.bloom_color_tint }}
                  />
                </div>
              </div>
              <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                <input
                  type="color"
                  value={configParams.bloom_color_tint}
                  onChange={(e) => handleParamChange('bloom_color_tint', e.target.value)}
                  className="w-full h-10 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden"
                />
              </div>
            </div>
          </div>

          {/* Warnings Section */}
          <AnimatePresence mode="wait">
            {compatibilityWarnings.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-orange-500 shrink-0" size={18} />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-orange-800 dark:text-orange-400">Sugestões de Realismo</p>
                    <ul className="text-[10px] text-orange-700/80 dark:text-orange-400/70 space-y-1 list-disc list-inside leading-relaxed">
                      {compatibilityWarnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-2">
              <Info size={14} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Dica Técnica</span>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed italic">
              "O Bloom simula o transbordamento da luz em áreas de alto contraste. Use um Threshold alto (1.2+) para manter o efeito apenas em fontes de luz e metais polidos."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BloomParametersPanel;
