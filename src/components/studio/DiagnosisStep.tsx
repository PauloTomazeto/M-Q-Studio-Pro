import React, { useEffect, useState, useRef } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { kieService } from '../../services/kieService';
import { useCredits } from '../../hooks/useCredits';
import { detectTypeFromFeatures } from '../../utils/typeDetection';
import TypeBadge from './TypeBadge';
import MaterialGrid from './MaterialGrid';
import { LightingAnalysis } from './LightingAnalysis';
import { CameraAnalysis } from './CameraAnalysis';
import { ColorTemperaturePanel } from './ColorTemperaturePanel';
import { Loader2, AlertCircle, CheckCircle2, ShieldCheck, Camera, Sun, Layers, RefreshCw, SkipForward, ChevronDown, ChevronUp, Zap, Thermometer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PROGRESS_MESSAGES = [
  "Iniciando diagnóstico técnico...",
  "Enviando imagem para análise segura...",
  "Processando volumetria e geometria...",
  "Identificando materiais e texturas PBR...",
  "Analisando iluminação e pontos de luz...",
  "Estimando parâmetros de câmera...",
  "Calculando níveis de confiança...",
  "Finalizando ScanResult estruturado...",
  "Validando dados arquiteturais...",
  "Preparando relatório final..."
];

const DiagnosisStep: React.FC = () => {
  const { 
    image, 
    base64Image, 
    sessionId, 
    scanResult, 
    setScanResult, 
    setScanStatus, 
    setScanErrors, 
    setStep,
    setIsModeLocked 
  } = useStudioStore();
  const { consumeCredits } = useCredits();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(scanResult ? 'success' : 'loading');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(scanResult);
  const [progressIndex, setProgressIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showMaterials, setShowMaterials] = useState(true);
  const [showLighting, setShowLighting] = useState(true);
  const [showCamera, setShowCamera] = useState(true);
  const [showTemperature, setShowTemperature] = useState(true);
  const analysisStartedRef = useRef(!!scanResult);
  const { materialMetrics } = useStudioStore();
  const retryCountRef = useRef(0);

  // Smooth progress bar logic
  useEffect(() => {
    if (status !== 'loading') return;

    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== 'loading') return;

    // Update progress message every 4 seconds to cover ~40s total
    const msgInterval = Math.max(3, Math.floor(40 / PROGRESS_MESSAGES.length));
    if (elapsedTime > 0 && elapsedTime % msgInterval === 0) {
      setProgressIndex(prev => Math.min(prev + 1, PROGRESS_MESSAGES.length - 1));
    }
  }, [elapsedTime, status]);

  const runAnalysis = async () => {
    // If we already have a result and we're not explicitly retrying, don't run
    if (analysisStartedRef.current && status === 'success') return;
    
    const imageToAnalyze = base64Image;
    if (!imageToAnalyze || !sessionId) {
      console.warn('Missing base64Image or sessionId for analysis', { hasBase64: !!base64Image, sessionId });
      if (!base64Image && image) {
        setError('Aguardando processamento da imagem...');
      }
      return;
    }
    
    analysisStartedRef.current = true;
    setStatus('loading');
    setIsModeLocked(true);
    setScanStatus('processing');
    setError(null);
    setElapsedTime(0);
    setProgressIndex(0);

    try {
      if (retryCountRef.current === 0) {
        const hasCredits = await consumeCredits(5, 'diagnosis_gemini');
        if (!hasCredits) {
          throw new Error('Créditos insuficientes para realizar a análise.');
        }
      }

      console.log('Running diagnosis with Base64, Session:', sessionId);
      const data = await kieService.diagnoseImage(imageToAnalyze, sessionId);
      
      // Perform Type Detection
      const detection = detectTypeFromFeatures(data);
      const { setImageType } = useStudioStore.getState();
      setImageType(
        detection.type, 
        data.typology ? 'gemini_ai' : 'post_process', 
        detection.confidence,
        detection.alternatives
      );

      setResult(data);
      setScanResult(data, elapsedTime * 1000);
      setStatus('success');
      setIsModeLocked(false);
    } catch (err: any) {
      console.error('Diagnosis Error:', err);
      
      // Retry logic for transient errors (like Zod validation if AI hallucinated)
      if (retryCountRef.current < 1 && elapsedTime < 20) {
        retryCountRef.current++;
        analysisStartedRef.current = false; // Allow retry
        console.log('Retrying diagnosis (Attempt 2)...');
        runAnalysis();
        return;
      }

      const msg = err.message || 'Erro ao analisar imagem. Tente novamente.';
      setError(msg);
      setScanErrors([msg]);
      setStatus('error');
      setIsModeLocked(false);
    }
  };

  const handleRedo = () => {
    analysisStartedRef.current = false;
    retryCountRef.current = 0;
    runAnalysis();
  };

  useEffect(() => {
    // Only run if we have the necessary data and haven't started yet
    if ((image || base64Image) && sessionId && !analysisStartedRef.current && !scanResult) {
      runAnalysis();
    }
  }, [image, base64Image, sessionId, scanResult]);

  const handleSkip = () => {
    // Fallback empty scan result if skipped
    const fallbackResult = {
      isFloorPlan: false,
      typology: "unknown",
      materials: [],
      camera: { height_m: 1.6, distance_m: 5, focal_apparent: "35mm" },
      light: { period: "afternoon", temp_k: 5500, quality: "soft", dominant_source: "Mixed" },
      confidence: { general: 0, materials: 0, camera: 0, light: 0, context: 0, composition: 0, lighting_quality: 0, photorealism: 0, technical_accuracy: 0 }
    };
    setScanResult(fallbackResult, elapsedTime * 1000);
    setStep('config');
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-8">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-32 h-32 border-4 border-primary/10 border-t-primary rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center text-primary">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ShieldCheck size={48} />
            </motion.div>
          </div>
        </div>

        <div className="text-center space-y-4 max-w-sm">
          <div className="h-8 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={progressIndex}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="text-xl font-bold text-neutral-900 dark:text-white"
              >
                {PROGRESS_MESSAGES[progressIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            Tempo decorrido: <span className="font-mono font-bold">{elapsedTime}s</span>
          </p>
          
          {elapsedTime > 25 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleSkip}
              className="flex items-center gap-2 mx-auto text-primary font-bold hover:underline"
            >
              <SkipForward size={18} />
              Pular e configurar manualmente
            </motion.button>
          )}
        </div>

        <div className="w-full max-w-xs bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: `${((progressIndex + 1) / PROGRESS_MESSAGES.length) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-error/5 border border-error/20 p-10 rounded-[2.5rem] text-center space-y-8 max-w-lg mx-auto shadow-xl shadow-error/5">
        <div className="w-20 h-20 bg-error/10 rounded-3xl flex items-center justify-center text-error mx-auto">
          <AlertCircle size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-error">Falha no Diagnóstico</h3>
          <p className="text-neutral-600 dark:text-neutral-400">{error}</p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={runAnalysis}
            className="w-full bg-error text-white font-bold py-4 rounded-2xl hover:bg-error-dark transition-all flex items-center justify-center gap-2 shadow-lg shadow-error/20 active:scale-95"
          >
            <RefreshCw size={20} />
            Tentar Novamente
          </button>
          <button
            onClick={handleSkip}
            className="w-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold py-4 rounded-2xl hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-all active:scale-95"
          >
            Configurar Manualmente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center text-success">
              <CheckCircle2 size={24} />
            </div>
            Diagnóstico Concluído
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <p className="text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
              Análise finalizada em <span className="font-bold text-neutral-900 dark:text-white">{elapsedTime}s</span> com confiança de <span className="font-bold text-success">{result.confidence.general}%</span>
            </p>
            <div className="hidden sm:block w-px h-4 bg-neutral-200 dark:bg-neutral-800" />
            <TypeBadge />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={handleRedo}
            className="px-6 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Refazer Diagnóstico
          </button>
          <button
            onClick={() => setStep('config')}
            className="bg-primary hover:bg-primary-dark text-white font-bold py-4 px-10 rounded-2xl transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-2"
          >
            Próximo Passo
            <SkipForward size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-neutral-900 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm group hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Layers size={24} />
            </div>
            <div>
              <h4 className="font-bold text-neutral-900 dark:text-white">Materiais</h4>
              <p className="text-xs text-neutral-500 uppercase tracking-wider">PBR Analysis</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-neutral-900 dark:text-white">{result.materials.length}</p>
            <p className="text-neutral-500">elementos</p>
          </div>
          <div className="mt-4 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${result.confidence.materials}%` }}
              className="h-full bg-primary"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-neutral-900 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm group hover:border-warning/30 transition-colors"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-warning/10 rounded-2xl flex items-center justify-center text-warning group-hover:scale-110 transition-transform">
              <Sun size={24} />
            </div>
            <div>
              <h4 className="font-bold text-neutral-900 dark:text-white">Iluminação</h4>
              <p className="text-xs text-neutral-500 uppercase tracking-wider">Light Points</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-neutral-900 dark:text-white">{result.lightPoints?.length || 0}</p>
            <p className="text-neutral-500">fontes</p>
          </div>
          <div className="mt-4 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${result.confidence.light}%` }}
              className="h-full bg-warning"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-neutral-900 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm group hover:border-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
              <Camera size={24} />
            </div>
            <div>
              <h4 className="font-bold text-neutral-900 dark:text-white">Câmera</h4>
              <p className="text-xs text-neutral-500 uppercase tracking-wider">Optics Estimation</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-neutral-900 dark:text-white">{result.cameraData?.focal_apparent || 'N/A'}mm</p>
            <p className="text-neutral-500">focal</p>
          </div>
          <div className="mt-4 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${result.confidence.camera}%` }}
              className="h-full bg-secondary"
            />
          </div>
        </motion.div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <h4 className="font-bold text-sm uppercase tracking-wider text-neutral-500">Resumo Técnico do Scan</h4>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
            <span>ID: {sessionId?.substring(0, 8)}...</span>
          </div>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <p className="text-xs text-neutral-500 uppercase mb-1">Tipologia</p>
              <p className="font-bold capitalize">{result.typology}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase mb-1">Pavimentos</p>
              <p className="font-bold">{result.floors || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase mb-1">Período</p>
              <p className="font-bold capitalize">{result.light.period.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase mb-1">Fonte Dominante</p>
              <p className="font-bold">{result.light.dominant_source}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase mb-1">Altura Câmera</p>
              <p className="font-bold">{result.cameraData?.height_m?.toFixed(2) || 'N/A'}m</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase mb-1">Distância</p>
              <p className="font-bold">{result.cameraData?.distance_m?.toFixed(1) || 'N/A'}m</p>
            </div>
          </div>
          
          {/* Material Analysis Section */}
          <div className="mt-10 pt-10 border-t border-neutral-100 dark:border-neutral-800 space-y-8">
            <div className="flex items-center justify-between">
              <h5 className="font-bold flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full" />
                Análise Detalhada de Materiais
              </h5>
              <button 
                onClick={() => setShowMaterials(!showMaterials)}
                className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
              >
                {showMaterials ? <><ChevronUp size={14} /> Recolher</> : <><ChevronDown size={14} /> Expandir</>}
              </button>
            </div>

            <AnimatePresence>
              {showMaterials && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <MaterialGrid />

                  {materialMetrics && (
                    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-neutral-50 dark:bg-neutral-950 p-5 rounded-3xl border border-neutral-100 dark:border-neutral-800">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase mb-2">Compatibilidade</p>
                        <div className="flex items-end justify-between">
                          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{materialMetrics.material_compatibility}%</p>
                          <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded">Ótima</span>
                        </div>
                      </div>
                      <div className="bg-neutral-50 dark:bg-neutral-950 p-5 rounded-3xl border border-neutral-100 dark:border-neutral-800">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase mb-2">Reflectância Média</p>
                        <p className="text-2xl font-bold text-neutral-900 dark:text-white">{Math.round(materialMetrics.average_reflectance)}%</p>
                      </div>
                      <div className="bg-neutral-50 dark:bg-neutral-950 p-5 rounded-3xl border border-neutral-100 dark:border-neutral-800">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase mb-2">Variedade Superficial</p>
                        <p className="text-2xl font-bold text-neutral-900 dark:text-white capitalize">{materialMetrics.surface_variety}</p>
                      </div>
                      <div className="bg-neutral-50 dark:bg-neutral-950 p-5 rounded-3xl border border-neutral-100 dark:border-neutral-800">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase mb-2">Metais / Translúcidos</p>
                        <p className="text-2xl font-bold text-neutral-900 dark:text-white">{materialMetrics.metallic_count} / {materialMetrics.translucent_count}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Lighting Analysis Section */}
          <div className="mt-10 pt-10 border-t border-neutral-100 dark:border-neutral-800 space-y-8">
            <div className="flex items-center justify-between">
              <h5 className="font-bold flex items-center gap-2 text-orange-500">
                <Zap className="w-4 h-4 fill-current" />
                Análise Detalhada de Iluminação
              </h5>
              <button 
                onClick={() => setShowLighting(!showLighting)}
                className="text-xs font-bold text-orange-500 flex items-center gap-1 hover:underline"
              >
                {showLighting ? <><ChevronUp size={14} /> Recolher</> : <><ChevronDown size={14} /> Expandir</>}
              </button>
            </div>

            <AnimatePresence>
              {showLighting && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <LightingAnalysis />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Color Temperature Section */}
          <div className="mt-10 pt-10 border-t border-neutral-100 dark:border-neutral-800 space-y-8">
            <div className="flex items-center justify-between">
              <h5 className="font-bold flex items-center gap-2 text-secondary">
                <Thermometer className="w-4 h-4" />
                Balanço de Branco e Temperatura
              </h5>
              <button 
                onClick={() => setShowTemperature(!showTemperature)}
                className="text-xs font-bold text-secondary flex items-center gap-1 hover:underline"
              >
                {showTemperature ? <><ChevronUp size={14} /> Recolher</> : <><ChevronDown size={14} /> Expandir</>}
              </button>
            </div>

            <AnimatePresence>
              {showTemperature && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <ColorTemperaturePanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Camera Analysis Section */}
          <div className="mt-10 pt-10 border-t border-neutral-100 dark:border-neutral-800 space-y-8">
            <div className="flex items-center justify-between">
              <h5 className="font-bold flex items-center gap-2 text-secondary">
                <Camera className="w-4 h-4" />
                Análise Detalhada de Câmera e Óptica
              </h5>
              <button 
                onClick={() => setShowCamera(!showCamera)}
                className="text-xs font-bold text-secondary flex items-center gap-1 hover:underline"
              >
                {showCamera ? <><ChevronUp size={14} /> Recolher</> : <><ChevronDown size={14} /> Expandir</>}
              </button>
            </div>

            <AnimatePresence>
              {showCamera && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <CameraAnalysis />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-10 pt-10 border-t border-neutral-100 dark:border-neutral-800">
            <h5 className="font-bold mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full" />
              Dados Brutos (JSON)
            </h5>
            <div className="bg-neutral-50 dark:bg-neutral-950 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <pre className="text-xs font-mono text-neutral-600 dark:text-neutral-400 overflow-x-auto max-h-60">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosisStep;
