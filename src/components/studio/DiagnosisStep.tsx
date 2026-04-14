import React, { useEffect, useState, useRef } from 'react';
import { useStudioStore } from '../../store/studioStore';
import kieService from '../../services/kieService';
import { useCredits } from '../../hooks/useCredits';
import { detectTypeFromFeatures } from '../../utils/typeDetection';
import TypeBadge from './TypeBadge';
import MaterialGrid from './MaterialGrid';
import { LightingAnalysis } from './LightingAnalysis';
import { CameraAnalysis } from './CameraAnalysis';
import { ColorTemperaturePanel } from './ColorTemperaturePanel';
import { Loader2, AlertCircle, CheckCircle2, ShieldCheck, Camera, Sun, Layers, RefreshCw, SkipForward, ChevronDown, ChevronUp, Zap, Thermometer, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const PROGRESS_MESSAGES = [
  "Iniciando diagnóstico técnico...",
  "Enviando imagem para análise segura...",
  "Processando volumetria e geometria...",
  "Identificando materiais e texturas PBR...",
  "Analisando iluminação e pontos de luz...",
  "Mapeando ambientes e mobiliário...",
  "Detectando veículos e equipamentos...",
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
  const { consumeCredits, refundCredits } = useCredits();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(scanResult ? 'success' : 'loading');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(scanResult);
  const [progressIndex, setProgressIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showMaterials, setShowMaterials] = useState(true);
  const [showLighting, setShowLighting] = useState(true);
  const [showCamera, setShowCamera] = useState(true);
  const [showTemperature, setShowTemperature] = useState(true);
  const [showAmbientes, setShowAmbientes] = useState(true);
  const [showVolumes, setShowVolumes] = useState(true);
  const [showOpenings, setShowOpenings] = useState(true);
  const [showStructural, setShowStructural] = useState(true);
  const [showRedoConfirm, setShowRedoConfirm] = useState(false);
  const analysisStartedRef = useRef(!!scanResult);
  const isProcessingRef = useRef(false);
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
    
    if (isProcessingRef.current) return;
    
    const imageToAnalyze = base64Image;
    if (!imageToAnalyze || !sessionId) {
      console.warn('Missing base64Image or sessionId for analysis', { hasBase64: !!base64Image, sessionId });
      return;
    }
    
    isProcessingRef.current = true;
    analysisStartedRef.current = true; // Mark immediately to prevent useEffect re-triggering
    setStatus('loading');
    setIsModeLocked(true);
    setScanStatus('processing');
    setError(null);
    
    // Reset elapsed time only on first attempt
    if (retryCountRef.current === 0) {
      setElapsedTime(0);
      setProgressIndex(0);
    }

    try {
      // ONLY consume credits on the very first attempt
      if (retryCountRef.current === 0) {
        console.log('[Diagnosis] Consuming 5 credits for first attempt...');
        const hasCredits = await consumeCredits(5, 'diagnosis_gemini');
        if (!hasCredits) {
          isProcessingRef.current = false;
          throw new Error('Créditos insuficientes para realizar a análise.');
        }
        toast.success('5 créditos deducted para diagnóstico arquitetônico', { duration: 2000 });
      } else {
        console.log(`[Diagnosis] Retry attempt ${retryCountRef.current}. Skipping credit consumption.`);
      }

      console.log('Running diagnosis with Base64, Session:', sessionId);
      const data = await kieService.diagnoseImage(imageToAnalyze, sessionId);

      // Success path
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
      isProcessingRef.current = false;
      analysisStartedRef.current = true; // Mark as finished only on success

      // Show success feedback for retry
      if (retryCountRef.current > 0) {
        toast.success('Análise completa - sem cobranças adicionais', { duration: 2000 });
        console.log('[Diagnosis] Retry succeeded - no additional charges');
      }
    } catch (err: any) {
      console.error('Diagnosis Error:', err);
      isProcessingRef.current = false;

      // Detect server/transient errors
      const isServerError =
        err.message?.includes('5xx') ||
        err.message?.includes('timeout') ||
        err.message?.includes('HTML') ||
        err.response?.status >= 500;

      const isMaintenance = err.message?.toLowerCase().includes('maintained') ||
        err.message?.toLowerCase().includes('maintenance') ||
        err.message?.toLowerCase().includes('under maintenance');

      const isTransient = err.message?.includes('HTML') ||
        err.message?.includes('JSON') ||
        err.message?.includes('timeout') ||
        isMaintenance ||
        err.message?.includes('KIE_API_ERROR');

      // Refund if server error detected (regardless of retry count)
      if (isServerError && retryCountRef.current === 0) {
        const refundAmount = 5;
        try {
          await refundCredits(refundAmount, err.message);
          console.log(`[Credits] Refunded ${refundAmount} for: ${err.message}`);
          toast.info(`${refundAmount} créditos reembolsados devido a erro do servidor`, { duration: 3000 });
        } catch (refundErr) {
          console.error('[Credits] Failed to refund:', refundErr);
        }
      }

      // Retry strategy: allow up to 3 attempts for transient/maintenance errors
      const maxRetries = isMaintenance ? 2 : 1; // More retries for maintenance
      if (isTransient && retryCountRef.current < maxRetries && elapsedTime < 120) {
        retryCountRef.current++;
        const nextAttempt = retryCountRef.current + 1;
        console.log(`[Diagnosis] Retrying diagnosis (Attempt ${nextAttempt}/${maxRetries + 1})...`);

        // Exponential backoff: 2s, 4s, 8s
        const delayMs = 2000 * Math.pow(2, retryCountRef.current - 1);
        console.log(`[Diagnosis] Waiting ${delayMs}ms before retry...`);
        
        // Show user-friendly message
        if (isMaintenance) {
          toast.loading(`Serviço em manutenção. Tentativa ${nextAttempt} de ${maxRetries + 1}...`, { duration: Math.ceil(delayMs / 1000) });
        } else {
          toast.loading(`Tentando novamente... (${nextAttempt}/${maxRetries + 1})`, { duration: Math.ceil(delayMs / 1000) });
        }
        
        await new Promise(resolve => setTimeout(resolve, delayMs));

        runAnalysis();
        return;
      }

      // If retry also failed, refund any previous deduction
      if (isServerError && retryCountRef.current > 0) {
        const refundAmount = 5;
        try {
          await refundCredits(refundAmount, `Retry failed: ${err.message}`);
          console.log(`[Credits] Refunded ${refundAmount} for retry failure`);
          toast.info(`Retry falhou - ${refundAmount} créditos reembolsados`, { duration: 3000 });
        } catch (refundErr) {
          console.error('[Credits] Failed to refund after retry:', refundErr);
        }
      }

      let msg = err.message || 'Erro ao analisar imagem. Tente novamente.';
      if (isMaintenance) {
        msg = `O servidor de IA está em manutenção temporária. Tente novamente em alguns minutos. (Tentativas: ${retryCountRef.current}/${maxRetries + 1})`;
      } else if (msg.includes('ZodError')) {
        msg = 'Erro ao processar resposta da IA. Por favor, tente com outra imagem.';
      }
      setError(msg);
      setScanErrors([msg]);
      setStatus('error');
      setIsModeLocked(false);
    }
  };

  const handleRedo = () => {
    console.log('[Diagnosis] Redo requested - showing confirmation dialog');
    setShowRedoConfirm(true);
  };

  const confirmRedo = async () => {
    console.log('[Diagnosis] User confirmed redo - resetting analysis');
    setShowRedoConfirm(false);
    analysisStartedRef.current = false;
    retryCountRef.current = 0;
    toast.info('Redo confirmado - 5 créditos serão deducted', { duration: 2000 });
    runAnalysis();
  };

  const cancelRedo = () => {
    console.log('[Diagnosis] User cancelled redo');
    setShowRedoConfirm(false);
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
              <p className="font-bold capitalize">
                {result.light?.period ? result.light.period.replace('_', ' ') : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase mb-1">Fonte Dominante</p>
              <p className="font-bold">{result.light?.dominant_source || 'N/A'}</p>
            </div>
            {result.plantaType && (
              <div>
                <p className="text-xs text-neutral-500 uppercase mb-1">Tipo de Planta</p>
                <p className="font-bold">Tipo {result.plantaType}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-neutral-500 uppercase mb-1">Volumes</p>
              <p className="font-bold">{result.volumes?.length || 0}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase mb-1">Aberturas</p>
              <p className="font-bold">{result.openings?.length || 0}</p>
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
          
          {/* Volumes Analysis Section */}
          {result.volumes && result.volumes.length > 0 && (
            <div className="mt-10 pt-10 border-t border-neutral-100 dark:border-neutral-800 space-y-8">
              <div className="flex items-center justify-between">
                <h5 className="font-bold flex items-center gap-2 text-primary">
                  <Layers className="w-4 h-4" />
                  Hierarquia de Volumes (Âncoras Estruturais)
                </h5>
                <button 
                  onClick={() => setShowVolumes(!showVolumes)}
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  {showVolumes ? <><ChevronUp size={14} /> Recolher</> : <><ChevronDown size={14} /> Expandir</>}
                </button>
              </div>

              <AnimatePresence>
                {showVolumes && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {result.volumes.map((vol: any) => (
                        <div key={vol.id} className={`p-5 rounded-3xl border ${vol.dominant ? 'bg-primary/5 border-primary/20' : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800'} space-y-3`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">ID: {vol.id}</span>
                            {vol.dominant && (
                              <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full uppercase">Dominante</span>
                            )}
                          </div>
                          <p className="font-bold text-neutral-900 dark:text-white capitalize">{vol.forma_geometrica.replace(/_/g, ' ')}</p>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="text-neutral-500 uppercase text-[9px] mb-0.5">Posição</p>
                              <p className="font-medium">{vol.posicao_relativa}</p>
                            </div>
                            <div>
                              <p className="text-neutral-500 uppercase text-[9px] mb-0.5">Proporção H:L</p>
                              <p className="font-medium">{vol.proporcao_H_x_L}</p>
                            </div>
                          </div>
                          {vol.relacao_com_volume_anterior && (
                            <div className="pt-2 border-t border-neutral-200/50 dark:border-neutral-800/50">
                              <p className="text-neutral-500 uppercase text-[9px] mb-0.5">Relação Espacial</p>
                              <p className="text-xs italic">{vol.relacao_com_volume_anterior}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Openings Analysis Section */}
          {result.openings && result.openings.length > 0 && (
            <div className="mt-10 pt-10 border-t border-neutral-100 dark:border-neutral-800 space-y-8">
              <div className="flex items-center justify-between">
                <h5 className="font-bold flex items-center gap-2 text-secondary">
                  <Home className="w-4 h-4" />
                  Sistemas de Aberturas e Esquadrias
                </h5>
                <button 
                  onClick={() => setShowOpenings(!showOpenings)}
                  className="text-xs font-bold text-secondary flex items-center gap-1 hover:underline"
                >
                  {showOpenings ? <><ChevronUp size={14} /> Recolher</> : <><ChevronDown size={14} /> Expandir</>}
                </button>
              </div>

              <AnimatePresence>
                {showOpenings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {result.openings.map((op: any) => (
                        <div key={op.id} className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">{op.quantidade_e_ritmo}</span>
                            <span className="text-[9px] font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded uppercase">{op.posicao_na_fachada}</span>
                          </div>
                          <p className="font-bold text-sm text-neutral-900 dark:text-white capitalize">{op.tipo_abertura.replace(/_/g, ' ')}</p>
                          <div className="space-y-1 text-[11px]">
                            <p className="text-neutral-500"><span className="font-bold text-neutral-700 dark:text-neutral-300">Perfil:</span> {op.material_perfil}</p>
                            <p className="text-neutral-500"><span className="font-bold text-neutral-700 dark:text-neutral-300">Vidro:</span> {op.tipo_vidro}</p>
                            <p className="text-neutral-500"><span className="font-bold text-neutral-700 dark:text-neutral-300">Prop:</span> {op.proporcao_H_L}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Structural Highlights Section */}
          {result.structural_highlights && result.structural_highlights.length > 0 && (
            <div className="mt-10 pt-10 border-t border-neutral-100 dark:border-neutral-800 space-y-8">
              <div className="flex items-center justify-between">
                <h5 className="font-bold flex items-center gap-2 text-warning">
                  <Zap className="w-4 h-4" />
                  Destaques Estruturais
                </h5>
                <button 
                  onClick={() => setShowStructural(!showStructural)}
                  className="text-xs font-bold text-warning flex items-center gap-1 hover:underline"
                >
                  {showStructural ? <><ChevronUp size={14} /> Recolher</> : <><ChevronDown size={14} /> Expandir</>}
                </button>
              </div>

              <AnimatePresence>
                {showStructural && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {result.structural_highlights.map((sh: any) => (
                        <div key={sh.id} className="bg-warning/5 p-4 rounded-2xl border border-warning/20 space-y-2">
                          <p className="text-[10px] font-bold text-warning uppercase">{sh.tipo}</p>
                          <p className="font-bold text-neutral-900 dark:text-white">{sh.material}</p>
                          <p className="text-xs text-neutral-500">{sh.dimensao}</p>
                          <p className="text-[10px] italic text-neutral-400">{sh.acabamento}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Ambientes Analysis Section (Floor Plan Only) */}
          {result.isFloorPlan && result.ambientes && (
            <div className="mt-10 pt-10 border-t border-neutral-100 dark:border-neutral-800 space-y-8">
              <div className="flex items-center justify-between">
                <h5 className="font-bold flex items-center gap-2 text-primary">
                  <Home className="w-4 h-4" />
                  Inventário de Ambientes Detectados
                </h5>
                <button 
                  onClick={() => setShowAmbientes(!showAmbientes)}
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  {showAmbientes ? <><ChevronUp size={14} /> Recolher</> : <><ChevronDown size={14} /> Expandir</>}
                </button>
              </div>

              <AnimatePresence>
                {showAmbientes && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {result.ambientes.map((amb: any) => (
                        <div key={amb.id} className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">ID: {amb.id}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              amb.tipo === 'molhado' ? 'bg-blue-500/10 text-blue-500' :
                              amb.tipo === 'externo' ? 'bg-green-500/10 text-green-500' :
                              amb.tipo === 'servico' ? 'bg-neutral-500/10 text-neutral-500' :
                              'bg-primary/10 text-primary'
                            }`}>
                              {amb.tipo}
                            </span>
                          </div>
                          <p className="font-bold text-neutral-900 dark:text-white">{amb.nome}</p>
                          {amb.area_m2 && <p className="text-xs text-neutral-500">{amb.area_m2}m²</p>}
                          {amb.equipamentos_fixos && amb.equipamentos_fixos.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {amb.equipamentos_fixos.map((eq: string, idx: number) => (
                                <span key={idx} className="text-[9px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">
                                  {eq}
                                </span>
                              ))}
                            </div>
                          )}
                          {amb.veiculos && amb.veiculos.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {amb.veiculos.map((veic: string, idx: number) => (
                                <span key={idx} className="text-[9px] bg-primary/5 dark:bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded text-primary font-bold flex items-center gap-1">
                                  <span className="opacity-70">🚗</span> {veic}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

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

      {/* Redo Confirmation Modal */}
      {showRedoConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
          >
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center text-warning">
                  <RefreshCw size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Refazer Análise</h3>
                  <p className="text-xs text-neutral-500">Isto irá custar 5 créditos</p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-4">
              <p className="text-neutral-600 dark:text-neutral-400">
                Você tem certeza que deseja refazer a análise do diagnóstico? Isso irá consumir mais 5 créditos da sua conta.
              </p>
              <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
                <p className="text-sm font-bold text-warning flex items-center gap-2">
                  <AlertCircle size={16} />
                  Esta ação não pode ser desfeita
                </p>
              </div>
            </div>

            <div className="p-8 bg-neutral-50 dark:bg-neutral-800/50 flex items-center gap-3">
              <button
                onClick={cancelRedo}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRedo}
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                Sim, Refazer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DiagnosisStep;
