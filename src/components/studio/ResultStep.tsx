import React, { useEffect, useState, useRef } from 'react';
import { useStudioStore } from '../../store/studioStore';
import kieService from '../../services/kieService';
import { useCredits } from '../../hooks/useCredits';
import { uploadTempImage, compressImage } from '../../services/storageService';
import { auth, db, handleFirestoreError, OperationType } from '../../firebase';
// import { doc, updateDoc, onSnapshot } from 'firebase/firestore'; // Migrated to Supabase
import { 
  Loader2, Copy, Check, Edit3, Wand2, ArrowRight, Star, RotateCcw,
  Save, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const ResultStep: React.FC = () => {
  const { 
    scanResult, 
    materials, 
    ambientLight, 
    lightPoints, 
    configParams, 
    generatedPrompt,
    generatedBlocks,
    qualityBreakdown,
    promptId,
    setGeneratedPrompt,
    setGeneratedBlocks,
    setQualityBreakdown,
    setPromptId,
    setIsModeLocked,
    setStep,
    base64Image,
    sessionId,
    projectId,
    setProjectId,
    mirrorImage,
    setMirrorImage
  } = useStudioStore();
  const { consumeCredits, refundCredits } = useCredits();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    (configParams.promptMode === 'single' ? generatedPrompt : (generatedBlocks && generatedBlocks.length > 0)) ? 'success' : 'loading'
  );
  const [prompt, setPrompt] = useState<string | null>(generatedPrompt);
  const [blocks, setBlocks] = useState<any[] | null>(generatedBlocks);
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [qualityScore, setQualityScore] = useState<number>(85);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const getActivePrompt = () => {
    if (configParams.promptMode === 'single') return prompt || generatedPrompt;
    if (blocks && blocks.length > 0) {
      return blocks.map(b => b.content).join('\n\n');
    }
    return null;
  };

  const hasMirror = scanResult?.materials?.some((m: any) => m.reflectancia === 'espelhado');

  const handleSaveProject = async (nameOverride?: string) => {
    const activePrompt = getActivePrompt();
    if (!activePrompt) return;
    
    // If we have a projectId and no nameOverride, it's an update
    if (projectId && !nameOverride) {
      setIsSavingProject(true);
      try {
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
          prompt: activePrompt,
          originalImage: base64Image,
          mirrorImage: mirrorImage,
          scanResult,
          configParams,
          materials,
          ambientLight,
          lightPoints,
          updatedAt: new Date().toISOString()
        });
        
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        
        confetti({
          particleCount: 30,
          spread: 30,
          origin: { y: 0.7 },
          colors: ['#10B981', '#059669']
        });
      } catch (err) {
        console.error('Failed to update project:', err);
        handleFirestoreError(err, OperationType.WRITE, 'projects');
      } finally {
        setIsSavingProject(false);
      }
      return;
    }

    // If no projectId or we are in the modal (nameOverride provided)
    const finalName = nameOverride || projectName;
    if (!finalName.trim()) {
      setIsSaveModalOpen(true);
      return;
    }
    
    setIsSavingProject(true);
    try {
      // TODO: Migrate to Supabase - const { } = await import('//firebase/firestore');
      const projectData = {
        name: finalName,
        prompt: activePrompt,
        originalImage: base64Image,
        mirrorImage: mirrorImage,
        scanResult,
        configParams,
        materials,
        ambientLight,
        lightPoints,
        userId: auth.currentUser?.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'saved_project'
      };
      
      const docRef = await addDoc(collection(db, 'projects'), projectData);
      setProjectId(docRef.id);
      
      setSaveSuccess(true);
      setTimeout(() => {
        setIsSaveModalOpen(false);
        setSaveSuccess(false);
        setProjectName('');
      }, 2000);
      
      confetti({
        particleCount: 50,
        spread: 40,
        origin: { y: 0.7 },
        colors: ['#10B981', '#059669']
      });
    } catch (err) {
      console.error('Failed to save project:', err);
      handleFirestoreError(err, OperationType.WRITE, 'projects');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `mqstudio_gen_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download image:', err);
      window.open(url, '_blank');
    }
  };

  const generate = async () => {
    setStatus('loading');
    setIsModeLocked(true);
    try {
      // Prompt generation is now free as per user request
      // const hasCredits = await consumeCredits(0, 'prompt_generation'); 
      
      const updatedScanResult = {
        ...scanResult,
        materials,
        light: ambientLight,
        lightPoints
      };

      const result = await kieService.generatePrompt(updatedScanResult, configParams, configParams.promptMode);
      
      let savedId = '';
      if (configParams.promptMode === 'single') {
        setPrompt(result.content);
        setGeneratedPrompt(result.content);
        setQualityScore(result.qualityScore);
        setQualityBreakdown(result.qualityBreakdown);
        setBlocks(null);
        setGeneratedBlocks(null);

        // Save to Firestore
        import('../../services/promptService').then(async ({ promptService }) => {
          savedId = await promptService.saveGeneratedPrompt({
            content: result.content,
            qualityScore: result.qualityScore,
            qualityBreakdown: result.qualityBreakdown,
            promptMode: 'single',
            isAiGenerated: true,
            promptSource: 'gemini_ai'
          });
          setPromptId(savedId);
        });
      } else {
        setBlocks(result.blocks);
        setGeneratedBlocks(result.blocks);
        setQualityScore(result.overall_quality_score);
        setQualityBreakdown(result.overall_quality_breakdown);
        setPrompt(null);
        setGeneratedPrompt(null);

        // Save to Firestore
        import('../../services/promptService').then(async ({ promptService }) => {
          savedId = await promptService.saveGeneratedPrompt({
            content: result.blocks.map((b: any) => b.content).join('\n\n'),
            qualityScore: result.overall_quality_score,
            qualityBreakdown: result.overall_quality_breakdown,
            promptMode: 'blocks',
            isAiGenerated: true,
            promptSource: 'gemini_ai'
          });
          setPromptId(savedId);
        });
      }
      
      setStatus('success');
      setIsModeLocked(false);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0066FF', '#7C3AED', '#10B981']
      });
    } catch (err) {
      console.error(err);
      setStatus('error');
      setIsModeLocked(false);
    }
  };

  useEffect(() => {
    if (configParams.promptMode === 'single' && !generatedPrompt) {
      generate();
    } else if (configParams.promptMode === 'blocks' && (!generatedBlocks || generatedBlocks.length === 0)) {
      generate();
    }
  }, [configParams.promptMode]);

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      if (configParams.promptMode === 'single') {
        setPrompt(editedText);
        setGeneratedPrompt(editedText);
        if (promptId) {
          const { promptService } = await import('../../services/promptService');
          await promptService.updatePrompt(promptId, editedText);
        }
      } else if (blocks) {
        const newBlocks = [...blocks];
        newBlocks[activeBlockIndex].content = editedText;
        setBlocks(newBlocks);
        setGeneratedBlocks(newBlocks);
        if (promptId) {
          const { promptService } = await import('../../services/promptService');
          await promptService.updatePrompt(promptId, newBlocks.map(b => b.content).join('\n\n'));
        }
      }
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save edit:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!promptId) return;
    try {
      const { promptService } = await import('../../services/promptService');
      await promptService.toggleFavorite(promptId, !isFavorite);
      setIsFavorite(!isFavorite);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleCopy = async (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (promptId) {
      const { promptService } = await import('../../services/promptService');
      await promptService.incrementCopyCount(promptId);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditing = () => {
    const currentText = configParams.promptMode === 'single' ? prompt : blocks?.[activeBlockIndex]?.content;
    setEditedText(currentText || '');
    setIsEditing(true);
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-8">
        <Loader2 size={48} className="animate-spin text-primary" />
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold">Gerando Prompts...</h3>
          <p className="text-neutral-500 dark:text-neutral-400">
            Nossa IA está combinando o diagnóstico com suas configurações.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Prompt Gerado</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-neutral-500 dark:text-neutral-400">
              Qualidade Estimada: <span className="font-bold text-success">{qualityScore}/100</span>
            </p>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star} 
                  size={12} 
                  className={star <= Math.round(qualityScore / 20) ? "fill-success text-success" : "text-neutral-300"} 
                />
              ))}
            </div>
          </div>
          
          {qualityBreakdown && (
            <div className="flex flex-wrap gap-3 mt-3">
              {Object.entries(qualityBreakdown).map(([key, val]: [string, any]) => (
                <div key={key} className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-full">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                    {key === 'clarity' ? 'Clareza' : 
                     key === 'specificity' ? 'Especificidade' : 
                     key === 'coherence' ? 'Coerência' : 
                     key === 'brevity' ? 'Objetividade' : key}
                  </span>
                  <div className="w-12 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${val > 80 ? 'bg-success' : val > 60 ? 'bg-amber-500' : 'bg-error'}`}
                      style={{ width: `${val}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold">{val}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={generate}
            className="px-6 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2"
          >
            <RotateCcw size={18} />
            Regerar
          </button>
          <button
            onClick={() => handleSaveProject()}
            disabled={isSavingProject}
            className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {isSavingProject ? (
              <Loader2 size={18} className="animate-spin" />
            ) : saveSuccess && !isSaveModalOpen ? (
              <Check size={18} />
            ) : (
              <Save size={18} />
            )}
            {saveSuccess && !isSaveModalOpen ? 'Atualizado!' : projectId ? 'Salvar Alterações' : 'Salvar Projeto'}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-500 uppercase tracking-wider">
                <Wand2 size={16} />
                {configParams.promptMode === 'single' ? 'Single Prompt' : 'Blocks Prompt'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(configParams.promptMode === 'single' ? (prompt || '') : (blocks?.[activeBlockIndex]?.content || ''))}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-bold hover:border-primary transition-all"
                >
                  {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {configParams.promptMode === 'blocks' && blocks && (
              <div className="flex border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto scrollbar-hide">
                {blocks.map((block, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveBlockIndex(idx)}
                    className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-all border-b-2 ${
                      activeBlockIndex === idx
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    }`}
                  >
                    {block.title}
                    <span className="ml-2 text-[10px] opacity-50">{block.quality_score}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="p-8">
              {isEditing ? (
                <div className="space-y-4">
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full h-64 p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none font-mono text-sm leading-relaxed"
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-sm font-bold text-neutral-500 hover:text-neutral-700"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={isSaving}
                      onClick={handleSaveEdit}
                      className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-neutral-50 dark:bg-neutral-950 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-900 font-mono text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap relative group">
                  {configParams.promptMode === 'single' ? prompt : blocks?.[activeBlockIndex]?.content}
                  
                  <div className="mt-6 pt-6 border-t border-neutral-200/50 dark:border-neutral-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        Recomendação:
                      </div>
                      <div className="px-2 py-1 bg-primary/10 text-primary rounded text-[10px] font-black uppercase">
                        {configParams.promptMode === 'single' ? 'Midjourney / DALL-E' : (blocks?.[activeBlockIndex]?.engine_recommendation || 'Stable Diffusion')}
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-neutral-400">
                      {configParams.promptMode === 'single' ? `${prompt?.split(' ').length} palavras` : `${blocks?.[activeBlockIndex]?.word_count} palavras`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Referência Original</h3>
            </div>
            <div className="p-4">
              <div className="aspect-video rounded-2xl overflow-hidden border border-neutral-100 dark:border-neutral-800 bg-black">
                <img 
                  src={useStudioStore.getState().base64Image || useStudioStore.getState().image || ''} 
                  alt="Original Reference" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 ${isFavorite ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'} rounded-xl flex items-center justify-center shrink-0 transition-colors`}>
              <Star size={24} className={isFavorite ? "fill-amber-500" : ""} />
            </div>
            <div>
              <h4 className="font-bold">{isFavorite ? 'Favoritado' : 'Salvar nos Favoritos'}</h4>
              <p className="text-sm text-neutral-500">Acesse este prompt futuramente.</p>
            </div>
            <button 
              onClick={handleToggleFavorite}
              className={`ml-auto p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors ${isFavorite ? 'text-amber-500' : ''}`}
            >
              <Star size={20} className={isFavorite ? "fill-amber-500" : ""} />
            </button>
          </div>
          
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary shrink-0">
              <Edit3 size={24} />
            </div>
            <div>
              <h4 className="font-bold">Edição Manual</h4>
              <p className="text-sm text-neutral-500">Refine o texto gerado.</p>
            </div>
            <button 
              onClick={startEditing}
              className="ml-auto p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <Edit3 size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Save Project Modal */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaveModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Salvar Projeto</h3>
                <button 
                  onClick={() => setIsSaveModalOpen(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                    Nome do Projeto
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Ex: Sala de Estar Moderna"
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                    <Save size={16} />
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Seu projeto será salvo com todas as configurações de materiais, iluminação e o prompt gerado.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsSaveModalOpen(false)}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 font-bold rounded-xl hover:bg-neutral-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={!projectName.trim() || isSavingProject}
                  onClick={() => handleSaveProject(projectName)}
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingProject ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : saveSuccess ? (
                    <Check size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  {saveSuccess ? 'Salvo!' : isSavingProject ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResultStep;
