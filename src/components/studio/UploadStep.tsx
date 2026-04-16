import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { useCredits } from '../../hooks/useCredits';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  ArrowRight, 
  Loader2, 
  Camera, 
  Clipboard, 
  AlertTriangle, 
  CheckCircle2,
  Maximize2,
  FileText,
  AlertCircle,
  Info,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  uploadImage,
  validateFileChain,
  compressImage,
  type ValidationChainResult,
  type ValidationStepResult
} from '../../services/storageService';
import kieService from '../../services/kieService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MIN_FILE_SIZE = 300 * 1024; // 300KB
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MIN_DIMENSIONS = { width: 800, height: 600 };
const MAX_DIMENSIONS = { width: 8000, height: 8000 };

const UploadStep: React.FC = () => {
  const { setImage, setBase64Image, setStep, setSessionId } = useStudioStore();
  const { userProfile } = useCredits();
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationChainResult | null>(null);
  const [showArchitectureWarning, setShowArchitectureWarning] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getErrorMessage = (err: string | null) => {
    if (!err) return '';
    const messages: Record<string, string> = {
      'UNSUPPORTED_FORMAT': 'Formato de arquivo não suportado. Use JPG, PNG, WebP, HEIC ou TIFF.',
      'FILE_TOO_SMALL': 'O arquivo é muito pequeno. O tamanho mínimo é 300KB.',
      'FILE_TOO_LARGE': 'O arquivo é muito grande. O tamanho máximo é 20MB.',
      'IMAGE_TOO_SMALL_PIXELS': 'A resolução da imagem é muito baixa. Mínimo de 800x600px.',
      'IMAGE_TOO_LARGE_PIXELS': 'A resolução da imagem é muito alta. Máximo de 8000x8000px.',
      'DAILY_LIMIT_EXCEEDED': 'Você atingiu seu limite diário de uploads (Plano Básico).',
      'DAILY_LIMIT_EXCEEDED_PRO': 'Você atingiu seu limite diário de uploads (Plano Pro).',
      'AUTH_REQUIRED': 'Você precisa estar logado para fazer upload.',
      'IMAGE_DECODE_TIMEOUT': 'Tempo esgotado ao processar a imagem.',
      'CORRUPTED_FILE': 'O arquivo parece estar corrompido.',
      'VALIDATION_FAILED': 'Falha na validação do arquivo.',
      'NOT_ARCHITECTURE': 'A imagem não parece ser de arquitetura.',
      'LOW_CONFIDENCE': 'Baixa confiança na detecção de arquitetura.',
      'CONTENT_VALIDATION_FAILED': 'Falha ao validar o conteúdo da imagem.',
      'COMPRESSION_TIMEOUT': 'Tempo esgotado ao comprimir a imagem.',
      'COMPRESSION_ERROR': 'Erro ao comprimir a imagem.',
      'UPLOAD_TIMEOUT': 'O upload demorou muito tempo. Verifique sua conexão.',
      'FIRESTORE_WRITE_TIMEOUT': 'Falha ao salvar metadados (Timeout). Tente novamente.'
    };
    return messages[err] || err;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (selectedFile: File) => {
    setError(null);
    setValidationResult(null);
    setIsValidating(true);
    setShowArchitectureWarning(false);
    
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);

    try {
      const result = await validateFileChain(selectedFile, userProfile?.plan || 'basic');
      setValidationResult(result);
      
      if (!result.allValid) {
        const firstError = result.steps.find(s => !s.valid && !s.warning);
        setError(firstError?.error || 'VALIDATION_FAILED');
      } else if (result.steps.some(s => s.warning)) {
        setShowArchitectureWarning(true);
      }
      
      setFile(selectedFile);
    } catch (err: any) {
      setError(err.message || 'Erro ao validar arquivo');
      setFile(null);
      setPreview(null);
    } finally {
      setIsValidating(false);
    }
  }, [userProfile?.plan]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFile(acceptedFiles[0]);
    }
  }, [handleFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.heic', '.tiff'] },
    multiple: false,
    noClick: true // We handle click manually or via label to avoid conflicts
  } as any);

  // Clipboard support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) handleFile(blob);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleConfirmUpload = async () => {
    if (!file || !validationResult || !validationResult.allValid) {
      console.warn('Cannot upload: file missing or validation failed', { file, validationResult });
      return;
    }

    console.log('Starting upload confirm process for file:', file.name);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Convert to Base64 immediately for diagnosis (Compressed for speed)
      console.log('Compressing image for diagnosis...');
      setUploadProgress(5);
      const diagnosisBlob = await compressImage(file, 0.8, 1600);

      console.log('Converting to Base64 for immediate diagnosis...');
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(diagnosisBlob);
      });
      setBase64Image(base64);
      setUploadProgress(15);

      // 2. Start upload process with progress tracking
      console.log('Calling uploadImage service with progress tracking...');
      const result = await uploadImage(file, validationResult, base64, (progress) => {
        console.log('Upload progress:', progress);
        setUploadProgress(15 + (progress * 0.85)); // Map 0-100 to 15-100
      });

      console.log('Upload completed successfully, result:', result);
      setImage(preview, result.metadata);
      setSessionId(result.sessionId);
      setUploadProgress(100);
      console.log('Transitioning to diagnosis step...');
      setStep('diagnosis');
    } catch (err: any) {
      console.error('Upload Process Error:', err);

      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        'AUTH_REQUIRED': 'Você precisa estar logado para fazer upload.',
        'UPLOAD_TIMEOUT': 'O upload demorou muito tempo. Verifique sua conexão e tente novamente.',
        'CORS_ERROR': 'Erro de conexão com o servidor. Verifique sua conexão de rede.',
        'FIRESTORE_WRITE_TIMEOUT': 'Falha ao salvar metadados. Tente novamente.',
        'UPLOAD_FAILED': 'Falha ao enviar arquivo. Tente novamente.'
      };

      const errorCode = err.message || 'UPLOAD_FAILED';
      const errorMessage = errorMessages[errorCode] || `Falha ao processar: ${err.message}`;

      setError(errorMessage);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Upload da Imagem</h2>
        <p className="text-muted-foreground">
          Arraste sua planta, fachada ou perspectiva para começar a transformação.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            {...getRootProps()}
            className={cn(
              "relative border-2 border-dashed rounded-[2.5rem] p-12 transition-all cursor-pointer",
              "flex flex-col items-center justify-center min-h-[450px]",
              isDragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-neutral-200 dark:border-neutral-800 hover:border-primary/50 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <input {...getInputProps()} ref={fileInputRef} />
            <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-6">
              {isValidating ? <Loader2 size={48} className="animate-spin" /> : <Upload size={48} />}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold mb-2">
                {isDragActive ? "Solte para enviar" : "Arraste e solte sua imagem aqui"}
              </p>
              <p className="text-muted-foreground mb-8">
                ou clique para selecionar do seu computador
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
                <ImageIcon className="w-4 h-4" />
                JPG, PNG, WebP, HEIC, TIFF
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
                <Info className="w-4 h-4" />
                300KB - 20MB
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
                <Maximize2 className="w-4 h-4" />
                Mín. 800x600px
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted transition-colors">
                <Camera className="w-4 h-4" />
                Câmera
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted transition-colors">
                <Clipboard className="w-4 h-4" />
                Colar
              </button>
            </div>

            {error && (
              <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {getErrorMessage(error)}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {/* Preview Card */}
            <div className="relative aspect-square rounded-[2.5rem] overflow-hidden bg-muted border shadow-xl">
              {preview && (
                <img 
                  src={preview} 
                  alt="Preview" 
                  className="w-full h-full object-contain"
                />
              )}
              {!isUploading && !isValidating && (
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setValidationResult(null);
                    setError(null);
                  }}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-md"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              {(isUploading || isValidating) && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6">
                  {isValidating ? (
                    <>
                      <Loader2 className="w-12 h-12 animate-spin mb-4" />
                      <p className="text-lg font-medium">Validando arquivo...</p>
                      <p className="text-sm opacity-80">Verificando segurança e qualidade</p>
                    </>
                  ) : (
                    <>
                      <div className="w-full max-w-[200px] h-2 bg-white/20 rounded-full overflow-hidden mb-4">
                        <motion.div 
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-lg font-medium">{Math.round(uploadProgress)}%</p>
                      <p className="text-sm opacity-80">Enviando para o servidor...</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Validation & Actions Card */}
            <div className="flex flex-col">
              <div className="flex-1 bg-card border rounded-[2.5rem] p-8 mb-4">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  Status da Validação
                </h3>
                
                <div className="space-y-4">
                  {validationResult?.steps.map((step) => (
                    <div key={step.step} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                          step.valid ? (step.warning ? "bg-yellow-100 text-yellow-600" : "bg-green-100 text-green-600") : "bg-red-100 text-red-600"
                        )}>
                          {step.valid ? (
                            step.warning ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <AlertCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{step.name}</p>
                          {step.error && (
                            <p className="text-xs text-red-500">{getErrorMessage(step.error)}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        {step.durationMs}ms
                      </span>
                    </div>
                  ))}
                  
                  {isValidating && (
                    <div className="flex items-center gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Processando...</p>
                    </div>
                  )}
                </div>

                {error && !isValidating && (
                  <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Falha na validação</p>
                      <p>{getErrorMessage(error)}</p>
                      {(error === 'DAILY_LIMIT_EXCEEDED' || error === 'DAILY_LIMIT_EXCEEDED_PRO') && (
                        <button className="mt-2 text-primary font-bold hover:underline flex items-center gap-1">
                          Fazer Upgrade Agora <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {showArchitectureWarning && (
                  <div className="mt-6 p-4 rounded-xl bg-yellow-50 border border-yellow-100 text-yellow-700 text-sm flex gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Conteúdo não reconhecido</p>
                      <p>Não detectamos elementos arquiteturais claros nesta imagem. O resultado da IA pode não ser o esperado.</p>
                      <button 
                        onClick={() => setShowArchitectureWarning(false)}
                        className="mt-2 text-yellow-800 font-bold hover:underline"
                      >
                        Entendi, continuar assim mesmo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setValidationResult(null);
                    setError(null);
                  }}
                  disabled={isUploading || isValidating}
                  className="flex-1 px-6 py-4 rounded-2xl border font-bold hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmUpload}
                  disabled={!validationResult?.allValid || isUploading || isValidating}
                  className={cn(
                    "flex-[2] px-6 py-4 rounded-2xl font-bold text-white transition-all shadow-xl",
                    "bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none"
                  )}
                >
                  {isUploading ? "Enviando..." : "Iniciar Transformação"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UploadStep;
