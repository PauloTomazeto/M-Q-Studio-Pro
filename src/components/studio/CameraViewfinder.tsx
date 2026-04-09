import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useStudioStore } from '../../store/studioStore';
import { Target, Maximize2, Move, RotateCcw, Camera, Info } from 'lucide-react';

export const CameraViewfinder: React.FC = () => {
  const { cameraData, base64Image, image } = useStudioStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  }, []);

  if (!cameraData) return null;

  const imageUrl = base64Image || image;

  return (
    <div className="relative w-full aspect-video bg-black rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl group">
      {/* Background Image */}
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt="Camera Viewfinder" 
          className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-700"
          referrerPolicy="no-referrer"
        />
      )}

      {/* Viewfinder Overlays */}
      <div ref={containerRef} className="absolute inset-0 pointer-events-none">
        {/* Corner Brackets */}
        <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-white/20 rounded-tl-2xl" />
        <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-white/20 rounded-tr-2xl" />
        <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-white/20 rounded-bl-2xl" />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-white/20 rounded-br-2xl" />

        {/* Center Target */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <Target className="w-12 h-12 text-white/10" />
            <div className="absolute inset-0 m-auto w-1 h-1 bg-primary rounded-full shadow-[0_0_10px_rgba(255,100,0,0.8)]" />
          </div>
        </div>

        {/* Rule of Thirds Grid */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-10">
          <div className="border-r border-b border-white/50" />
          <div className="border-r border-b border-white/50" />
          <div className="border-b border-white/50" />
          <div className="border-r border-b border-white/50" />
          <div className="border-r border-b border-white/50" />
          <div className="border-b border-white/50" />
          <div className="border-r border-white/50" />
          <div className="border-r border-white/50" />
        </div>

        {/* Level Indicator (Roll) */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <div className="w-32 h-0.5 bg-white/10 relative">
            <motion.div 
              animate={{ rotate: cameraData.roll }}
              className="absolute inset-0 bg-primary shadow-[0_0_10px_rgba(255,100,0,0.5)]"
            />
          </div>
          <span className="text-[10px] font-mono text-white/40">{Math.round(cameraData.roll)}°</span>
        </div>

        {/* Technical Readouts (HUD) */}
        <div className="absolute top-10 left-10 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono text-white font-bold tracking-widest uppercase">REC</span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-white/60 uppercase tracking-tighter">FOCAL: {cameraData.focal_apparent}mm</p>
            <p className="text-[10px] font-mono text-white/60 uppercase tracking-tighter">DIST: {cameraData.distance_m.toFixed(1)}m</p>
            <p className="text-[10px] font-mono text-white/60 uppercase tracking-tighter">HGT: {cameraData.height_m.toFixed(2)}m</p>
          </div>
        </div>

        <div className="absolute top-10 right-10 text-right space-y-1">
          <p className="text-[10px] font-mono text-white/60 uppercase tracking-tighter">{cameraData.image_type_influence.perspective_type}</p>
          <p className="text-[10px] font-mono text-white/60 uppercase tracking-tighter">{cameraData.vanishing_points} VANISHING POINTS</p>
          <p className="text-[10px] font-mono text-primary font-bold uppercase tracking-tighter">{cameraData.camera_preset.replace(/_/g, ' ')}</p>
        </div>

        {/* Perspective Lines Overlay (Conceptual) */}
        {cameraData.perspective_lines && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
            {/* Primary lines */}
            <line 
              x1={cameraData.perspective_lines.primary[0]} 
              y1={cameraData.perspective_lines.primary[1]} 
              x2={cameraData.perspective_lines.primary[2]} 
              y2={cameraData.perspective_lines.primary[3]} 
              stroke="#ff6400" 
              strokeWidth="1" 
              strokeDasharray="4 4"
            />
            {/* Secondary lines */}
            <line 
              x1={cameraData.perspective_lines.secondary[0]} 
              y1={cameraData.perspective_lines.secondary[1]} 
              x2={cameraData.perspective_lines.secondary[2]} 
              y2={cameraData.perspective_lines.secondary[3]} 
              stroke="#00ffcc" 
              strokeWidth="1" 
              strokeDasharray="4 4"
            />
          </svg>
        )}
      </div>

      {/* Bottom Bar Controls (Visual only) */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between px-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-white/40 uppercase">ISO</span>
            <span className="text-xs font-mono text-white">100</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-white/40 uppercase">SHTR</span>
            <span className="text-xs font-mono text-white">1/125</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-white/40 uppercase">F-STP</span>
            <span className="text-xs font-mono text-white">f/8.0</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors" title="Mover Câmera">
            <Move size={16} className="text-white/60" />
          </button>
          <button className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
            <Maximize2 size={16} className="text-white/60" />
          </button>
          <button className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
            <RotateCcw size={16} className="text-white/60" />
          </button>
        </div>
      </div>
    </div>
  );
};
