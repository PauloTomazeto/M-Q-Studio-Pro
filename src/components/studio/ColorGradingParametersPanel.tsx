import React, { useEffect, useState, useMemo } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { 
  Palette, 
  Sparkles, 
  Info, 
  AlertTriangle, 
  RotateCcw, 
  CheckCircle2,
  Zap,
  Film,
  Sun,
  Moon,
  Cloud,
  Camera,
  Wind
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ColorGradingPreset {
  id: string;
  name: string;
  description: string;
  icon: any;
  params: {
    saturation: number;
    contrast: number;
    vibrance: number;
    hue_shift: number;
    shadows_black_point: number;
    highlights_white_point: number;
    color_grading_config?: {
      mode: string;
      lut_applied: boolean;
      colorspace: string;
      tone_curve_preset: string;
    };
  };
}

const COLOR_GRADING_PRESETS: ColorGradingPreset[] = [
  {
    id: 'cinematic',
    name: 'Cinematográfico',
    description: 'Renders dramáticos, filmes. Cores dessaturadas, contraste forte.',
    icon: Film,
    params: {
      saturation: -15,
      contrast: 20,
      vibrance: 10,
      hue_shift: 5,
      shadows_black_point: -20,
      highlights_white_point: -10,
      color_grading_config: {
        mode: 'cinematic',
        lut_applied: true,
        colorspace: 'srgb',
        tone_curve_preset: 'log'
      }
    }
  },
  {
    id: 'warm_vintage',
    name: 'Vintage Quente',
    description: 'Nostálgico, retro. Tons quentes, levemente desbotado.',
    icon: Zap,
    params: {
      saturation: 20,
      contrast: 10,
      vibrance: 15,
      hue_shift: 15,
      shadows_black_point: 10,
      highlights_white_point: -5,
      color_grading_config: {
        mode: 'vintage',
        lut_applied: true,
        colorspace: 'srgb',
        tone_curve_preset: 'standard'
      }
    }
  },
  {
    id: 'cool_modern',
    name: 'Moderno Frio',
    description: 'Tech, corporativo. Tons azulados, vibrante, limpo.',
    icon: Camera,
    params: {
      saturation: 25,
      contrast: 15,
      vibrance: 20,
      hue_shift: -20,
      shadows_black_point: -15,
      highlights_white_point: 10,
      color_grading_config: {
        mode: 'modern',
        lut_applied: false,
        colorspace: 'srgb',
        tone_curve_preset: 'standard'
      }
    }
  },
  {
    id: 'high_key',
    name: 'Muito Claro',
    description: 'Comercial, varejo. Claro, pouco contraste, luminoso.',
    icon: Sun,
    params: {
      saturation: 10,
      contrast: -20,
      vibrance: 5,
      hue_shift: 0,
      shadows_black_point: 30,
      highlights_white_point: 20,
      color_grading_config: {
        mode: 'high_key',
        lut_applied: false,
        colorspace: 'srgb',
        tone_curve_preset: 'bright'
      }
    }
  },
  {
    id: 'low_key',
    name: 'Muito Escuro',
    description: 'Dramático, thriller. Muito escuro, muito contrastado.',
    icon: Moon,
    params: {
      saturation: -20,
      contrast: 40,
      vibrance: 30,
      hue_shift: -10,
      shadows_black_point: -50,
      highlights_white_point: -30,
      color_grading_config: {
        mode: 'low_key',
        lut_applied: true,
        colorspace: 'srgb',
        tone_curve_preset: 'dark'
      }
    }
  },
  {
    id: 'natural',
    name: 'Natural',
    description: 'Realista, profissional. Cores naturais, leve melhoria.',
    icon: Cloud,
    params: {
      saturation: 5,
      contrast: 10,
      vibrance: 0,
      hue_shift: 0,
      shadows_black_point: -5,
      highlights_white_point: 0,
      color_grading_config: {
        mode: 'natural',
        lut_applied: false,
        colorspace: 'srgb',
        tone_curve_preset: 'standard'
      }
    }
  },
  {
    id: 'golden_hour',
    name: 'Hora Dourada',
    description: 'Imobiliário, lifestyle. Muito quente, dourado.',
    icon: Sun,
    params: {
      saturation: 30,
      contrast: 15,
      vibrance: 25,
      hue_shift: 25,
      shadows_black_point: 0,
      highlights_white_point: -15,
      color_grading_config: {
        mode: 'golden',
        lut_applied: true,
        colorspace: 'srgb',
        tone_curve_preset: 'standard'
      }
    }
  },
  {
    id: 'moody_blue',
    name: 'Azul Melancólico',
    description: 'Noturno, introspectivo. Muito azul, sombras profundas.',
    icon: Wind,
    params: {
      saturation: 15,
      contrast: 25,
      vibrance: 10,
      hue_shift: -40,
      shadows_black_point: -30,
      highlights_white_point: -10,
      color_grading_config: {
        mode: 'moody',
        lut_applied: true,
        colorspace: 'srgb',
        tone_curve_preset: 'standard'
      }
    }
  },
  {
    id: 'pastel',
    name: 'Suave Pastel',
    description: 'Delicado, suave. Cores claras, pouco contrastado.',
    icon: Palette,
    params: {
      saturation: -25,
      contrast: -15,
      vibrance: 20,
      hue_shift: 10,
      shadows_black_point: 20,
      highlights_white_point: 15,
      color_grading_config: {
        mode: 'pastel',
        lut_applied: false,
        colorspace: 'srgb',
        tone_curve_preset: 'standard'
      }
    }
  },
  {
    id: 'bw_noir',
    name: 'Preto e Branco',
    description: 'Clássico, elegante. P&B, muito contrastado.',
    icon: Film,
    params: {
      saturation: -100,
      contrast: 35,
      vibrance: 0,
      hue_shift: 0,
      shadows_black_point: -40,
      highlights_white_point: 10,
      color_grading_config: {
        mode: 'bw',
        lut_applied: false,
        colorspace: 'srgb',
        tone_curve_preset: 'bw'
      }
    }
  }
];

const ColorGradingParametersPanel: React.FC = () => {
  const { configParams, updateConfig, scanResult } = useStudioStore();
  const [activeTab, setActiveTab] = useState<'presets' | 'manual'>('presets');
  const [history, setHistory] = useState<any[]>([]);

  // Apply preset values when preset ID changes (e.g. from atmosphere change)
  useEffect(() => {
    if (configParams.color_grading_preset && configParams.color_grading_preset !== 'custom') {
      const preset = COLOR_GRADING_PRESETS.find(p => p.id === configParams.color_grading_preset);
      if (preset) {
        // Check if current params already match the preset to avoid infinite loops
        const isMatch = 
          configParams.saturation === preset.params.saturation &&
          configParams.contrast === preset.params.contrast &&
          configParams.vibrance === preset.params.vibrance &&
          configParams.hue_shift === preset.params.hue_shift &&
          configParams.shadows_black_point === preset.params.shadows_black_point &&
          configParams.highlights_white_point === preset.params.highlights_white_point;

        if (!isMatch) {
          updateConfig({
            ...preset.params,
            color_grading_preset: preset.id
          });
        }
      }
    }
  }, [configParams.color_grading_preset]);

  // Calculate Harmony Score
  const harmonyScore = useMemo(() => {
    const sum = Math.abs(configParams.saturation) + Math.abs(configParams.contrast) + Math.abs(configParams.vibrance);
    // 100% at sum=0, 0% at sum=300
    const score = Math.max(0, 100 - (sum / 3));
    return Math.round(score);
  }, [configParams.saturation, configParams.contrast, configParams.vibrance]);

  // Calculate Quality Score
  const qualityScore = useMemo(() => {
    let penalty = 0;
    if (Math.abs(configParams.saturation) > 80) penalty += 20;
    if (Math.abs(configParams.contrast) > 40) penalty += 20;
    if (Math.abs(configParams.vibrance) > 80) penalty += 15;
    if (Math.abs(configParams.hue_shift) > 60) penalty += 15;
    if (configParams.shadows_black_point < -50 || configParams.shadows_black_point > 80) penalty += 15;
    if (configParams.highlights_white_point < -50 || configParams.highlights_white_point > 80) penalty += 15;
    
    return Math.max(0, 100 - penalty);
  }, [configParams]);

  const handleParamChange = (name: string, value: number) => {
    // Clamping
    let clampedValue = value;
    let limitMsg = '';

    if (name === 'saturation') {
      if (value < -100) clampedValue = -100;
      if (value > 100) clampedValue = 100;
      if (value > 80) limitMsg = "Cores muito vívidas, pode parecer artificial";
    } else if (name === 'contrast') {
      if (value < -50) clampedValue = -50;
      if (value > 50) clampedValue = 50;
      if (value > 40) limitMsg = "Contraste muito alto, perdendo detalhes";
    } else if (name === 'vibrance') {
      if (value < -100) clampedValue = -100;
      if (value > 100) clampedValue = 100;
      if (value > 80) limitMsg = "Vibrance muito alta";
    } else if (name === 'hue_shift') {
      if (value < -180) clampedValue = -180;
      if (value > 180) clampedValue = 180;
      if (Math.abs(value) > 60) limitMsg = "Mudança de tom muito extrema";
    } else if (name === 'shadows_black_point') {
      if (value < -100) clampedValue = -100;
      if (value > 100) clampedValue = 100;
      if (value < -50) limitMsg = "Sombras levantadas demais, perde depth";
      if (value > 80) limitMsg = "Sombras muito profundas, perde detalhes";
    } else if (name === 'highlights_white_point') {
      if (value < -100) clampedValue = -100;
      if (value > 100) clampedValue = 100;
      if (value < -50) limitMsg = "Highlights muito levantadas, sem brilho";
      if (value > 80) limitMsg = "Muito brilho, pode causar blown-out";
    }

    if (limitMsg) {
      toast.warning(limitMsg, { id: `limit-${name}` });
    }

    // Save history for rollback (simple version)
    setHistory(prev => [configParams, ...prev].slice(0, 10));

    updateConfig({ 
      [name]: clampedValue,
      color_grading_preset: 'custom'
    });
  };

  const applyPreset = (preset: ColorGradingPreset) => {
    setHistory(prev => [configParams, ...prev].slice(0, 10));
    updateConfig({
      ...preset.params,
      color_grading_preset: preset.id
    });
    toast.success(`Preset "${preset.name}" aplicado com sucesso!`);
  };

  const rollback = () => {
    if (history.length > 0) {
      const lastState = history[0];
      updateConfig(lastState);
      setHistory(prev => prev.slice(1));
      toast.info("Configuração anterior restaurada");
    }
  };

  const autoHarmonize = () => {
    const newParams = {
      saturation: Math.max(-40, Math.min(40, configParams.saturation)),
      contrast: Math.max(-20, Math.min(20, configParams.contrast)),
      vibrance: Math.max(-40, Math.min(40, configParams.vibrance)),
      shadows_black_point: Math.max(-30, Math.min(30, configParams.shadows_black_point)),
      highlights_white_point: Math.max(-30, Math.min(30, configParams.highlights_white_point)),
    };
    updateConfig(newParams);
    toast.success("Parâmetros harmonizados automaticamente");
  };

  // Compatibility Checks
  const warnings = useMemo(() => {
    const list = [];
    
    // Harmony
    if (harmonyScore < 50) {
      list.push({ id: 'harmony', type: 'warning', text: `Harmonia reduzida (${harmonyScore}%) - Muita edição detectada.` });
    }

    // Saturation vs Vibrance
    if (configParams.saturation > 80 && configParams.vibrance > 60) {
      list.push({ id: 'sat-vib', type: 'warning', text: "Conflito: Saturação e Vibrance excessivos." });
    }

    // Contrast vs Shadows/Highlights
    if (configParams.contrast > 40 && (Math.abs(configParams.shadows_black_point) > 20 || Math.abs(configParams.highlights_white_point) > 20)) {
      list.push({ id: 'con-tonal', type: 'warning', text: "Tonal range desbalanceado com contraste alto." });
    }

    // Hue Shift vs Temperature
    if (configParams.temperature < 3500 && configParams.hue_shift < -30) {
      list.push({ id: 'hue-temp', type: 'warning', text: "Hue shift destoante da temperatura quente." });
    }
    if (configParams.temperature > 6500 && configParams.hue_shift > 30) {
      list.push({ id: 'hue-temp-cool', type: 'warning', text: "Hue shift destoante da temperatura fria." });
    }

    // Atmosphere Compatibility
    if (configParams.atmosphere_type === 'sunset' && configParams.hue_shift < 20) {
      list.push({ id: 'atm-hue', type: 'info', text: "Sugestão: Aumente o Hue Shift para reforçar o pôr do sol." });
    }

    return list;
  }, [configParams, harmonyScore]);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Palette size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Color Grading</h3>
            <p className="text-xs text-neutral-500">Ajuste o look visual e a harmonia cromática</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button 
              onClick={rollback}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 transition-colors"
              title="Desfazer"
            >
              <RotateCcw size={18} />
            </button>
          )}
          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'presets' 
                  ? "bg-white dark:bg-neutral-700 shadow-sm text-primary" 
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Presets
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'manual' 
                  ? "bg-white dark:bg-neutral-700 shadow-sm text-primary" 
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Manual
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Scores & Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Harmonia</span>
              <span className={`text-sm font-bold ${harmonyScore > 70 ? 'text-green-500' : harmonyScore > 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                {harmonyScore}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${harmonyScore}%` }}
                className={`h-full ${harmonyScore > 70 ? 'bg-green-500' : harmonyScore > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
              />
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Qualidade</span>
              <span className={`text-sm font-bold ${qualityScore > 80 ? 'text-green-500' : qualityScore > 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                {qualityScore}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${qualityScore}%` }}
                className={`h-full ${qualityScore > 80 ? 'bg-green-500' : qualityScore > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              />
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'presets' ? (
            <motion.div 
              key="presets"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-2 sm:grid-cols-5 gap-3"
            >
              {COLOR_GRADING_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`group relative p-3 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-2 ${
                    configParams.color_grading_preset === preset.id
                      ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                      : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    configParams.color_grading_preset === preset.id
                      ? "bg-primary text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 group-hover:bg-neutral-200"
                  }`}>
                    <preset.icon size={20} />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-tight ${
                    configParams.color_grading_preset === preset.id ? "text-primary" : "text-neutral-600"
                  }`}>
                    {preset.name}
                  </span>
                  
                  {/* Tooltip-like description on hover */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 p-2 bg-neutral-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
                    {preset.description}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-neutral-900 rotate-45" />
                  </div>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="manual"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid md:grid-cols-2 gap-x-8 gap-y-6"
            >
              {[
                { id: 'saturation', label: 'Saturação', min: -100, max: 100, unit: '%' },
                { id: 'contrast', label: 'Contraste', min: -50, max: 50, unit: '%' },
                { id: 'vibrance', label: 'Vibrance', min: -100, max: 100, unit: '%' },
                { id: 'hue_shift', label: 'Hue Shift', min: -180, max: 180, unit: '°' },
                { id: 'shadows_black_point', label: 'Shadows (Black Point)', min: -100, max: 100, unit: '%' },
                { id: 'highlights_white_point', label: 'Highlights (White Point)', min: -100, max: 100, unit: '%' },
              ].map((param) => (
                <div key={param.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                        {param.label}
                      </label>
                      <Info size={12} className="text-neutral-400 cursor-help" />
                    </div>
                    <span className="text-sm font-bold font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-primary">
                      {configParams[param.id]}{param.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={1}
                    value={configParams[param.id]}
                    onChange={(e) => handleParamChange(param.id, Number(e.target.value))}
                    className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
                    <span>{param.min}{param.unit}</span>
                    <span>0{param.unit}</span>
                    <span>{param.max}{param.unit}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Warnings & Suggestions */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warning) => (
              <motion.div 
                key={warning.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-xl flex items-center gap-3 text-xs font-medium ${
                  warning.type === 'warning' 
                    ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-900/30" 
                    : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30"
                }`}
              >
                {warning.type === 'warning' ? <AlertTriangle size={14} /> : <Info size={14} />}
                <span className="flex-1">{warning.text}</span>
                {warning.id === 'harmony' && (
                  <button 
                    onClick={autoHarmonize}
                    className="px-2 py-1 bg-yellow-100 dark:bg-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
                  >
                    Harmonizar
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
            <CheckCircle2 size={12} className="text-green-500" />
            Configuração Ativa: <span className="text-neutral-600 dark:text-neutral-300">
              {configParams.color_grading_preset === 'custom' ? 'Personalizada' : 
               COLOR_GRADING_PRESETS.find(p => p.id === configParams.color_grading_preset)?.name || 'Padrão'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${configParams.color_grading_config.lut_applied ? 'bg-green-500' : 'bg-neutral-300'}`} />
              <span className="text-[10px] font-bold text-neutral-500">LUT</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-neutral-500 uppercase">{configParams.color_grading_config.colorspace}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorGradingParametersPanel;
