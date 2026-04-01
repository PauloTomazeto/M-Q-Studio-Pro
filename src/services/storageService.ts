import axios from 'axios';
import { ref, uploadBytesResumable, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { collection, doc, setDoc, query, where, getDocs, getDoc, increment, updateDoc } from 'firebase/firestore';
import { storage, db, auth, handleFirestoreError, OperationType } from '../firebase';
import heic2any from 'heic2any';
import EXIF from 'exif-js';
import { kieService } from './kieService';

// Constants from PRD
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/tiff'];
const MIN_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const MAX_WIDTH = 8000;
const MAX_HEIGHT = 8000;
const CONTENT_CONFIDENCE_THRESHOLD = 0.70;

export interface ImageMetadata {
  width: number;
  height: number;
  sizeBytes: number;
  format: string;
  sha256: string;
  exif?: any;
}

export interface ValidationStepResult {
  step: number;
  name: string;
  valid: boolean;
  error?: string;
  warning?: boolean;
  details?: any;
  durationMs: number;
}

export interface ValidationChainResult {
  allValid: boolean;
  steps: ValidationStepResult[];
  fileHash?: string;
  dimensions?: { width: number; height: number };
  isArchitecture?: boolean;
  confidence?: number;
  duplicated?: boolean;
  existingFilePath?: string;
  exif?: any;
}

export interface UploadResult {
  sessionId: string;
  imageOriginalUrl: string;
  imageCompressedUrl: string;
  metadata: ImageMetadata;
}

export const calculateHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => reject(new Error('IMAGE_DECODE_TIMEOUT')), 5000);
    img.onload = () => {
      clearTimeout(timeout);
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('CORRUPTED_FILE'));
    };
    img.src = URL.createObjectURL(file);
  });
};

export const extractExif = (file: File): Promise<any> => {
  return new Promise((resolve) => {
    EXIF.getData(file as any, function(this: any) {
      const allMetadata = EXIF.getAllTags(this);
      // Remove sensitive GPS data as per PRD
      const { GPSLatitude, GPSLongitude, GPSLatitudeRef, GPSLongitudeRef, ...safeMetadata } = allMetadata;
      resolve(safeMetadata);
    });
  });
};

export const compressImage = async (file: File, quality = 0.85, maxWidth = 1920): Promise<Blob> => {
  console.log('Starting image compression...');
  const img = new Image();
  const url = URL.createObjectURL(file);
  
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('COMPRESSION_TIMEOUT')), 10000);
      img.onload = () => {
        clearTimeout(timeout);
        resolve(null);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('COMPRESSION_ERROR'));
      };
      img.src = url;
    });
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }

  const canvas = document.createElement('canvas');
  let width = img.width;
  let height = img.height;

  if (width > maxWidth) {
    height = (maxWidth / width) * height;
    width = maxWidth;
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0, width, height);
  
  URL.revokeObjectURL(url);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/jpeg', quality);
  });
};

export const validateFileChain = async (
  file: File,
  userPlan: 'basic' | 'pro' | 'premium'
): Promise<ValidationChainResult> => {
  const steps: ValidationStepResult[] = [];
  const startTime = Date.now();
  let allValid = true;

  const runStep = async (
    step: number,
    name: string,
    fn: () => Promise<{ valid: boolean; error?: string; warning?: boolean; details?: any }>
  ) => {
    const stepStart = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - stepStart;
      steps.push({ step, name, ...result, durationMs: duration });
      if (!result.valid && !result.warning) allValid = false;
      return result;
    } catch (err: any) {
      const duration = Date.now() - stepStart;
      steps.push({ step, name, valid: false, error: err.message, durationMs: duration });
      allValid = false;
      return { valid: false, error: err.message };
    }
  };

  // 1. MIME Type
  const step1 = await runStep(1, 'MIME Type', async () => {
    const valid = ALLOWED_MIME_TYPES.includes(file.type) || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.tiff');
    return { 
      valid, 
      error: valid ? undefined : 'UNSUPPORTED_FORMAT',
      details: { mimeType: file.type } 
    };
  });
  if (!step1.valid) return { allValid: false, steps };

  // 2. File Size
  const step2 = await runStep(2, 'File Size', async () => {
    if (file.size < MIN_FILE_SIZE) return { valid: false, error: 'FILE_TOO_SMALL', details: { size: file.size } };
    if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'FILE_TOO_LARGE', details: { size: file.size } };
    return { valid: true, details: { size: file.size } };
  });
  if (!step2.valid) return { allValid: false, steps };

  // 3. Dimensions
  let dimensions: { width: number; height: number } | undefined;
  const step3 = await runStep(3, 'Dimensions', async () => {
    dimensions = await getImageDimensions(file);
    if (dimensions.width < MIN_WIDTH || dimensions.height < MIN_HEIGHT) return { valid: false, error: 'IMAGE_TOO_SMALL_PIXELS', details: dimensions };
    if (dimensions.width > MAX_WIDTH || dimensions.height > MAX_HEIGHT) return { valid: false, error: 'IMAGE_TOO_LARGE_PIXELS', details: dimensions };
    return { valid: true, details: dimensions };
  });
  if (!step3.valid) return { allValid: false, steps };

  // 4. Plan Limit
  const userId = auth.currentUser?.uid;
  const step4 = await runStep(4, 'Plan Limit', async () => {
    if (!userId) return { valid: false, error: 'AUTH_REQUIRED' };
    
    // Admin bypass
    const isAdminEmail = auth.currentUser?.email === 'paulosilvatomazeto@gmail.com';
    if (isAdminEmail) return { valid: true, details: { count: 0, limit: Infinity, isAdmin: true } };

    const quotaRef = doc(db, 'user_upload_quota', userId);
    const quotaSnap = await getDoc(quotaRef);
    const today = new Date().toISOString().split('T')[0];
    
    let count = 0;
    let limit = userPlan === 'premium' ? Infinity : (userPlan === 'pro' ? 5 : 1);

    if (quotaSnap.exists()) {
      const data = quotaSnap.data();
      if (data.periodStart === today) {
        count = data.dailyUploadsCount;
      }
    }

    if (count >= limit) {
      return { 
        valid: false, 
        error: userPlan === 'pro' ? 'DAILY_LIMIT_EXCEEDED_PRO' : 'DAILY_LIMIT_EXCEEDED',
        details: { count, limit }
      };
    }
    return { valid: true, details: { count, limit } };
  });
  if (!step4.valid) return { allValid: false, steps };

  // 5. Deduplication
  let fileHash: string | undefined;
  let existingFilePath: string | undefined;
  let duplicated = false;
  const step5 = await runStep(5, 'Deduplication', async () => {
    fileHash = await calculateHash(file);
    const dedupRef = doc(db, 'file_deduplication_index', fileHash);
    const dedupSnap = await getDoc(dedupRef);
    if (dedupSnap.exists()) {
      duplicated = true;
      existingFilePath = dedupSnap.data().originalStoragePath;
      return { valid: true, details: { duplicated: true, path: existingFilePath } };
    }
    return { valid: true, details: { duplicated: false } };
  });
  if (!step5.valid) return { allValid: false, steps };

  // 6. Content Validation (Optimized with thumbnail)
  let isArchitecture = true;
  let confidence = 1.0;
  const step6 = await runStep(6, 'Content', async () => {
    try {
      console.log('Starting optimized content validation...');
      // Create a small thumbnail for validation to save bandwidth and time
      const thumbnail = await compressImage(file, 0.6, 512);
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(thumbnail);
      });
      
      const res = await kieService.detectArchitecture(base64);
      console.log('detectArchitecture response:', res);
      
      isArchitecture = res.isArchitecture;
      confidence = res.confidence;
      
      if (!isArchitecture) {
        return { 
          valid: true, 
          warning: true, 
          error: 'NOT_ARCHITECTURE',
          details: { confidence, reason: res.reason } 
        };
      }
      
      if (confidence < CONTENT_CONFIDENCE_THRESHOLD) {
        return { 
          valid: true, 
          warning: true, 
          error: 'LOW_CONFIDENCE',
          details: { confidence, reason: res.reason } 
        };
      }
      
      return { valid: true, details: { confidence } };
    } catch (err: any) {
      console.error('Content Validation Error:', err);
      return { 
        valid: true, 
        warning: true, 
        error: 'CONTENT_VALIDATION_FAILED',
        details: { error: err.message } 
      };
    }
  });
  // Step 6 doesn't block unless user cancels in UI, but we mark warning

  // 7. EXIF Extraction
  let exif: any;
  const step7 = await runStep(7, 'EXIF', async () => {
    try {
      exif = await extractExif(file);
      return { valid: true, details: { found: !!exif } };
    } catch (err) {
      return { valid: true, details: { error: 'EXIF_EXTRACTION_FAILED' } };
    }
  });

  return {
    allValid,
    steps,
    fileHash,
    dimensions,
    isArchitecture,
    confidence,
    duplicated,
    existingFilePath,
    exif
  };
};

export const uploadTempImage = async (file: File | Blob, userId: string): Promise<{ path: string; url: string }> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).substring(2, 8);
  const ext = file instanceof File ? file.name.split('.').pop() : 'jpg';
  const filename = `${timestamp}-${random}.${ext}`;
  const path = `input-images/${userId}/kie-temp/${filename}`;
  const storageRef = ref(storage, path);
  
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  
  return { path, url };
};

export const deleteTempImage = async (path: string): Promise<void> => {
  const storageRef = ref(storage, path);
  try {
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('Failed to delete temp image:', err);
  }
};

export const uploadImage = async (
  file: File, 
  validationResult: ValidationChainResult,
  base64Image?: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> => {
  if (!auth.currentUser) throw new Error('User not authenticated');
  const userId = auth.currentUser.uid;
  const sessionId = `sess_${Date.now()}`;
  const sha256 = validationResult.fileHash!;
  const dimensions = validationResult.dimensions!;

  // Return immediately with a temporary result to allow UI to proceed
  // The actual upload will continue in the background
  const backgroundUpload = async () => {
    try {
      console.log('[Background] Starting upload process...');
      
      // 1. Handle HEIC/TIFF
      let processedFile = file;
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.tiff')) {
        const blob = await heic2any({ blob: file, toType: 'image/jpeg' });
        processedFile = new File([blob as Blob], file.name.replace(/\.(heic|tiff)$/i, '.jpg'), { type: 'image/jpeg' });
      }

      const isAdminEmail = auth.currentUser?.email === 'paulosilvatomazeto@gmail.com';
      
      // Update Quota (Skip for admin)
      if (!isAdminEmail) {
        const today = new Date().toISOString().split('T')[0];
        const quotaRef = doc(db, 'user_upload_quota', userId);
        const quotaSnap = await getDoc(quotaRef);
        if (quotaSnap.exists() && quotaSnap.data().periodStart === today) {
          await updateDoc(quotaRef, { dailyUploadsCount: increment(1) });
        } else {
          await setDoc(quotaRef, { 
            userId, 
            dailyUploadsCount: 1, 
            dailyLimit: 0, 
            periodStart: today,
            periodEnd: today
          });
        }
      }

      const compressedBlob = await compressImage(processedFile);
      const filename = `${sha256}.${processedFile.name.split('.').pop()}`;
      const storagePath = `generation_images/${userId}/${sessionId}/${filename}`;
      const storageRef = ref(storage, storagePath);
      const compressedPath = `generation_images/${userId}/${sessionId}/preview_${filename}`;
      const compressedRef = ref(storage, compressedPath);
      
      // Perform uploads
      const [originalResult, compressedResult] = await Promise.all([
        uploadBytes(storageRef, processedFile),
        uploadBytes(compressedRef, compressedBlob)
      ]);

      const [originalUrl, compressedUrl] = await Promise.all([
        getDownloadURL(originalResult.ref),
        getDownloadURL(compressedResult.ref)
      ]);

      // Save metadata
      const uploadId = `up_${Date.now()}`;
      const validationId = `val_${Date.now()}`;

      await Promise.all([
        setDoc(doc(db, 'file_deduplication_index', sha256), {
          fileHash: sha256,
          userId,
          originalStoragePath: storagePath,
          createdAt: new Date().toISOString(),
          reuseCount: 0
        }),
        setDoc(doc(db, 'image_uploads', uploadId), {
          id: uploadId,
          userId,
          originalFilename: file.name,
          fileSize: processedFile.size,
          fileType: processedFile.type.split('/')[1],
          mimeType: processedFile.type,
          dimensions,
          uploadTimestamp: new Date().toISOString(),
          storagePath,
          sha256,
          imageOriginalUrl: originalUrl,
          imageCompressedUrl: compressedUrl,
          exif: validationResult.exif
        }),
        setDoc(doc(db, 'generation_sessions', sessionId), {
          id: sessionId,
          userId,
          imageOriginalUrl: originalUrl,
          imageCompressedUrl: compressedUrl,
          imageMetadata: dimensions,
          base64Image: base64Image || null,
          createdAt: new Date().toISOString(),
          scanStatus: 'pending'
        }, { merge: true }),
        setDoc(doc(db, 'file_validation_results', validationId), {
          id: validationId,
          userId,
          fileHash: sha256,
          validationTimestamp: new Date().toISOString(),
          validationSteps: validationResult.steps,
          validationPassed: validationResult.allValid,
          validationErrors: validationResult.steps.filter(s => !s.valid).map(s => s.error)
        })
      ]);

      console.log('[Background] Upload and metadata saved successfully');
    } catch (err) {
      console.error('[Background] Upload failed:', err);
    }
  };

  // Trigger background upload without awaiting
  backgroundUpload();

  // Return immediately with session info
  return {
    sessionId,
    imageOriginalUrl: '', // Will be updated in DB later
    imageCompressedUrl: '',
    metadata: {
      width: dimensions.width,
      height: dimensions.height,
      sizeBytes: file.size,
      format: file.type.split('/')[1],
      sha256,
      exif: validationResult.exif
    }
  };
};

// Cache for signed URLs (stores until 50 minutes)
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Fallback cache for base64 (last resort)
const base64Cache = new Map<string, string>();

export const getSignedUrl = async (filePath: string): Promise<string> => {
  try {
    // Check cache first
    const cached = signedUrlCache.get(filePath);
    if (cached && cached.expiresAt > Date.now()) {
      console.log('Returning cached signed URL for:', filePath);
      return cached.url;
    }

    console.log('Requesting new signed URL for:', filePath);
    const response = await axios.post('/api/storage/signed-url', {
      filePath
    });

    if (!response.data.url) {
      throw new Error('No signed URL returned');
    }

    // Cache for 50 minutes (3000 seconds)
    const expiresAt = Date.now() + (50 * 60 * 1000);
    signedUrlCache.set(filePath, {
      url: response.data.url,
      expiresAt
    });

    console.log('Signed URL obtained and cached for:', filePath);
    return response.data.url;
  } catch (error: any) {
    console.error('Signed URL Error:', error.response?.data || error.message);
    throw new Error(`SIGNED_URL_FAILED: ${error.message}`);
  }
};

/**
 * Convert Firebase signed URL to proxy URL
 *
 * PROPÓSITO:
 * - Contornar CORS bloqueado
 * - Lidar com URLs assinadas expiradas
 * - Permitir fallback automático do servidor
 *
 * ENTRADA: Firebase signed URL (com token)
 * SAÍDA: Proxy URL que aponta para /api/storage/download/{path}
 *
 * SEGURANÇA:
 * - O proxy no backend valida acesso do usuário
 * - Não expõe credenciais da aplicação
 *
 * @param firebaseUrl Firebase signed URL
 * @returns Proxy URL para uso seguro no cliente
 */
export const getProxyUrl = (firebaseUrl: string): string => {
  try {
    // Parse Firebase URL to extract bucket and path
    // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token=...
    const url = new URL(firebaseUrl);
    const pathMatch = firebaseUrl.match(/\/o\/([^?]+)/);

    if (!pathMatch || !pathMatch[1]) {
      throw new Error('Invalid Firebase URL format');
    }

    const encodedPath = pathMatch[1];
    const decodedPath = decodeURIComponent(encodedPath);

    // Convert to proxy URL - será tratado pelo backend
    const proxyUrl = `/api/storage/download/${decodedPath}`;
    console.log('Converted Firebase URL to proxy URL:', proxyUrl);
    return proxyUrl;
  } catch (error: any) {
    console.error('Proxy URL Conversion Error:', error.message);
    throw new Error(`PROXY_URL_CONVERSION_FAILED: ${error.message}`);
  }
};

/**
 * Obter base64 armazenado em cache para fallback
 *
 * PROPÓSITO:
 * - Último recurso se URLs falharem
 * - Armazenar base64 em memória durante sessão
 * - Permitir retry sem novo upload
 *
 * CASOS DE USO:
 * 1. URL expirada no meio da geração
 * 2. Erro de CORS em proxy URL
 * 3. Falha temporária de rede
 *
 * LIMITAÇÕES:
 * - Armazenamento em memória (não persiste)
 * - Não é seguro para dados sensíveis
 * - Usa espaço de memória do cliente
 *
 * @param filePath Caminho do arquivo (opcional)
 * @returns Base64 string ou null
 */
export const getBase64Fallback = (filePath?: string): string | null => {
  try {
    if (filePath && base64Cache.has(filePath)) {
      console.log('Returning base64 fallback for:', filePath);
      return base64Cache.get(filePath) || null;
    }

    // Return first cached base64 if no path specified (emergency mode)
    if (base64Cache.size > 0) {
      const fallbackBase64 = base64Cache.values().next().value;
      console.log('Returning emergency base64 fallback');
      return fallbackBase64;
    }

    console.warn('No base64 fallback available');
    return null;
  } catch (error: any) {
    console.error('Base64 Fallback Error:', error.message);
    return null;
  }
};

export const uploadBase64ViaProxy = async (base64: string, path?: string): Promise<string> => {
  const filePath = path || `temp_generation/${Date.now()}`;

  try {
    // Strategy 1: Try signed URL first
    console.log('Attempting signed URL upload...');
    try {
      const signedUrl = await getSignedUrl(filePath);
      console.log('Using signed URL for upload');
      return signedUrl;
    } catch (signedUrlError) {
      console.warn('Signed URL failed, attempting fallback:', signedUrlError);
    }

    // Strategy 2: Try proxy upload
    console.log('Attempting proxy upload...');
    try {
      const response = await axios.post('/api/storage/upload', {
        base64,
        path: filePath
      });

      if (response.data.url) {
        // Try to convert to proxy URL if possible
        try {
          const proxyUrl = getProxyUrl(response.data.url);
          console.log('Upload successful, returning proxy URL');
          return proxyUrl;
        } catch {
          // Fallback to returned URL if conversion fails
          console.log('Upload successful, returning original URL');
          return response.data.url;
        }
      }
      throw new Error('No URL returned from proxy');
    } catch (proxyError) {
      console.warn('Proxy upload failed:', proxyError);
    }

    // Strategy 3: Cache base64 as last resort
    console.log('Caching base64 as last resort...');
    base64Cache.set(filePath, base64);
    console.warn('Upload failed. Base64 cached for emergency fallback');

    // Return a pseudo-URL indicating cached status
    throw new Error('UPLOAD_FAILED_BASE64_CACHED');
  } catch (error: any) {
    console.error('Upload Base64 Via Proxy Error:', error.message);
    throw new Error(`STORAGE_UPLOAD_FAILED: ${error.message}`);
  }
};
