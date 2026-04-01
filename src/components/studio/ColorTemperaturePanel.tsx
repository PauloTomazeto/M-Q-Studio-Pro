import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Thermometer, Sun, Moon, Cloud, Wind, Info, RotateCcw, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { 
  kelvinToHex, 
  TEMPERATURE_PRESETS, 
  getTemperatureState, 
  clampTemperature, 
  roundTemperature,
  calculateRenderingImpact 
} from '../../utils/colorUtils';

export const ColorTemperaturePanel: React.FC = () => {
  const { configParams, updateConfig, ambientLight } = useStudioStore();
  const [localTemp, setLocalTemp] = useState(configParams.temperature);
  const [showIncompatibility, setShowIncompatibility] = useState(false);

  // Sync with store when it changes externally (e.g. from analysis)
  useEffect(() => {
    setLocalTemp(configParams.temperature);
  }, [configParams.temperature]);

  const handleTempChange = (value: number) => {
    const rounded = roundTemperature(value);
    const clamped = clampTemperature(rounded);
    setLocalTemp(clamped);
    
    const impact = calculateRenderingImpact(clamped);
    
    updateConfig({
      temperature: clamped,
      color_temperature_source: 'manual',
      color_temperature_preset_name: null,
      saturation: impact.saturation,
      hue_shift: impact.hueShift,
      // We could also update bloom if we had that in configParams
    });
  };

  const handlePresetSelect = (key: string) => {
    const preset = (TEMPERATURE_PRESETS as any)[key];
    if (preset) {
      const clamped = clampTemperature(preset.value);
      setLocalTemp(clamped);
      const impact = calculateRenderingImpact(clamped);
      
      updateConfig({
        temperature: clamped,
        color_temperature_source: 'preset',
        color_temperature_preset_name: key,
        saturation: impact.saturation,
        hue_shift: impact.hueShift
      });
    }
  };

  const resetToDetected = () => {
    if (ambientLight?.temp_k) {
      const clamped = clampTemperature(ambientLight.temp_k);
      setLocalTemp(clamped);
      updateConfig({
        temperature: clamped,
        color_temperature_source: 'detected',
        color_temperature_preset_name: null
      });
    }
  };

  const currentStatus = getTemperatureState(localTemp);
  
  // Check compatibility with atmosphere/period
  const isIncompatible = ambientLight && (
    (ambientLight.period === 'night' && localTemp > 5000) ||
    (ambientLight.period === 'golden_hour' && localTemp > 4500) ||
    (ambientLight.period === 'morning' && localTemp < 4000)
  );

  return (
    <div className="bg-[#151619] border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl overflow-hidden relative">
      {/* Background Glow */}
      <div 
        className="absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-20 pointer-events-none transition-colors duration-1000"
        style={{ backgroundColor: kelvinToHex(localTemp) }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Temperatura de Cor</h3>
            <p className="text-[10px] text-white/30 uppercase tracking-tighter">Balanço de branco e tonalidade da cena</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {ambientLight && (
            <button
              onClick={resetToDetected}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                configParams.color_temperature_source === 'detected' 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'bg-white/5 text-white/40 hover:text-white'
              }`}
            >
              <Zap size={12} />
              Detectado ({ambientLight.temp_k}K)
            </button>
          )}
          <button
            onClick={() => handleTempChange(5500)}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 transition-colors"
            title="Reset para Neutro"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Control Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
        <div className="lg:col-span-7 space-y-8">
          {/* Temperature Slider */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Ajuste Manual</span>
                <span className={`text-xs font-bold uppercase ${currentStatus.color}`}>{currentStatus.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-bold text-white tracking-tighter">{localTemp}</span>
                <span className="text-xs font-bold text-white/20 uppercase">Kelvin</span>
              </div>
            </div>

            <div className="relative h-12 flex items-center">
              {/* Gradient Track */}
              <div className="absolute inset-0 h-2 my-auto rounded-full bg-gradient-to-r from-orange-500 via-yellow-200 to-blue-500 opacity-30" />
              
              <input
                type="range"
                min="2700"
                max="8000"
                step="100"
                value={localTemp}
                onChange={(e) => handleTempChange(parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer z-10 
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 
                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-xl
                           [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-primary"
              />
              
              {/* Scale Markers */}
              <div className="absolute top-8 left-0 right-0 flex justify-between px-1">
                {[2700, 4000, 5500, 7000, 8000].map(val => (
                  <div key={val} className="flex flex-col items-center gap-1">
                    <div className="w-0.5 h-1 bg-white/20" />
                    <span className="text-[8px] font-mono text-white/20">{val}K</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Presets Grid */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Presets Rápidos</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(TEMPERATURE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handlePresetSelect(key)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                    configParams.color_temperature_preset_name === key
                      ? 'bg-primary/10 border-primary text-primary shadow-lg'
                      : 'bg-white/5 border-white/5 text-white/40 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {key === 'candle_light' && <Moon size={16} />}
                  {key === 'tungsten_incandescent' && <Zap size={16} />}
                  {key === 'fluorescent_warm' && <Wind size={16} />}
                  {key === 'daylight' && <Sun size={16} />}
                  {key === 'overcast' && <Cloud size={16} />}
                  {key === 'shade' && <Cloud size={16} />}
                  {key === 'blue_sky' && <Sun size={16} />}
                  <span className="text-[9px] font-bold uppercase tracking-tighter text-center">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Preview & Impact */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-black/40 border border-white/5 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Impacto no Render</h4>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: kelvinToHex(localTemp) }} />
                <span className="text-[9px] font-mono text-white/40 uppercase">Simulação</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-white/20 uppercase">Saturação</span>
                <span className={`text-xs font-mono font-bold ${configParams.saturation >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {configParams.saturation > 0 ? '+' : ''}{configParams.saturation}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-white/20 uppercase">Hue Shift</span>
                <span className="text-xs font-mono font-bold text-primary">
                  {configParams.hue_shift > 0 ? '+' : ''}{configParams.hue_shift}°
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-white/20 uppercase">Bloom Color</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: kelvinToHex(localTemp) }} />
                  <span className="text-xs font-mono font-bold text-white">{kelvinToHex(localTemp).toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Incompatibility Warning */}
            <AnimatePresence>
              {isIncompatible && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl space-y-2"
                >
                  <div className="flex items-center gap-2 text-yellow-500">
                    <AlertTriangle size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Incompatibilidade</span>
                  </div>
                  <p className="text-[10px] text-yellow-500/70 leading-relaxed">
                    A temperatura selecionada ({localTemp}K) pode não ser coerente com o período detectado ({ambientLight?.period}). 
                    Isso pode resultar em um render menos fotorrealista.
                  </p>
                  <button
                    onClick={resetToDetected}
                    className="text-[9px] font-bold text-yellow-500 underline uppercase tracking-widest hover:text-yellow-400"
                  >
                    Usar Recomendado
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {!isIncompatible && (
              <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-2xl flex items-center gap-3">
                <CheckCircle2 size={16} className="text-green-500/50" />
                <p className="text-[10px] text-green-500/50 uppercase tracking-tight">
                  Configuração equilibrada para a atmosfera atual.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
