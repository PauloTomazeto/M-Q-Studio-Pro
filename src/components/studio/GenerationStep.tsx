import React, { useEffect, useState, useRef } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { useCredits } from '../../hooks/useCredits';
import { kieService } from '../../services/kieService';
import { compressImage, uploadBase64ViaProxy } from '../../services/storageService';
import { auth, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  Loader2, Download, Share2, CheckCircle2, AlertCircle, 
  Image as ImageIcon, RefreshCw, Maximize2, Monitor, 
  Smartphone, Square, Layout, Zap, Crown, Eye, Clock, Upload,
  RotateCcw, Sparkles, ArrowRight, Info
} from 'lucide-react';
import { toast } from 'sonner';
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
    setMirrorImage,
    mainImageUrl,
    setMainImageUrl,
    mirrorImageUrl,
    setMirrorImageUrl,
    setBase64Image,
    setIsGenerating,
    setGenerationTask,
    setSelectedAspectRatio
  } = useStudioStore();
  
  const [isUploadingMain, setIsUploadingMain] = useState(false);
  const [isUploadingMirror, setIsUploadingMirror] = useState(false);
  
  const { consumeCredits, refundCredits } = useCredits();
  const [showPreview, setShowPreview] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

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
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const handleGenerate = async () => {
    const activePrompt = getActivePrompt();
    if (!activePrompt) return;
    
    setIsGenerating(true);
    const startTime = Date.now();
    startTimeRef.current = startTime;

    setGenerationTask({
      taskId: 'pending',
      status: 'queued',
      progress: 0,
      stage: 'Iniciando...',
      startTime
    });

    // Start progress timer
    const totalDuration = 240; // seconds
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

    const resConfig = RESOLUTIONS.find(r => r.id === selectedResolution);
    const cost = resConfig?.cost || 5;

    try {
      const hasCredits = await consumeCredits(cost, 'image_generation');
      if (!hasCredits) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setGenerationTask({
          taskId: 'error',
          status: 'failed',
          progress: 0,
          error: 'Créditos insuficientes.'
        });
        setIsGenerating(false);
        return;
      }

      // DIRECT BASE64 FLOW REPLACED BY PROXY URL FLOW
      const { mainImageUrl, mirrorImageUrl, sessionId } = useStudioStore.getState();
      
      if (!mainImageUrl) {
        throw new Error('Você deve anexar a Imagem Principal para a geração.');
      }

      // Prepare image input array (main URL + mirror URL if exists)
      const image_input = [mainImageUrl];
      if (mirrorImageUrl) {
        image_input.push(mirrorImageUrl);
      }

      // Call generation service with URLs as input
      const taskId = await kieService.generateImage({
        prompt: activePrompt,
        model: selectedModel,
        resolution: selectedResolution,
        aspect_ratio: selectedAspectRatio,
        image_input
      });
      
      setGenerationTask((prev: any) => ({
        ...prev,
        taskId,
        status: 'processing',
        stage: 'Tarefa criada no servidor'
      }));

      if (sessionId) {
        updateDoc(doc(db, 'generation_sessions', sessionId), {
          userId: auth.currentUser?.uid,
          taskId,
          generationStatus: 'processing',
          updatedAt: new Date().toISOString()
        }).catch(e => console.warn('Falha ao atualizar sessão no Firestore:', e));
      }

      // Start polling
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const task = await kieService.getTaskStatus(taskId);
          
          if (task.status === 'completed' || task.status === 'success') {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            
            const resultUrl = task.works?.[0]?.url || task.result_url;
            
            setGenerationTask({
              taskId,
              status: 'completed',
              progress: 100,
              stage: 'Concluído!',
              resultUrl
            });
            setIsGenerating(false);

            if (sessionId) {
              updateDoc(doc(db, 'generation_sessions', sessionId), {
                userId: auth.currentUser?.uid,
                generationResultUrl: resultUrl,
                generationStatus: 'completed',
                completedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }).catch(e => console.warn('Falha ao concluir sessão no Firestore:', e));
            }
          } else if (task.status === 'failed' || task.status === 'error') {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            setGenerationTask({
              taskId,
              status: 'failed',
              progress: 0,
              error: task.msg || 'Falha na geração da imagem.'
            });
            setIsGenerating(false);
            await refundCredits(cost, 'generation_failed');

            if (sessionId) {
              updateDoc(doc(db, 'generation_sessions', sessionId), {
                userId: auth.currentUser?.uid,
                generationStatus: 'failed',
                generationError: task.msg || 'Falha na geração da imagem.',
                updatedAt: new Date().toISOString()
              }).catch(e => console.warn('Falha ao reportar erro no Firestore:', e));
            }
          }
        } catch (err: any) {
          console.error('Polling error:', err);
        }
      }, 5000);

    } catch (err: any) {
      console.error(err);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setGenerationTask({
        taskId: 'error',
        status: 'failed',
        progress: 0,
        error: err.message || 'Erro ao iniciar geração.'
      });
      setIsGenerating(false);
      await refundCredits(cost, 'generation_init_failed');
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
            <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Zap size={20} />
                </div>
                <h3 className="text-lg font-bold">Escolha o Modelo</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedModel('nano-banana-2')}
                  className={`p-6 rounded-2xl border-2 text-left transition-all ${
                    selectedModel === 'nano-banana-2'
                      ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                      : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">Nano Banana 2</span>
                    {selectedModel === 'nano-banana-2' && <CheckCircle2 size={18} className="text-primary" />}
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Equilíbrio perfeito entre velocidade e qualidade. Ideal para prévias e iterações rápidas.
                  </p>
                </button>

                <button
                  onClick={() => setSelectedModel('nano-banana-pro')}
                  className={`p-6 rounded-2xl border-2 text-left transition-all ${
                    selectedModel === 'nano-banana-pro'
                      ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                      : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">Nano Banana Pro</span>
                      <Crown size={14} className="text-amber-500" />
                    </div>
                    {selectedModel === 'nano-banana-pro' && <CheckCircle2 size={18} className="text-primary" />}
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Máxima fidelidade e realismo. Recomendado para entregas finais e portfólio.
                  </p>
                </button>
              </div>
            </div>

            {/* Prompt Preview */}
            <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                    <Layout size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Prompt de Geração</h3>
                </div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  {getActivePrompt()?.length || 0} caracteres
                </span>
              </div>
              
              <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed italic">
                  "{getActivePrompt() || 'Nenhum prompt gerado...'}"
                </p>
              </div>
            </div>

            {/* Image References / Manual Attachment */}
            <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Imagens de Referência</h3>
                    <p className="text-xs text-neutral-500">O modelo usará estas imagens como base para a geração.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Main Image Card (Manual Attachment Required) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Imagem Principal</span>
                    <div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[10px] font-bold">OBRIGATÓRIO</div>
                  </div>

                  {base64Image ? (
                    <div className="aspect-video rounded-2xl border border-emerald-500/30 overflow-hidden bg-neutral-50 dark:bg-neutral-900/50 group relative">
                      <img src={base64Image} className="w-full h-full object-contain" alt="Main Architecture" />
                      {!mainImageUrl && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                           <Loader2 className="animate-spin text-white" size={24} />
                           <span className="text-[10px] text-white font-bold">FINALIZANDO UPLOAD...</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button 
                          onClick={() => { setBase64Image(null); setMainImageUrl(null); }}
                          className="px-4 py-2 bg-error text-white rounded-xl text-xs font-bold hover:scale-105 transition-transform"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className={`aspect-video rounded-2xl border-2 border-dashed border-emerald-200 dark:border-neutral-800 hover:border-emerald-500/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 bg-emerald-50/10 dark:bg-emerald-900/10 ${isUploadingMain ? 'pointer-events-none opacity-50' : ''}`}>
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                        {isUploadingMain ? <Loader2 className="animate-spin" size={24} /> : <Upload size={24} />}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          {isUploadingMain ? 'Processando...' : 'Anexar Imagem Principal'}
                        </p>
                        <p className="text-[10px] text-neutral-500 mt-1">Este passo garante a integridade do envio</p>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              setIsUploadingMain(true);
                              const compressed = await compressImage(file, 0.95, 1024);
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                const b64 = reader.result as string;
                                setBase64Image(b64);
                                try {
                                  const url = await uploadBase64ViaProxy(b64, 'main_generation');
                                  setMainImageUrl(url);
                                } catch (err) {
                                  toast.error('Erro no upload para o servidor');
                                  setBase64Image(null);
                                } finally {
                                  setIsUploadingMain(false);
                                }
                              };
                              reader.readAsDataURL(compressed);
                            } catch (err) {
                              console.error('Falha ao processar imagem principal:', err);
                              setIsUploadingMain(false);
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Mirror/Reference Image Card */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Referência / Espelho</span>
                    <div className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded text-[10px] font-bold uppercase">Manual</div>
                  </div>
                  
                  {mirrorImage ? (
                    <div className="aspect-video rounded-2xl border border-primary/30 overflow-hidden bg-neutral-50 dark:bg-neutral-900/50 group relative">
                      <img src={mirrorImage} className="w-full h-full object-contain" alt="Mirror Reference" />
                      {!mirrorImageUrl && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                           <Loader2 className="animate-spin text-white" size={24} />
                           <span className="text-[10px] text-white font-bold">FINALIZANDO UPLOAD...</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button 
                          onClick={() => { setMirrorImage(null); setMirrorImageUrl(null); }}
                          className="px-4 py-2 bg-error text-white rounded-xl text-xs font-bold hover:scale-105 transition-transform"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className={`aspect-video rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 bg-neutral-50/50 dark:bg-neutral-900/30 ${isUploadingMirror ? 'pointer-events-none opacity-50' : ''}`}>
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        {isUploadingMirror ? <Loader2 className="animate-spin" size={24} /> : <Maximize2 size={24} />}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold">{isUploadingMirror ? 'Processando...' : 'Anexar Complemento'}</p>
                        <p className="text-[10px] text-neutral-500 mt-1">Clique ou arraste um arquivo</p>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              setIsUploadingMirror(true);
                              const compressed = await compressImage(file, 0.9, 1024);
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                const b64 = reader.result as string;
                                setMirrorImage(b64);
                                try {
                                  const url = await uploadBase64ViaProxy(b64, 'mirror_reference');
                                  setMirrorImageUrl(url);
                                } catch (err) {
                                  toast.error('Erro no upload para o servidor');
                                  setMirrorImage(null);
                                } finally {
                                  setIsUploadingMirror(false);
                                }
                              };
                              reader.readAsDataURL(compressed);
                            } catch (err) {
                              console.error('Falha ao processar anexo manual:', err);
                              setIsUploadingMirror(false);
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                  <p className="text-[10px] text-neutral-400 italic">
                    {hasMirror 
                      ? "* Sistema detectou necessidade de reflexo. Recomendamos um anexo." 
                      : "* Opcional: Use para referenciar reflexos ou variações."}
                  </p>
                </div>
              </div>
            </div>

            {/* Technical Config Summary */}
            <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                  <RefreshCw size={20} />
                </div>
                <h3 className="text-lg font-bold">Configurações Técnicas Aplicadas</h3>
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

            {/* Resolution & Aspect Ratio */}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
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

              <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
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
                    initial={{ strokeDashoffset: 565 }}
                    animate={{ strokeDashoffset: 565 - (565 * (generationTask?.progress || 0)) / 100 }}
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
                      <span>{Math.floor((Date.now() - (generationTask.startTime)) / 1000)}s / 240s</span>
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
                  Estágio: {generationTask.stage}
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  disabled={generationTask.progress < 50}
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
                  animate={{ width: `${generationTask.progress}%` }}
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
              onClick={() => setShowPreview(false)}
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
