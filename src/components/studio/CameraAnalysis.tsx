import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Settings2, Target, Maximize2, RotateCcw, AlertTriangle, CheckCircle2, Sliders, Info } from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { CameraViewfinder } from './CameraViewfinder';
import { CameraSettingsPanel } from './CameraSettingsPanel';
import { CameraPresetSelector } from './CameraPresetSelector';
import { validateCameraData } from '../../utils/cameraUtils';

export const CameraAnalysis: React.FC = () => {
  const { cameraData, cameraAnalysisStatus, updateCameraData } = useStudioStore();
  const [activeTab, setActiveTab] = useState<'viewfinder' | 'settings'>('viewfinder');
  const [showWarnings, setShowWarnings] = useState(false);

  if (cameraAnalysisStatus === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-2 border-primary/10 border-t-primary rounded-full"
          />
          <Camera className="absolute inset-0 m-auto text-primary animate-pulse" size={24} />
        </div>
        <p className="text-sm font-bold text-neutral-500 animate-pulse uppercase tracking-widest">
          Calculando Óptica e Perspectiva...
        </p>
      </div>
    );
  }

  if (!cameraData) return null;

  const { valid, warnings } = validateCameraData(cameraData);

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('viewfinder')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'viewfinder' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white'
              }`}
            >
              <Target size={14} />
              Viewfinder
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'settings' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white'
              }`}
            >
              <Settings2 size={14} />
              Configurações
            </button>
          </div>

          {warnings.length > 0 && (
            <button
              onClick={() => setShowWarnings(!showWarnings)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                valid ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500 animate-pulse'
              }`}
            >
              {valid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {valid ? 'Parâmetros Estáveis' : `${warnings.length} Alertas de Coerência`}
            </button>
          )}
        </div>

        <CameraPresetSelector />
      </div>

      {/* Warnings Dropdown */}
      <AnimatePresence>
        {showWarnings && warnings.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-yellow-500 mb-2">
                <Info size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Sugestões de Ajuste</span>
              </div>
              {warnings.map((warning, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-yellow-500/80">
                  <div className="w-1 h-1 bg-yellow-500 rounded-full" />
                  {warning}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Viewfinder or Settings */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'viewfinder' ? (
              <motion.div
                key="viewfinder"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <CameraViewfinder />
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <CameraSettingsPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Real-time Stats & Impact */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#151619] border border-white/10 rounded-[2rem] p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest">Status da Lente</h4>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-mono text-green-500 uppercase">Live</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-white/20 uppercase">Focal Apparent</span>
                <span className="text-sm font-mono text-white">{cameraData.focal_apparent}mm</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-white/20 uppercase">FOV (H/V)</span>
                <span className="text-sm font-mono text-white">
                  {Math.round(cameraData.fov_horizontal)}° / {Math.round(cameraData.fov_vertical)}°
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-white/20 uppercase">Distância</span>
                <span className="text-sm font-mono text-white">{cameraData.distance_m.toFixed(1)}m</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-white/20 uppercase">Altura</span>
                <span className="text-sm font-mono text-white">{cameraData.height_m.toFixed(2)}m</span>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/20 uppercase">Impacto no Render</span>
                <span className="text-[10px] font-bold text-primary uppercase">{cameraData.rendering_impact.lens_quality}</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono text-white/40">
                  <span>DOF Strength</span>
                  <span>{Math.round(cameraData.rendering_impact.depth_field_strength)}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${cameraData.rendering_impact.depth_field_strength}%` }}
                    className="h-full bg-primary"
                  />
                </div>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                <p className="text-[10px] text-primary/80 leading-relaxed italic">
                  "Configuração ideal para {cameraData.image_type_influence.perspective_type === 'linear' ? 'vistas internas' : 'vistas externas'} com foco em {cameraData.focal_apparent > 50 ? 'detalhes' : 'amplitude'}."
                </p>
              </div>
            </div>
          </div>

          {/* Confidence Metrics */}
          <div className="bg-[#151619] border border-white/10 rounded-[2rem] p-6 space-y-4">
            <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest">Confiança da Análise</h4>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(cameraData.confidence).map(([key, value]) => (
                key !== 'general' && (
                  <div key={key} className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-bold text-white/20 uppercase">
                      <span>{key}</span>
                      <span>{value}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${value > 80 ? 'bg-green-500/50' : 'bg-yellow-500/50'}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
