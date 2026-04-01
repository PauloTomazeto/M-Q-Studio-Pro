import React, { useMemo } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { Sun, Zap, Sparkles, Lightbulb, AlertTriangle, CheckCircle2, RotateCcw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LIGHTING_PRESETS = [
  {
    id: 'studio',
    name: 'Estúdio (High-Key)',
    description: 'Cena bem iluminada e profissional',
    values: { ambient: 85, directional: 75, reflections: 65, brightness: 15 }
  },
  {
    id: 'natural',
    name: 'Luz Natural',
    description: 'Equilíbrio suave de luz solar',
    values: { ambient: 65, directional: 85, reflections: 45, brightness: 5 }
  },
  {
    id: 'dramatic',
    name: 'Dramática (Low-Key)',
    description: 'Contraste alto e sombras profundas',
    values: { ambient: 35, directional: 75, reflections: 25, brightness: -15 }
  },
  {
    id: 'night',
    name: 'Cena Noturna',
    description: 'Iluminação artificial e escura',
    values: { ambient: 15, directional: 55, reflections: 10, brightness: -25 }
  },
  {
    id: 'soft',
    name: 'Luz Suave',
    description: 'Sombras difusas e envolventes',
    values: { ambient: 75, directional: 55, reflections: 65, brightness: 5 }
  }
];

const LightingParametersPanel: React.FC = () => {
  const { configParams, updateConfig, scanResult, materials, cameraData } = useStudioStore();

  const handleParamChange = (name: string, value: number) => {
    // Clamp values as per business rules
    let clampedValue = value;
    if (name === 'brightness') {
      clampedValue = Math.max(-100, Math.min(100, value));
    } else {
      clampedValue = Math.max(0, Math.min(100, value));
    }
    updateConfig({ [name]: clampedValue });
  };

  const balance = useMemo(() => {
    const sum = configParams.ambient + configParams.directional + configParams.reflections;
    const isBalanced = sum >= 60 && sum <= 200;
    const qualityScore = Math.max(0, 100 - Math.abs(180 - sum) / 2);
    
    let status: 'low' | 'balanced' | 'high' = 'balanced';
    if (sum < 60) status = 'low';
    if (sum > 180) status = 'high';

    return { sum, isBalanced, qualityScore, status };
  }, [configParams.ambient, configParams.directional, configParams.reflections]);

  const applyPreset = (preset: typeof LIGHTING_PRESETS[0]) => {
    updateConfig(preset.values);
  };

  const autoBalance = () => {
    const sum = balance.sum;
    if (sum === 0) return;
    const factor = 180 / sum;
    updateConfig({
      ambient: Math.round(configParams.ambient * factor),
      directional: Math.round(configParams.directional * factor),
      reflections: Math.round(configParams.reflections * factor)
    });
  };

  // Compatibility Checks
  const compatibilityWarnings = useMemo(() => {
    const warnings: string[] = [];
    
    // Atmosphere compatibility (simple check for now)
    const atmosphere = scanResult?.light?.period;
    if (atmosphere === 'night' && configParams.ambient > 40) {
      warnings.push('Intensidade ambiente elevada para uma cena noturna.');
    }
    if ((atmosphere === 'morning' || atmosphere === 'afternoon') && configParams.ambient < 40) {
      warnings.push('Iluminação ambiente pode estar muito baixa para luz do dia.');
    }

    // Materials compatibility
    const hasGlossy = materials.some(m => m.reflectancia === 'gloss' || m.reflectancia === 'espelhado');
    if (hasGlossy && configParams.reflections < 40) {
      warnings.push('Materiais reflexivos detectados: aumente as Reflexões para melhor realismo.');
    }

    // Camera compatibility
    if (cameraData?.focal_apparent && cameraData.focal_apparent > 85 && configParams.reflections > 60) {
      warnings.push('Lente telefoto detectada: considere reduzir reflexões para evitar distração visual.');
    }

    return warnings;
  }, [scanResult, configParams, materials, cameraData]);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <Sun size={20} />
          </div>
          <div>
            <h3 className="font-bold">Parâmetros de Iluminação</h3>
            <p className="text-xs text-neutral-500">Controle fino de intensidade e brilho</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => updateConfig({ ambient: 70, directional: 60, reflections: 50, brightness: 0 })}
            className="p-2 text-neutral-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
            title="Resetar Iluminação"
          >
            <RotateCcw size={18} />
          </button>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                balance.status === 'balanced' ? 'text-green-500' : 
                balance.status === 'high' ? 'text-orange-500' : 'text-blue-500'
              }`}>
                {balance.status === 'balanced' ? 'Equilibrado' : 
                 balance.status === 'high' ? 'Intensa' : 'Fraca'}
              </span>
              <span className="text-sm font-mono font-bold">{balance.sum}%</span>
            </div>
            <div className="w-32 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full mt-1 overflow-hidden">
              <motion.div 
                className={`h-full rounded-full ${
                  balance.status === 'balanced' ? 'bg-green-500' : 
                  balance.status === 'high' ? 'bg-orange-500' : 'bg-blue-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (balance.sum / 200) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 grid lg:grid-cols-2 gap-12">
        {/* Sliders Section */}
        <div className="space-y-8">
          <div className="space-y-6">
            {/* Ambient Light */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sun size={16} className="text-neutral-400" />
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Luz Ambiente</label>
                  <div className="group relative">
                    <Info size={14} className="text-neutral-300 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-800 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      Luz geral que preenche as sombras e define a claridade base da cena.
                    </div>
                  </div>
                </div>
                <span className="text-sm font-mono font-bold text-primary">{configParams.ambient}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={configParams.ambient}
                onChange={(e) => handleParamChange('ambient', Number(e.target.value))}
                className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Directional Light */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-neutral-400" />
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Luz Direcional</label>
                  <div className="group relative">
                    <Info size={14} className="text-neutral-300 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-800 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      Luz principal (Key Light) que cria sombras e define o volume dos objetos.
                    </div>
                  </div>
                </div>
                <span className="text-sm font-mono font-bold text-primary">{configParams.directional}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={configParams.directional}
                onChange={(e) => handleParamChange('directional', Number(e.target.value))}
                className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Reflections */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-neutral-400" />
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Reflexões</label>
                  <div className="group relative">
                    <Info size={14} className="text-neutral-300 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-800 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      Intensidade do brilho em superfícies e luz ricocheteada (bounce light).
                    </div>
                  </div>
                </div>
                <span className="text-sm font-mono font-bold text-primary">{configParams.reflections}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={configParams.reflections}
                onChange={(e) => handleParamChange('reflections', Number(e.target.value))}
                className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
              {/* Overall Brightness */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={16} className="text-neutral-400" />
                    <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Brilho Geral</label>
                  </div>
                  <span className={`text-sm font-mono font-bold ${configParams.brightness >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {100 + configParams.brightness}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={configParams.brightness}
                  onChange={(e) => handleParamChange('brightness', Number(e.target.value))}
                  className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-secondary"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 font-medium uppercase tracking-tighter">
                  <span>Muito Escuro</span>
                  <span>Neutro</span>
                  <span>Muito Claro</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warnings Section */}
          <AnimatePresence mode="wait">
            {(balance.sum > 180 || balance.sum < 60 || compatibilityWarnings.length > 0) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-orange-500 shrink-0" size={18} />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-orange-800 dark:text-orange-400">Atenção ao Equilíbrio</p>
                    <ul className="text-xs text-orange-700/80 dark:text-orange-400/70 space-y-1 list-disc list-inside">
                      {balance.sum > 180 && <li>Intensidade total elevada ({balance.sum}%). Risco de superexposição.</li>}
                      {balance.sum < 60 && <li>Iluminação muito fraca ({balance.sum}%). Detalhes podem ser perdidos.</li>}
                      {compatibilityWarnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                {balance.sum > 180 && (
                  <button 
                    onClick={autoBalance}
                    className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={14} />
                    Auto-balancear para 180%
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Presets Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Sugestões de Cena</h4>
            <div className="flex items-center gap-1 text-green-500">
              <CheckCircle2 size={14} />
              <span className="text-[10px] font-bold uppercase">Qualidade: {Math.round(balance.qualityScore)}%</span>
            </div>
          </div>

          <div className="grid gap-3">
            {LIGHTING_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className="group p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 hover:border-primary/30 hover:bg-primary/5 transition-all text-left flex items-center justify-between"
              >
                <div className="space-y-1">
                  <p className="font-bold text-sm group-hover:text-primary transition-colors">{preset.name}</p>
                  <p className="text-xs text-neutral-500">{preset.description}</p>
                </div>
                <div className="flex gap-1">
                  {Object.entries(preset.values).map(([key, val]) => (
                    <div key={key} className="w-1 h-4 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div 
                        className="w-full bg-primary/40" 
                        style={{ height: `${key === 'brightness' ? (val + 50) : val}%` }} 
                      />
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-2">
              <Info size={14} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Dica de Especialista</span>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed italic">
              "Para interiores realistas, mantenha a Luz Ambiente entre 60-80% e use a Luz Direcional para destacar pontos focais. Reflexões acima de 50% ajudam a dar profundidade a materiais polidos."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LightingParametersPanel;
