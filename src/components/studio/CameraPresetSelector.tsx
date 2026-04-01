import React from 'react';
import { useStudioStore } from '../../store/studioStore';
import { CAMERA_PRESETS } from '../../utils/cameraUtils';
import { Camera, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const CameraPresetSelector: React.FC = () => {
  const { cameraData, updateCameraData } = useStudioStore();
  const [isOpen, setIsOpen] = React.useState(false);

  if (!cameraData) return null;

  const handlePresetSelect = (presetKey: string) => {
    const preset = CAMERA_PRESETS[presetKey];
    if (preset) {
      updateCameraData({
        ...preset,
        camera_preset: presetKey,
        detected_at: new Date().toISOString()
      });
    }
    setIsOpen(false);
  };

  const currentPresetLabel = cameraData.camera_preset.replace(/_/g, ' ');

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-[#151619] border border-white/10 rounded-xl hover:border-primary/50 transition-all group"
      >
        <div className="p-1.5 bg-primary/10 rounded-lg text-primary group-hover:scale-110 transition-transform">
          <Camera size={14} />
        </div>
        <div className="text-left">
          <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest leading-none mb-1">Preset Ativo</p>
          <p className="text-[10px] font-bold text-white uppercase tracking-tight truncate max-w-[120px]">
            {currentPresetLabel}
          </p>
        </div>
        <ChevronDown size={14} className={`text-white/20 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-64 bg-[#1a1b1e] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-3 border-b border-white/5 bg-black/20">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Presets de Câmera</p>
              </div>
              <div className="max-h-80 overflow-y-auto p-1">
                {Object.keys(CAMERA_PRESETS).map((key) => (
                  <button
                    key={key}
                    onClick={() => handlePresetSelect(key)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all hover:bg-white/5 group ${
                      cameraData.camera_preset === key ? 'bg-primary/10 text-primary' : 'text-white/60'
                    }`}
                  >
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-tight group-hover:text-white transition-colors">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[9px] text-white/20 uppercase tracking-tighter">
                        {CAMERA_PRESETS[key].focal_apparent}mm • {CAMERA_PRESETS[key].height_m}m
                      </p>
                    </div>
                    {cameraData.camera_preset === key && (
                      <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(255,100,0,0.8)]" />
                    )}
                  </button>
                ))}
                
                <div className="p-1 mt-1 border-t border-white/5">
                  <button
                    onClick={() => handlePresetSelect('custom')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all hover:bg-white/5 group ${
                      cameraData.camera_preset === 'custom' ? 'bg-white/10 text-white' : 'text-white/40'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-tight">Configuração Manual</span>
                    {cameraData.camera_preset === 'custom' && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
