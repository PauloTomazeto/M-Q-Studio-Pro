import React from 'react';
import { motion } from 'motion/react';
import { useStudioStore } from '../../store/studioStore';
import { Sliders, Ruler, Target, ZoomIn, Eye, Maximize2, RotateCcw, Info } from 'lucide-react';
import { calculateFOV, calculateDOF } from '../../utils/cameraUtils';

export const CameraSettingsPanel: React.FC = () => {
  const { cameraData, updateCameraData } = useStudioStore();

  if (!cameraData) return null;

  const handleParamChange = (key: string, value: number) => {
    const updates: any = { [key]: value };
    
    // Recalculate derived values
    if (key === 'focal_apparent') {
      const { hFOV, vFOV } = calculateFOV(value);
      updates.fov_horizontal = hFOV;
      updates.fov_vertical = vFOV;
      updates.depth_of_field = calculateDOF(value, cameraData.distance_m);
    }
    
    if (key === 'distance_m') {
      updates.depth_of_field = calculateDOF(cameraData.focal_apparent, value);
    }

    updateCameraData({
      ...updates,
      camera_preset: 'custom'
    });
  };

  return (
    <div className="bg-[#151619] border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Painel de Controle Óptico</h3>
            <p className="text-[10px] text-white/30 uppercase tracking-tighter">Ajuste manual de parâmetros de lente e posicionamento</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Left Column: Primary Optics */}
        <div className="space-y-8">
          {/* Focal Length */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <ZoomIn className="w-3.5 h-3.5" /> Distância Focal (mm)
              </label>
              <span className="text-xs font-mono text-primary font-bold">{cameraData.focal_apparent}mm</span>
            </div>
            <input
              type="range"
              min="14"
              max="200"
              step="1"
              value={cameraData.focal_apparent}
              onChange={(e) => handleParamChange('focal_apparent', parseInt(e.target.value))}
              className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary hover:accent-primary-dark transition-all"
            />
            <div className="flex justify-between text-[9px] font-mono text-white/20 uppercase">
              <span>Wide (14mm)</span>
              <span>Tele (200mm)</span>
            </div>
          </div>

          {/* Distance */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <Target className="w-3.5 h-3.5" /> Distância ao Alvo (m)
              </label>
              <span className="text-xs font-mono text-primary font-bold">{cameraData.distance_m.toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="50"
              step="0.1"
              value={cameraData.distance_m}
              onChange={(e) => handleParamChange('distance_m', parseFloat(e.target.value))}
              className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary hover:accent-primary-dark transition-all"
            />
            <div className="flex justify-between text-[9px] font-mono text-white/20 uppercase">
              <span>Macro (0.5m)</span>
              <span>Longe (50m)</span>
            </div>
          </div>

          {/* Height */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <Ruler className="w-3.5 h-3.5" /> Altura da Câmera (m)
              </label>
              <span className="text-xs font-mono text-primary font-bold">{cameraData.height_m.toFixed(2)}m</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="5"
              step="0.05"
              value={cameraData.height_m}
              onChange={(e) => handleParamChange('height_m', parseFloat(e.target.value))}
              className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary hover:accent-primary-dark transition-all"
            />
            <div className="flex justify-between text-[9px] font-mono text-white/20 uppercase">
              <span>Baixa (0.3m)</span>
              <span>Alta (5.0m)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Angles & Distortion */}
        <div className="space-y-8">
          {/* Pitch */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <Maximize2 className="w-3.5 h-3.5" /> Inclinação (Pitch)
              </label>
              <span className="text-xs font-mono text-primary font-bold">{cameraData.pitch}°</span>
            </div>
            <input
              type="range"
              min="-90"
              max="90"
              step="1"
              value={cameraData.pitch}
              onChange={(e) => handleParamChange('pitch', parseInt(e.target.value))}
              className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary hover:accent-primary-dark transition-all"
            />
            <div className="flex justify-between text-[9px] font-mono text-white/20 uppercase">
              <span>Céu (-90°)</span>
              <span>Chão (+90°)</span>
            </div>
          </div>

          {/* Roll */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <RotateCcw className="w-3.5 h-3.5" /> Rotação (Roll)
              </label>
              <span className="text-xs font-mono text-primary font-bold">{cameraData.roll}°</span>
            </div>
            <input
              type="range"
              min="-45"
              max="45"
              step="1"
              value={cameraData.roll}
              onChange={(e) => handleParamChange('roll', parseInt(e.target.value))}
              className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary hover:accent-primary-dark transition-all"
            />
            <div className="flex justify-between text-[9px] font-mono text-white/20 uppercase">
              <span>Esquerda (-45°)</span>
              <span>Direita (+45°)</span>
            </div>
          </div>

          {/* Distortion */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <Eye className="w-3.5 h-3.5" /> Distorção de Lente
              </label>
              <span className="text-xs font-mono text-primary font-bold">{Math.round(cameraData.lens_distortion.coefficient * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={cameraData.lens_distortion.coefficient}
              onChange={(e) => updateCameraData({ 
                lens_distortion: { ...cameraData.lens_distortion, coefficient: parseFloat(e.target.value) },
                camera_preset: 'custom'
              })}
              className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary hover:accent-primary-dark transition-all"
            />
            <div className="flex justify-between text-[9px] font-mono text-white/20 uppercase">
              <span>Linear (0%)</span>
              <span>Fisheye (100%)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-white/5 flex items-center gap-4">
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-4 flex-1">
          <Info className="w-5 h-5 text-primary shrink-0" />
          <p className="text-[10px] text-primary/80 leading-relaxed uppercase tracking-tight">
            Os parâmetros de câmera influenciam diretamente a composição do prompt final. 
            Ajustes manuais desativam o preset automático para garantir fidelidade total à sua visão.
          </p>
        </div>
      </div>
    </div>
  );
};
