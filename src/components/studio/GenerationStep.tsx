import React, { useEffect, useState, useRef } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { useCredits } from '../../hooks/useCredits';
import kieService from '../../services/kieService';
import storageService, { uploadTempImage, compressImage } from '../../services/storageService';
import imageGenerationService from '../../services/imageGenerationService';
import { supabase, getCurrentUser } from '../../supabase';
import { 
  Loader2, Download, Share2, CheckCircle2, AlertCircle, 
  Image as ImageIcon, RefreshCw, Maximize2, Monitor, 
  Smartphone, Square, Layout, Zap, Crown, Eye, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STAGES = [
  { id: 'initializing', label: 'Inicializando...', progress: 5 },
  { id: 'encoding_prompt', label: 'Codificando Prompt...', progress: 15 },
  { id: 'model_processing', label: 'Processamento do Modelo...', progress: 40 },
  { id: 'rendering', label: 'Renderizando...', progress: 70 },
  { id: 'post_processing', label: 'Pós-processamento...', progress: 90 },
  { id: 'finalizing', label: 'Finalizando...', progress: 100 }
];

const RESOLUTIONS = [
  { id: '1K', label: '1K (1024x768)', cost: 2, time: '~20-30s' },
  { id: '2K', label: '2K (2560x1920)', cost: 5, time: '~30-40s' },
  { id: '3K', label: '3K (3840x2880)', cost: 12, time: '~60-80s' },
  { id: '4K', label: '4K (4096x3072)', cost: 20, time: '~80-120s' }
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1', icon: Square },
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '4:3', label: '4:3', icon: Layout },
  { id: '3:4', label: '3:4', icon: Layout },
  { id: '5:4', label: '5:4', icon: Layout },
  { id: '4:5', label: '4:5', icon: Layout }
];

const MODELS = [
  { id: 'nano-banana-2', label: 'Nano Banana 2', description: 'Ótimo para imagens arquitetônicas detalhadas', costMultiplier: 1 },
  { id: 'nano-banana-pro', label: 'Nano Banana Pro', description: 'Ultra realismo e renderizações de alto nível', costMultiplier: 1.5 }
];

const GenerationStep: React.FC = () => {
  const { 
    generatedPrompt, 
    generatedBlocks, 
    configParams, 
    setStep,
    selectedModel,
    selectedResolution,
    selectedAspectRatio,
    generationTask,
    isGenerating,
    base64Image,
    scanResult,
    mirrorImage,
    setSelectedModel,
    setSelectedResolution,
    setSelectedAspectRatio,
    setGenerationTask,
    setIsGenerating,
    setMirrorImage
  } = useStudioStore();
  
  const { consumeCredits, refundCredits } = useCredits();
  const [showPreview, setShowPreview] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getActivePrompt = () => {
    if (configParams.promptMode === 'single') return generatedPrompt;
    if (generatedBlocks && generatedBlocks.length > 0) {
      return generatedBlocks.map(b => b.content).join('\n\n');
    }
    return null;
  };

  const currentStage = STAGES.find(s => (generationTask?.progress || 0) <= s.progress) || STAGES[STAGES.length - 1];
  const hasMirror = scanResult?.materials?.some((m: any) => m.reflectancia === 'espelhado');

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const handleGenerate = async () => {
    const activePrompt = getActivePrompt();
    if (!activePrompt) return;
    
    setIsGenerating(true);
    const startTime = Date.now();
    startTimeRef.current = startTime;

    // Create initial document in Firestore via Service
    const resConfig = RESOLUTIONS.find(r => r.id === selectedResolution);
    const modelConfig = MODELS.find(m => m.id === selectedModel) || MODELS[0];
    const cost = Math.ceil((resConfig?.cost || 5) * modelConfig.costMultiplier);

    try {
      const user = await getCurrentUser();
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const hasCredits = await consumeCredits(cost, 'image_generation');

      if (!hasCredits) {
        setGenerationTask({
          taskId: 'error',
          status: 'failed',
          progress: 0,
          error: 'Créditos insuficientes.'
        });
        setIsGenerating(false);
        return;
      }

      // 1. Prepare UI state
      setGenerationTask({
        taskId: 'pending',
        status: 'queued',
        progress: 0,
        stage: 'Iniciando...',
        startTime
      });

      // Start visual progress simulation (caps at 95% until DB updates)
      const totalDuration = 240; 
      const targetProgress = 95;
      const incrementPerSecond = targetProgress / totalDuration;

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
        setGenerationTask((prev: any) => {
          if (!prev || (prev.status !== 'queued' && prev.status !== 'processing')) return prev;
          const elapsed = (Date.now() - startTime) / 1000;
          const nextProgress = Math.min(elapsed * incrementPerSecond, targetProgress);
          const stage = STAGES.find(s => nextProgress <= s.progress)?.label || 'Processando...';
          return { ...prev, progress: nextProgress, stage };
        });
      }, 1000);

      // 2. Prepare images
      const image_input: string[] = [];
      const processImageForUpload = async (base64: string) => {
        const parts = base64.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
        const file = new File([new Blob([uInt8Array], { type: contentType })], 'temp.jpg', { type: contentType });
        return await compressImage(file, 0.9, 2048);
      };

      if (base64Image) {
        const compressed = await processImageForUpload(base64Image);
        const { url } = await uploadTempImage(compressed, user.id);
        image_input.push(url);
      }
      
      if (mirrorImage) {
        const compressed = await processImageForUpload(mirrorImage);
        const { url } = await uploadTempImage(compressed, user.id);
        image_input.push(url);
      }

      // 3. Call KIE API
      const apiResponse: any = await kieService.generateImage({
        prompt: activePrompt,
        model: selectedModel,
        resolution: selectedResolution,
        aspect_ratio: selectedAspectRatio,
        image_input
      });

      let taskId = '';
      let directUrl = '';

      if (typeof apiResponse === 'string' && apiResponse.startsWith('DIRECT_URL:')) {
        directUrl = apiResponse.replace('DIRECT_URL:', '');
        taskId = `direct_${Date.now()}`;
      } else if (typeof apiResponse === 'object' && apiResponse.taskId) {
        taskId = apiResponse.taskId;
      }

      // 4. Register generation in DB (The "Banco a Banco" start point)
      const { sessionId } = useStudioStore.getState();
      const generationDoc: any = {
        image_generation_id: taskId,
        user_id: user.id,
        session_id: sessionId || 'temp_session',
        prompt_content: activePrompt,
        generation_status: directUrl ? 'completed' : 'processing',
        progress_percentage: directUrl ? 100 : 5,
        progress_stage: directUrl ? 'finalizing' : 'initializing',
        created_at: new Date().toISOString(),
        is_completed: !!directUrl,
        image_url_4k: directUrl || null,
        image_url_preview: directUrl || null
      };
      
      const { error: insertError } = await supabase
        .from('image_generations')
        .insert({
          id: taskId,
          ...generationDoc
        });

      if (insertError) throw insertError;

      // 5. Start Real-time DB Listening (UI ONLY reacts to DB changes)
      if (unsubscribeRef.current) unsubscribeRef.current();
      unsubscribeRef.current = imageGenerationService.subscribeToGeneration(taskId, (data) => {
        const resultUrl = data.image_url_4k || data.image_url_preview || (Array.isArray(data) ? data[0] : null) || data.resultUrls?.[0];
        
        if (data.is_completed || data.generation_status === 'completed' || resultUrl) {
          if (unsubscribeRef.current) unsubscribeRef.current();
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          
          setGenerationTask({
            taskId,
            status: 'completed',
            progress: 100,
            stage: 'Concluído!',
            resultUrl
          });
          setIsGenerating(false);
        } else if (data.generation_status === 'failed') {
          if (unsubscribeRef.current) unsubscribeRef.current();
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setGenerationTask({
            taskId,
            status: 'failed',
            progress: 0,
            error: data.error_message || 'Falha na geração.'
          });
          setIsGenerating(false);
          refundCredits(cost, 'generation_failed');
        }
      });

      // 6. Start HYBRID WORKER (Background Polling that writes to DB)
      // This is necessary for localhost because webhooks won't reach us.
      if (!directUrl) {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = setInterval(async () => {
          try {
            const pollResponse: any = await kieService.checkImageTaskStatus(taskId);
            const data = pollResponse.data || pollResponse;
            
            // Extract completion status or result URLs
            const isCompleted = data.status === 'completed' || 
                               data.status === 'success' || 
                               (Array.isArray(data) && data.length > 0) ||
                               (data.resultUrls && data.resultUrls.length > 0);
            
            const isFailed = data.status === 'failed' || data.status === 'error';

            if (isCompleted) {
              const resultUrl = (Array.isArray(data) ? data[0] : null) || 
                                data.resultUrls?.[0] || 
                                data.works?.[0]?.url || 
                                data.result_url;
              
              // WORKER WRITES TO DB (UI will catch this via onSnapshot)
              await imageGenerationService.completeWithUrl(taskId, resultUrl);
              if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            } else if (isFailed) {
              await imageGenerationService.fail(taskId, data.msg || 'API Error');
              if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            }
          } catch (err) {
            console.error('Hybrid Worker Error:', err);
          }
        }, 5000);
      }

    } catch (err: any) {
      console.error('Generation Error:', err);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setGenerationTask({
        taskId: 'error',
        status: 'failed',
        progress: 0,
        error: err.message || 'Erro inesperado.'
      });
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `mqstudio_gen_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Renderização Final</h2>
          <p className="text-neutral-500 mt-1">Configure os parâmetros de saída e inicie a geração fotorrealista.</p>
        </div>
        <button
          onClick={() => setStep('result')}
          className="px-4 py-2 text-sm font-bold text-neutral-500 hover:text-primary transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Voltar ao Prompt
        </button>
      </div>

      {!generationTask || generationTask.status === 'failed' ? (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Model Selection */}
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-sm border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Zap size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Modelo de IA</h2>
                  <p className="text-sm text-neutral-500">Escolha a versão do Nano Banana para a renderização</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {MODELS.map(model => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id as any)}
                    className={`text-left p-4 rounded-2xl border-2 transition-all ${
                      selectedModel === model.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      {model.label}
                      {model.id === 'nano-banana-pro' && <Crown size={16} className="text-yellow-500" />}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">{model.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Preview */}
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-sm border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                  <Layout size={20} />
                </div>
                <h2 className="text-xl font-bold">Prompt de Geração</h2>
              </div>
              
              <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed italic">
                  "{getActivePrompt() || 'Nenhum prompt gerado...'}"
                </p>
              </div>
            </div>

            {/* Image References */}
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-sm border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                  <ImageIcon size={20} />
                </div>
                <h2 className="text-xl font-bold">Imagens de Referência</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Original Image */}
                <div className="space-y-2">
                  <div className="aspect-square rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                    {base64Image ? (
                      <img src={base64Image} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <ImageIcon size={24} />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-center text-neutral-400 uppercase">Original</p>
                </div>

                {/* Mirror Image */}
                {hasMirror && (
                  <div className="space-y-2">
                    <div className="aspect-square rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-100 dark:bg-neutral-900 relative group">
                      {mirrorImage ? (
                        <img src={mirrorImage} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300">
                          <Eye size={24} />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-center text-neutral-400 uppercase">Espelho</p>
                  </div>
                )}
              </div>
            </div>

            {/* Technical Config Summary */}
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-sm border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                  <RefreshCw size={20} />
                </div>
                <h2 className="text-xl font-bold">Configurações Técnicas Aplicadas</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Atmosfera</p>
                  <p className="text-sm font-bold capitalize">{configParams.atmosphere_type || 'Padrão'}</p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Ambiente</p>
                  <p className="text-sm font-bold capitalize">{configParams.environmentType?.replace('_', ' ') || 'Padrão'}</p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Color Grading</p>
                  <p className="text-sm font-bold capitalize">{configParams.color_grading_preset || 'Padrão'}</p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Efeitos Bloom</p>
                  <p className="text-sm font-bold capitalize">{configParams.bloom_enabled ? 'Bloom Ativo' : 'Nenhum'}</p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Profundidade</p>
                  <p className="text-sm font-bold capitalize">{configParams.dofEnabled ? 'DoF Ativo' : 'Infinito'}</p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Modo Prompt</p>
                  <p className="text-sm font-bold capitalize">{configParams.promptMode}</p>
                </div>
              </div>
              
              <p className="text-[10px] text-neutral-400 italic">
                * Todas as configurações acima foram incorporadas ao prompt final para garantir a máxima fidelidade técnica.
              </p>
            </div>

            {/* Mirror Image Upload (Conditional) */}
            {hasMirror && (
              <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-sm border border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Imagem do Espelho</h2>
                    <p className="text-xs text-neutral-500">Detectamos um espelho. Para melhor realismo, envie o que ele deve refletir.</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 flex items-center justify-center overflow-hidden bg-neutral-50 dark:bg-neutral-900/50">
                    {mirrorImage ? (
                      <img src={mirrorImage} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={32} className="text-neutral-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <label className="block">
                      <span className="sr-only">Escolher imagem do espelho</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setMirrorImage(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                      />
                    </label>
                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                      Envie uma foto do ambiente oposto ao espelho ou uma imagem de referência para o reflexo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Resolution & Aspect Ratio */}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-sm border border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Resolução de Saída</h3>
                <div className="space-y-3">
                  {RESOLUTIONS.map((res) => (
                    <button
                      key={res.id}
                      onClick={() => setSelectedResolution(res.id as any)}
                      className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                        selectedResolution === res.id
                          ? "border-primary bg-primary/5"
                          : "border-neutral-50 dark:border-neutral-800 hover:border-neutral-100"
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-bold">{res.label}</div>
                        <div className="text-[10px] text-neutral-500">{res.time}</div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black ${
                        selectedResolution === res.id ? "bg-primary text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                      }`}>
                        {res.cost} CRÉDITOS
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-8 shadow-sm border border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Formato (Aspect Ratio)</h3>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((ratio) => {
                    const Icon = ratio.icon;
                    return (
                      <button
                        key={ratio.id}
                        onClick={() => setSelectedAspectRatio(ratio.id as any)}
                        className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                          selectedAspectRatio === ratio.id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-neutral-50 dark:border-neutral-800 text-neutral-500 hover:border-neutral-100"
                        }`}
                      >
                        <Icon size={20} />
                        <span className="text-[10px] font-bold">{ratio.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-primary/5 border border-primary/10 p-8 rounded-3xl space-y-6">
              <h3 className="font-bold text-lg">Resumo da Geração</h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Modelo:</span>
                  <span className="font-bold uppercase">{selectedModel.replace('nano-banana-', '')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Resolução:</span>
                  <span className="font-bold">{selectedResolution}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Formato:</span>
                  <span className="font-bold">{selectedAspectRatio}</span>
                </div>
                <div className="pt-4 border-t border-primary/10 flex justify-between items-center">
                  <span className="font-bold">Custo Total:</span>
                  <div className="flex items-center gap-2 text-primary">
                    <Zap size={18} className="fill-primary" />
                    <span className="text-2xl font-black">{RESOLUTIONS.find(r => r.id === selectedResolution)?.cost}</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !getActivePrompt()}
                className="w-full bg-primary hover:bg-primary-dark text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-3 text-lg disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="animate-spin" /> : <ImageIcon size={24} />}
                GERAR IMAGEM
              </button>
              
              <p className="text-[10px] text-center text-neutral-400 leading-relaxed">
                Ao clicar em gerar, os créditos serão debitados imediatamente. Em caso de falha técnica, o estorno é automático.
              </p>
            </div>

            {generationTask?.status === 'failed' && (
              <div className="bg-error/10 border border-error/20 p-6 rounded-2xl flex items-start gap-4">
                <AlertCircle className="text-error shrink-0" size={20} />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-error">Erro na Geração</p>
                  <p className="text-xs text-error/80">{generationTask.error}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {generationTask.status === 'completed' ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xl">
                  <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 relative group">
                    <img 
                      src={generationTask.resultUrl} 
                      alt="Generated Result" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                      <button 
                        onClick={() => handleDownload(generationTask.resultUrl!)}
                        className="p-4 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl"
                      >
                        <Download size={24} />
                      </button>
                    </div>
                  </div>
                  <div className="p-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center text-success">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Geração Concluída</h3>
                        <p className="text-sm text-neutral-500">Sua imagem fotorrealista está pronta para uso.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button className="px-6 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl font-bold hover:bg-neutral-200 transition-colors flex items-center gap-2">
                        <Share2 size={18} />
                        Compartilhar
                      </button>
                      <button 
                        onClick={() => handleDownload(generationTask.resultUrl!)}
                        className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                      >
                        <Download size={18} />
                        Download {selectedResolution}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                  <h3 className="font-bold">Detalhes Técnicos</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm py-2 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Modelo:</span>
                      <span className="font-bold uppercase">{selectedModel}</span>
                    </div>
                    <div className="flex justify-between text-sm py-2 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Resolução:</span>
                      <span className="font-bold">{selectedResolution}</span>
                    </div>
                    <div className="flex justify-between text-sm py-2 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500">Formato:</span>
                      <span className="font-bold">{selectedAspectRatio}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setGenerationTask(null)}
                    className="w-full py-4 border-2 border-neutral-100 dark:border-neutral-800 rounded-2xl font-bold hover:bg-neutral-50 transition-colors"
                  >
                    Nova Geração
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 p-16 rounded-[3rem] border border-neutral-200 dark:border-neutral-800 shadow-xl text-center space-y-12 max-w-4xl mx-auto">
              <div className="relative w-48 h-48 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="90"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className="text-neutral-100 dark:text-neutral-800"
                  />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="90"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={565}
                    animate={{ strokeDashoffset: 565 - (565 * (generationTask?.progress ?? 0)) / 100 }}
                    className="text-primary"
                    transition={{ duration: 0.5 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-primary">{Math.round(generationTask?.progress || 0)}%</span>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Progresso</span>
                  {generationTask?.startTime && (
                    <div className="flex items-center gap-1 mt-2 text-neutral-500 font-mono text-xs">
                      <Clock size={12} />
                      <span>{Math.floor((Date.now() - generationTask.startTime) / 1000)}s / 240s</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-2xl font-bold tracking-tight">Gerando sua Obra-Prima</h3>
                <p className="text-neutral-500 max-w-md mx-auto">
                  Nossa IA está processando cada detalhe técnico para garantir o máximo fotorrealismo.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary rounded-full text-sm font-bold">
                  <Loader2 className="animate-spin" size={16} />
                  Estágio: {generationTask?.stage || 'Processando...'}
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  disabled={(generationTask?.progress || 0) < 50}
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-2 px-8 py-4 bg-white dark:bg-neutral-800 border-2 border-neutral-100 dark:border-neutral-700 rounded-2xl font-bold hover:border-primary transition-all disabled:opacity-30"
                >
                  <Eye size={20} />
                  Ver Preview (50%+)
                </button>
              </div>

              <div className="w-full max-w-lg mx-auto h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-primary"
                  animate={{ width: `${generationTask?.progress || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white dark:bg-neutral-900 rounded-[2rem] overflow-hidden max-w-5xl w-full shadow-2xl"
            >
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="font-bold text-lg">Preview da Geração</h3>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                >
                  <RefreshCw size={20} />
                </button>
              </div>
              <div className="aspect-video bg-black flex items-center justify-center">
                <div className="text-center space-y-4">
                  <ImageIcon size={48} className="text-neutral-700 mx-auto" />
                  <p className="text-neutral-500 text-sm">Preview em baixa resolução sendo processado...</p>
                </div>
              </div>
              <div className="p-8 bg-neutral-50 dark:bg-neutral-800/50 text-center">
                <p className="text-sm text-neutral-500 max-w-lg mx-auto">
                  Este é um preview de baixa fidelidade. A imagem final terá resolução {selectedResolution} com processamento PBR completo.
                </p>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="mt-6 px-8 py-3 bg-primary text-white rounded-xl font-bold"
                >
                  Continuar Esperando
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GenerationStep;
