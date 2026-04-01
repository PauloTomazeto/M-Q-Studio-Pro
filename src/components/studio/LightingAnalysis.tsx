import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Zap, Sun, Lightbulb, BarChart3, AlertCircle } from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { AmbientLightCard } from './AmbientLightCard';
import { LightPointGrid } from './LightPointGrid';
import { LightingInsights } from './LightingInsights';
import { calculateLightingMetrics } from '../../utils/lightingUtils';

export const LightingAnalysis: React.FC = () => {
  const { 
    ambientLight, 
    lightPoints, 
    lightingMetrics, 
    setLightingMetrics,
    lightingAnalysisStatus,
    scanResult,
    base64Image,
    image
  } = useStudioStore();

  const currentImageUrl = base64Image || image || scanResult?.imageUrl || '';

  useEffect(() => {
    if (ambientLight || lightPoints.length > 0) {
      const metrics = calculateLightingMetrics(ambientLight, lightPoints);
      setLightingMetrics(metrics);
    }
  }, [ambientLight, lightPoints, setLightingMetrics]);

  if (lightingAnalysisStatus === 'idle') return null;

  if (lightingAnalysisStatus === 'processing') {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-white uppercase tracking-widest">Analisando Iluminação</h3>
          <p className="text-sm text-white/40">Decompondo sistema de luzes V-Ray...</p>
        </div>
      </div>
    );
  }

  if (lightingAnalysisStatus === 'failed') {
    return (
      <div className="py-12 bg-red-500/5 border border-red-500/20 rounded-2xl flex flex-col items-center justify-center p-8 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <div className="text-center">
          <h3 className="text-lg font-bold text-white uppercase tracking-widest">Falha na Análise</h3>
          <p className="text-sm text-white/40">Não foi possível decompor a iluminação desta imagem.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 py-8">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-orange-500">
            <Zap className="w-5 h-5 fill-current" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Módulo de Iluminação</span>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tighter">Análise de Iluminação</h1>
          <p className="text-white/40 max-w-2xl text-lg leading-relaxed">
            Decomposição técnica do sistema de luzes, incluindo luz ambiente e pontos de luz individuais com parâmetros V-Ray para fidelidade física.
          </p>
        </div>
      </div>

      {/* Insights */}
      {lightingMetrics && <LightingInsights metrics={lightingMetrics} />}

      {/* Ambient Light */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Sun className="w-5 h-5 text-orange-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Luz Ambiente</h2>
        </div>
        {ambientLight && <AmbientLightCard light={ambientLight} />}
      </div>

      {/* Light Points */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Lightbulb className="w-5 h-5 text-orange-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Pontos de Luz</h2>
        </div>
        <LightPointGrid lights={lightPoints} imageUrl={currentImageUrl} />
      </div>

      {/* Technical Summary */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-white/5 rounded-2xl">
            <BarChart3 className="w-8 h-8 text-white/40" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Pronto para Prompt</h3>
            <p className="text-sm text-white/40">Todos os {lightPoints.length + 1} pontos de luz foram integrados ao modelo de geração.</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <div className="text-right">
            <span className="block text-[10px] font-bold text-white/20 uppercase tracking-widest">Temperatura Média</span>
            <span className="text-xl font-mono text-white">
              {Math.round(
                (lightPoints.reduce((acc, p) => acc + p.temp_k_initial, 0) + (ambientLight?.temp_k || 0)) / 
                (lightPoints.length + 1)
              )}K
            </span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] font-bold text-white/20 uppercase tracking-widest">Intensidade Total</span>
            <span className="text-xl font-mono text-white">
              {Math.round(
                lightPoints.reduce((acc, p) => acc + p.intensity_initial, 0) / (lightPoints.length || 1)
              )}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
