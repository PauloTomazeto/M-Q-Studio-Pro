import React, { useState, useEffect } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { useCredits } from '../../hooks/useCredits';
import { Loader2, Download, Eye, ExternalLink, Share2, AlertTriangle, Play, Save, Check, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { imageGenerationService } from '../../services/imageGenerationService';
import { ImageGeneration, GenerationResolution } from '../../types/studio';

export const GenerationPanel: React.FC = () => {
  const { configParams, promptId, generatedPrompt, generatedBlocks, setIsGenerating, isGenerating } = useStudioStore();
  const { credits, consumeCredits, userProfile } = useCredits();
  
  const [resolution, setResolution] = useState<GenerationResolution>('2k');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [generationTask, setGenerationTask] = useState<ImageGeneration | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Resolution options with costs and times
  // Note: apiValue is auto-mapped in imageGenerationService.mapResolution()
  const resolutions = [
    { value: '2k', label: '2K (2560x1920)', cost: 5, time: '~30-40s', plan: 'basic' },
    { value: '2.5k', label: '2.5K (3200x2400)', cost: 8, time: '~40-60s', plan: 'pro' },
    { value: '3k', label: '3K (3840x2880)', cost: 12, time: '~60-80s', plan: 'pro' },
    { value: '4k', label: '4K (4096x3072)', cost: 20, time: '~80-120s', plan: 'pro' }
  ];

  // Aspect Ratio Options
  const aspectRatios = [
    { value: '16:9', label: 'Landscape 16:9' },
    { value: '9:16', label: 'Portrait 9:16' },
    { value: '5:4', label: 'Portrait 5:4' },
    { value: '4:5', label: 'Landscape 4:5' },
    { value: '1:1', label: 'Square 1:1' },
    { value: '4:3', label: 'Standard 4:3' },
    { value: '3:4', label: 'Standard 3:4' }
  ];

  const currentOption = resolutions.find(r => r.value === resolution) || resolutions[0];
  const hasEnoughCredits = (credits ?? 0) >= currentOption.cost;

  const userPlan = userProfile?.plan || 'basic'; 

  // Cleanup subscription
  useEffect(() => {
    let unsubscribe: () => void;
    if (generationTask?.image_generation_id && !generationTask.is_completed) {
      import('../../services/imageGenerationService').then(({ imageGenerationService }) => {
        unsubscribe = imageGenerationService.subscribeToGeneration(
          generationTask.image_generation_id,
          (updatedTask) => {
            setGenerationTask(updatedTask);
            if (updatedTask.is_completed || updatedTask.generation_status === 'failed') {
              setIsGenerating(false);
            }
          }
        );
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [generationTask?.image_generation_id]);

  const handleGenerate = async () => {
    try {
      setError(null);

      // Validate prompt
      const promptContent = configParams.promptMode === 'single' ? generatedPrompt : generatedBlocks?.map(b => b.content).join('\n\n');
      if (!promptContent || !promptId) {
        setError("Gere ou edite um prompt antes de renderizar.");
        return;
      }

      // Check credits
      if (!hasEnoughCredits) {
        setError(`Você precisa de ${currentOption.cost} créditos (você tem ${credits}).`);
        return;
      }

      // Consume credits
      const consumed = await consumeCredits(currentOption.cost, 'image_generation');
      if (!consumed) {
        setError("Falha ao debitar créditos. Tente novamente.");
        return;
      }

      setIsGenerating(true);
      setIsSaved(false);
      
      const { imageGenerationService } = await import('../../services/imageGenerationService');
      const genId = await imageGenerationService.startGeneration(
        promptId,
        promptContent,
        resolution,
        currentOption.cost,
        aspectRatio
      );

      // Set initial state
      setGenerationTask({
        image_generation_id: genId,
        user_id: '',
        session_id: '',
        prompt_config_id: promptId,
        prompt_content: promptContent,
        generation_status: 'queued',
        progress_percentage: 0,
        progress_stage: 'initializing',
        estimated_time_remaining_seconds: 0,
        current_resolution: resolution,
        image_url_preview: null,
        image_url_2k: null,
        image_url_2_5k: null,
        image_url_3k: null,
        image_url_4k: null,
        generation_duration_seconds: 0,
        kie_api_model: 'nano-banana-2',
        kie_api_request_id: null,
        kie_api_status: 'pending',
        is_preview_ready: false,
        is_completed: false,
        credits_cost: currentOption.cost,
        credits_deducted: true,
        error_message: null,
        error_code: null,
        retry_count: 0,
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: null
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao iniciar geração.');
      setIsGenerating(false);
    }
  };

  const handleSaveGeneration = async () => {
    if (!generationTask?.image_generation_id) return;
    try {
      const { imageGenerationService } = await import('../../services/imageGenerationService');
      await imageGenerationService.toggleFavorite(generationTask.image_generation_id, true);
      setIsSaved(true);
    } catch (err) {
      console.error('Failed to save generation:', err);
    }
  };

  const handleShare = () => {
    // Mock sharing link
    navigator.clipboard.writeText(`https://mqstudio.app/generation/${generationTask?.image_generation_id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleDownload = (res: GenerationResolution) => {
    if (!generationTask) return;
    let url = null;
    if (res === '2k') url = generationTask.image_url_2k;
    if (res === '2.5k') url = generationTask.image_url_2_5k;
    if (res === '3k') url = generationTask.image_url_3k;
    if (res === '4k') url = generationTask.image_url_4k;

    if (url) {
      // Create a temporary link to trigger download
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.download = `mqstudio_render_${res}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Render Form (No Active Generation)
  if (!generationTask) {
    return (
      <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 mt-8 space-y-6">
        <div>
          <h3 className="text-lg font-bold">Gerar Imagem Fotorrealista</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Transforme seu prompt em uma imagem de alta resolução usando a KIE.AI.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium">Selecione o Aspect Ratio</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {aspectRatios.map((ratio) => (
              <button
                key={ratio.value}
                onClick={() => setAspectRatio(ratio.value)}
                className={`flex items-center justify-center p-3 rounded-lg border text-sm transition-colors ${
                  aspectRatio === ratio.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary font-medium text-primary'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-950'
                }`}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium">Selecione a Resolução</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {resolutions.map((res) => (
              <button
                key={res.value}
                onClick={() => setResolution(res.value as GenerationResolution)}
                disabled={userPlan === 'basic' && res.value !== '2k'}
                className={`flex flex-col p-4 rounded-lg border text-left transition-colors ${
                  resolution === res.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-950'
                } ${userPlan === 'basic' && res.value !== '2k' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-semibold">{res.label}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    resolution === res.value ? 'bg-primary/10 text-primary' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}>
                    {res.cost} créditos
                  </span>
                </div>
                <span className="text-xs text-neutral-500 mt-1">Tempo estimado: {res.time}</span>
              </button>
            ))}
          </div>
          {userPlan === 'basic' && resolution !== '2k' && (
             <p className="text-xs text-warning flex items-center gap-1 mt-1">
               <AlertTriangle size={12} />
               Seu plano permite apenas resolução 2K. Faça upgrade para resoluções maiores.
             </p>
          )}
        </div>

        <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm">Saldo atual: <strong>{credits} créditos</strong></p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Custo desta geração: <strong className="text-primary">{currentOption.cost} créditos</strong>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm">Saldo após geração:</p>
            <p className={`text-lg font-bold ${hasEnoughCredits ? 'text-success' : 'text-danger'}`}>
              {credits - currentOption.cost} créditos
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-danger/10 text-danger p-3 rounded-lg text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!hasEnoughCredits || !promptId || isGenerating}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          {isGenerating ? 'Iniciando Geração...' : 'Gerar Imagem'}
        </button>
      </div>
    );
  }

  // Active Generation Progress Panel
  if (generationTask.generation_status === 'queued' || generationTask.generation_status === 'processing' || generationTask.generation_status === 'preview_ready') {
    return (
      <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 mt-8 space-y-6 text-center">
        <h3 className="text-xl font-bold">Gerando Imagem {generationTask.current_resolution.toUpperCase()}...</h3>
        <p className="text-neutral-500 dark:text-neutral-400">Por favor, aguarde enquanto a KIE.AI processa sua imagem fotorrealista.</p>
        
        <div className="relative pt-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">{generationTask.progress_percentage}% Completo</span>
            <span className="text-sm text-neutral-500">
              {generationTask.progress_stage.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <div className="overflow-hidden h-3 mb-4 text-xs flex rounded bg-neutral-200 dark:bg-neutral-800">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${generationTask.progress_percentage}%` }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"
            />
          </div>
          <p className="text-xs text-neutral-500">
            Tempo estimado restante: ~{generationTask.estimated_time_remaining_seconds}s
          </p>
        </div>

        {generationTask.is_preview_ready && (
          <button
            onClick={() => setShowPreviewModal(true)}
            className="mt-4 flex items-center justify-center gap-2 w-full py-2 border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors"
          >
            <Eye size={18} />
            Ver Preview
          </button>
        )}
      </div>
    );
  }

  // Completed State Panel
  if (generationTask.is_completed) {
    return (
      <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 mt-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-success flex items-center gap-2">
              <Check size={24} /> Imagem Gerada com Sucesso!
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Sua imagem está pronta para download.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveGeneration}
              disabled={isSaved}
              className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Salvar no Histórico"
            >
              {isSaved ? <Check size={18} className="text-success" /> : <Save size={18} />}
            </button>
            <button
              onClick={handleShare}
              className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Compartilhar"
            >
              {linkCopied ? <Check size={18} className="text-success" /> : <Share2 size={18} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 p-2">
            {generationTask.image_url_preview ? (
              <img 
                src={generationTask.image_url_preview} 
                alt="Final Render" 
                className="max-h-[500px] w-auto h-auto rounded-lg shadow-sm object-contain"
              />
            ) : (
              <div className="h-[400px] w-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center rounded-lg">
                <span className="text-neutral-500">Imagem Indisponível</span>
              </div>
            )}
            <p className="mt-4 text-xs text-neutral-500">
              Resolução Selecionada: {generationTask.current_resolution.toUpperCase()} | Tempo: {generationTask.generation_duration_seconds}s
            </p>
          </div>

          <div className="flex-1 space-y-6">
            <div className="bg-white dark:bg-neutral-950 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <h4 className="font-semibold mb-4 text-lg">Opções de Download</h4>
              <div className="space-y-3">
                {resolutions.map(res => {
                  const resIndex = resolutions.findIndex(r => r.value === res.value);
                  const generatedIndex = resolutions.findIndex(r => r.value === generationTask.current_resolution);
                  
                  if (resIndex <= generatedIndex) {
                    return (
                      <button
                        key={res.value}
                        onClick={() => handleDownload(res.value as GenerationResolution)}
                        className={`w-full flex items-center justify-between p-4 rounded-lg border text-sm transition-colors ${
                          res.value === generationTask.current_resolution 
                            ? 'bg-primary text-white border-primary shadow-md hover:bg-primary/90' 
                            : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Download size={18} />
                          <span className="font-medium">Download {res.label.split(' ')[0]}</span>
                        </div>
                        <span className="opacity-90 text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded">
                          {res.value === '4k' ? '~6.2MB' : res.value === '3k' ? '~4.1MB' : res.value === '2.5k' ? '~2.3MB' : '~1.5MB'}
                        </span>
                      </button>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
            
            <button 
              onClick={() => {
                setGenerationTask(null);
                setResolution('2k');
              }}
              className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              Gerar Novamente (Ajustar Parâmetros)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};


