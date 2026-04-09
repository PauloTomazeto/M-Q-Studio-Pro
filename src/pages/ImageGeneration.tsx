import React, { useState, useEffect, useRef } from 'react';
import { 
  Wand2, Search, Filter, Loader2, History, ChevronRight, 
  CheckCircle2, AlertCircle, Download, Maximize2, RefreshCw,
  Square, Monitor, Smartphone, Layout, Zap, ArrowRight,
  Image as ImageIcon, Sparkles, Layers, Settings2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { kieService } from '../services/kieService';
import { useCredits } from '../hooks/useCredits';
import { uploadTempImage, compressImage } from '../services/storageService';
import confetti from 'canvas-confetti';
import { useLocation } from 'react-router-dom';
import { useStudioStore } from '../store/studioStore';
import PlanUpgradeModal from '../components/studio/PlanUpgradeModal';

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
  { id: '4K', label: '4K (3840x2160)', cost: 15, time: '~60-90s' }
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1', icon: Square },
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '4:3', label: '4:3', icon: Layout },
  { id: '3:4', label: '3:4', icon: Layout },
  { id: '2:3', label: '2:3', icon: Layout },
  { id: '3:2', label: '3:2', icon: Layout },
  { id: '4:5', label: '4:5', icon: Layout },
  { id: '5:4', label: '5:4', icon: Layout },
  { id: '21:9', label: '21:9', icon: Monitor },
  { id: 'auto', label: 'Auto', icon: Sparkles }
];

const ImageGeneration: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTask, setGenerationTask] = useState<any | null>(null);
  const [selectedModel, setSelectedModel] = useState<'nano-banana-pro'>('nano-banana-pro');
  const [selectedResolution, setSelectedResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('1:1');
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const { userPlan } = useStudioStore();
  const { consumeCredits, refundCredits } = useCredits();
  const location = useLocation();
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectId = params.get('projectId');
    if (projectId && projects.length > 0) {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setSelectedProject(project);
      }
    }
  }, [location.search, projects]);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const q = query(
      collection(db, 'projects'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setProjects(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!generationTask?.generationId || !isGenerating) return;

    const unsubscribe = onSnapshot(doc(db, 'image_generations', generationTask.generationId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        if (data.generationStatus === 'completed') {
          const resultUrl = data.imageUrl3k || data.imageUrl2k || data.imageUrl1k || data.imageUrlPreview;
          
          setGenerationTask((prev: any) => ({
            ...prev,
            status: 'completed',
            progress: 100,
            stage: 'Concluído!',
            resultUrl: resultUrl || prev.resultUrl
          }));
          setIsGenerating(false);
          
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        } else if (data.generationStatus === 'failed') {
          setGenerationTask((prev: any) => ({
            ...prev,
            status: 'failed',
            progress: 0,
            error: data.errorMessage || 'Falha na geração.'
          }));
          setIsGenerating(false);
          
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        } else if (data.progressPercentage !== undefined) {
          setGenerationTask((prev: any) => ({
            ...prev,
            progress: Math.max(prev.progress || 0, data.progressPercentage)
          }));
        }
      }
    });

    return () => unsubscribe();
  }, [generationTask?.generationId, isGenerating]);

  const handleGenerate = async () => {
    if (!selectedProject || isGenerating) return;

    const resConfig = RESOLUTIONS.find(r => r.id === selectedResolution);
    const cost = resConfig?.cost || 5;

    const hasCredits = await consumeCredits(cost, 'image_generation');
    if (!hasCredits) {
      setIsUpgradeModalOpen(true);
      return;
    }

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
    const totalDuration = 240; 
    const targetProgress = 95;
    const incrementPerSecond = targetProgress / totalDuration;

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      setGenerationTask((prev: any) => {
        if (!prev || prev.status === 'completed' || prev.status === 'failed') return prev;
        const elapsed = (Date.now() - startTime) / 1000;
        const nextProgress = Math.min(elapsed * incrementPerSecond, targetProgress);
        return { ...prev, progress: nextProgress, stage: 'Processando...' };
      });
    }, 1000);

    try {
      const image_input: string[] = [];
      const processImageForUpload = async (base64: string, name: string) => {
        const parts = base64.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) uInt8Array[i] = raw.charCodeAt(i);
        const blob = new Blob([uInt8Array], { type: contentType });
        const file = new File([blob], `${name}.jpg`, { type: contentType });
        return await compressImage(file, 0.8, 2048);
      };

      if (selectedProject.originalImage) {
        try {
          const compressedBlob = await processImageForUpload(selectedProject.originalImage, 'main');
          const { url } = await uploadTempImage(compressedBlob, auth.currentUser?.uid || 'anonymous');
          image_input.push(url);
        } catch (err) { console.error('Failed to upload main image:', err); }
      }

      if (selectedProject.mirrorImage) {
        try {
          const compressedBlob = await processImageForUpload(selectedProject.mirrorImage, 'mirror');
          const { url } = await uploadTempImage(compressedBlob, auth.currentUser?.uid || 'anonymous');
          image_input.push(url);
        } catch (err) { console.error('Failed to upload mirror image:', err); }
      }
      
      const { generationId, taskId } = await kieService.generateImage({
        prompt: selectedProject.prompt,
        model: selectedModel,
        resolution: selectedResolution as any,
        aspect_ratio: selectedAspectRatio,
        image_input,
        sessionId: selectedProject.id,
        creditsCost: cost
      });
      
      setGenerationTask({ 
        generationId, 
        status: 'processing', 
        progress: 10, 
        stage: 'Iniciando processamento...', 
        resultUrl: null 
      });

      // Iniciar polling
      const pollTask = async () => {
        try {
          const status = await kieService.getTaskStatus(taskId, generationId);
          if (status.isCompleted) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            setGenerationTask({
              generationId,
              status: 'completed',
              progress: 100,
              stage: 'Concluído!',
              resultUrl: status.resultUrl
            });

            // Update project with the new generated image
            const { arrayUnion } = await import('firebase/firestore');
            updateDoc(doc(db, 'projects', selectedProject.id), {
              lastResultUrl: status.resultUrl,
              generatedImages: arrayUnion({
                url: status.resultUrl,
                createdAt: new Date().toISOString(),
                resolution: selectedResolution,
                aspectRatio: selectedAspectRatio
              }),
              updatedAt: new Date().toISOString()
            }).catch(console.error);

            const confetti = (await import('canvas-confetti')).default;
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 }
            });
          } else if (status.isFailed) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            setGenerationTask({
              generationId,
              status: 'failed',
              progress: 0,
              stage: 'Erro na geração',
              resultUrl: null
            });
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      };

      progressIntervalRef.current = setInterval(pollTask, 3000);
      setIsGenerating(false);
      
    } catch (err: any) {
      console.error(err);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setGenerationTask({ status: 'failed', progress: 0, error: err.message || 'Erro ao iniciar geração.' });
      setIsGenerating(false);
      await refundCredits(cost, 'generation_init_failed');
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `mqstudio_gen_${selectedResolution}_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download image:', err);
      window.open(url, '_blank');
    }
  };

  const currentStage = STAGES.find(s => (generationTask?.progress || 0) <= s.progress) || STAGES[STAGES.length - 1];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Geração de Imagem</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Transforme seus prompts salvos em visualizações realistas.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Sidebar: Project Selection */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <History size={18} className="text-primary" />
                Projetos Salvos
              </h3>
              <span className="text-xs font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-lg">
                {projects.length}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : projects.length > 0 ? (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all group ${
                      selectedProject?.id === project.id 
                        ? "bg-primary/5 border-primary shadow-sm" 
                        : "bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${
                        selectedProject?.id === project.id ? "bg-primary text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                      }`}>
                        <ImageIcon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm truncate">{project.name}</h4>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight size={14} className={`flex-shrink-0 transition-transform ${
                        selectedProject?.id === project.id ? "text-primary translate-x-1" : "text-neutral-300"
                      }`} />
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 space-y-2">
                  <p className="text-xs text-neutral-500">Nenhum projeto salvo.</p>
                  <button className="text-xs text-primary font-bold hover:underline">Ir para o Studio</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Area: Generation Controls */}
        <div className="lg:col-span-2 space-y-8">
          <AnimatePresence mode="wait">
            {selectedProject ? (
              <motion.div
                key={selectedProject.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Project Preview */}
                <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <Sparkles size={24} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{selectedProject.name}</h2>
                        <p className="text-neutral-500 text-sm">Configurado e pronto para renderizar</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                        <ImageIcon size={14} />
                        Imagem Original
                      </h3>
                      <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
                        <img src={selectedProject.originalImage} className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                        <Layers size={14} />
                        Prompt Arquitetônico
                      </h3>
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 h-[150px] overflow-y-auto text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 italic">
                        "{selectedProject.prompt}"
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generation Config */}
                <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-8">
                  <div className="flex items-center gap-3">
                    <Settings2 size={20} className="text-primary" />
                    <h3 className="text-lg font-bold">Configurações de Renderização</h3>
                  </div>

                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Modelo</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {['nano-banana-pro'].map((m) => (
                          <button
                            key={m}
                            onClick={() => setSelectedModel(m as any)}
                            className={`p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                              selectedModel === m ? "border-primary bg-primary/5" : "border-neutral-50 dark:border-neutral-800"
                            }`}
                          >
                            <span className="text-sm font-bold capitalize">{m.replace('nano-banana-', '')}</span>
                            {selectedModel === m && <CheckCircle2 size={14} className="text-primary" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Resolução</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {RESOLUTIONS.map((res) => (
                          <button
                            key={res.id}
                            onClick={() => setSelectedResolution(res.id as any)}
                            className={`p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                              selectedResolution === res.id ? "border-primary bg-primary/5" : "border-neutral-50 dark:border-neutral-800"
                            }`}
                          >
                            <span className="text-sm font-bold">{res.label}</span>
                            <span className="text-[10px] font-black">{res.cost} CR</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Formato</h3>
                      <div className="grid grid-cols-4 gap-2">
                        {ASPECT_RATIOS.map((ratio) => (
                          <button
                            key={ratio.id}
                            onClick={() => setSelectedAspectRatio(ratio.id as any)}
                            className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                              selectedAspectRatio === ratio.id ? "border-primary bg-primary/5 text-primary" : "border-neutral-50 dark:border-neutral-800 text-neutral-500"
                            }`}
                          >
                            <ratio.icon size={16} />
                            <span className="text-[8px] font-bold">{ratio.id}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={24} className="animate-spin" /> : <Wand2 size={24} />}
                    <span className="text-lg">Iniciar Renderização</span>
                  </button>
                </div>

                {/* Progress / Result Area */}
                {(isGenerating || generationTask) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden"
                  >
                    {generationTask?.status === 'completed' ? (
                      <div className="space-y-8">
                        <div className="bg-neutral-50 dark:bg-neutral-950 rounded-[3rem] p-12 border border-neutral-100 dark:border-neutral-800 shadow-inner flex items-center justify-center min-h-[400px] relative group overflow-hidden">
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative max-w-full max-h-[600px] shadow-2xl rounded-2xl overflow-hidden cursor-zoom-in"
                            onClick={() => setIsViewerOpen(true)}
                          >
                            <img 
                              src={generationTask.resultUrl} 
                              className="w-full h-full object-contain" 
                              alt="Generated Result"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="bg-white/90 backdrop-blur-md p-4 rounded-full text-black shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform">
                                <Maximize2 size={24} />
                              </div>
                            </div>
                          </motion.div>
                          
                          {/* Floating Actions */}
                          <div className="absolute bottom-8 right-8 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleDownload(generationTask.resultUrl!)}
                              className="p-3 bg-white/90 backdrop-blur-md text-black rounded-xl hover:scale-110 transition-transform shadow-lg"
                              title="Download"
                            >
                              <Download size={20} />
                            </button>
                            <button 
                              onClick={() => setIsViewerOpen(true)}
                              className="p-3 bg-white/90 backdrop-blur-md text-black rounded-xl hover:scale-110 transition-transform shadow-lg"
                              title="Ver em tela cheia"
                            >
                              <Maximize2 size={20} />
                            </button>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 items-center">
                          <div className="space-y-2">
                            <h3 className="text-2xl font-bold">Renderização Concluída!</h3>
                            <p className="text-neutral-500 dark:text-neutral-400">
                              Sua imagem foi gerada com sucesso usando o modelo {selectedModel}.
                            </p>
                            <div className="flex gap-2 mt-4">
                              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                                {selectedResolution}
                              </span>
                              <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                                {selectedAspectRatio}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleDownload(generationTask.resultUrl!)}
                              className="flex-1 bg-primary text-white font-bold py-4 rounded-2xl hover:bg-primary-dark transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                            >
                              <Download size={20} />
                              Download
                            </button>
                            <button
                              onClick={() => {
                                setGenerationTask(null);
                                setIsGenerating(false);
                              }}
                              className="flex-1 bg-neutral-100 dark:bg-neutral-800 font-bold py-4 rounded-2xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center justify-center gap-2"
                            >
                              <RefreshCw size={20} />
                              Novo Render
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : generationTask?.status === 'failed' ? (
                      <div className="text-center py-12 space-y-6">
                        <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto">
                          <AlertCircle size={40} />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold">Ops! Algo deu errado</h3>
                          <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                            {generationTask.error || 'Ocorreu um erro durante o processamento da imagem.'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setGenerationTask(null);
                            setIsGenerating(false);
                          }}
                          className="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary-dark transition-all"
                        >
                          Tentar Novamente
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-12 py-8">
                        <div className="flex flex-col items-center justify-center text-center space-y-6">
                          <div className="relative">
                            <svg className="w-32 h-32 transform -rotate-90">
                              <circle
                                cx="64"
                                cy="64"
                                r="60"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-neutral-100 dark:text-neutral-800"
                              />
                              <motion.circle
                                cx="64"
                                cy="64"
                                r="60"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray="377"
                                initial={{ strokeDashoffset: 377 }}
                                animate={{ strokeDashoffset: 377 - (377 * (generationTask?.progress || 0)) / 100 }}
                                className="text-primary"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-2xl font-black">{Math.round(generationTask?.progress || 0)}%</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-2xl font-bold">Processando sua imagem...</h3>
                            <p className="text-neutral-500 dark:text-neutral-400">
                              Aguarde enquanto o modelo Nano Banana Pro renderiza seu projeto.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 p-20 text-center space-y-6"
              >
                <div className="w-24 h-24 bg-neutral-50 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto text-neutral-300">
                  <Wand2 size={48} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Selecione um Projeto</h2>
                  <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                    Escolha um projeto na lista lateral para visualizar os detalhes e iniciar a renderização da imagem.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-primary font-bold">
                  <ArrowRight size={20} className="animate-bounce" />
                  <span>Selecione à esquerda</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Plan Upgrade Modal */}
      <PlanUpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
      />

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isViewerOpen && generationTask?.resultUrl && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsViewerOpen(false)}
              className="absolute inset-0 bg-white/20 dark:bg-black/40 backdrop-blur-3xl"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative max-w-full max-h-full flex flex-col items-center gap-6"
            >
              <div className="relative group">
                <img 
                  src={generationTask.resultUrl} 
                  className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl border border-white/10"
                  alt="Full View"
                />
                
                {/* Close Button */}
                <button 
                  onClick={() => setIsViewerOpen(false)}
                  className="absolute -top-4 -right-4 p-3 bg-white text-black rounded-full shadow-2xl hover:scale-110 transition-transform z-10"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => handleDownload(generationTask.resultUrl!)}
                  className="px-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-neutral-200 transition-all flex items-center gap-3 shadow-xl"
                >
                  <Download size={24} />
                  Baixar Imagem de Alta Qualidade
                </button>
                <button
                  onClick={() => setIsViewerOpen(false)}
                  className="px-8 py-4 bg-white/10 text-white font-bold rounded-2xl hover:bg-white/20 transition-all border border-white/20"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImageGeneration;
