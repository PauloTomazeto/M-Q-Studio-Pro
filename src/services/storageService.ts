import { ref, uploadBytesResumable, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { collection, doc, setDoc, query, where, getDocs, getDoc, increment, updateDoc } from 'firebase/firestore';
import { storage, db, auth, handleFirestoreError, OperationType } from '../firebase';
import heic2any from 'heic2any';
import EXIF from 'exif-js';
import { kieService } from './kieService';

// Constants from PRD
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/tiff'];
const MIN_FILE_SIZE = 300 * 1024; // 300KB
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const MAX_WIDTH = 8000;
const MAX_HEIGHT = 8000;
const CONTENT_CONFIDENCE_THRESHOLD = 0.60;

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
      const isMaintenance = err.message?.toLowerCase().includes('maintained') || err.message?.toLowerCase().includes('maintenance');
      if (isMaintenance) {
        console.warn('Content Validation skipped: KIE API is under maintenance.');
      } else {
        console.error('Content Validation Error:', err);
      }
      // Fail-safe: if the validation service fails technically, we don't block or warn the user
      // as it might be a temporary network/service issue.
      return { 
        valid: true, 
        warning: false, 
        details: { technicalError: err.message } 
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

// Helper to sanitize objects for Firestore (removes undefined)
const sanitizeForFirestore = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => sanitizeForFirestore(v));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitizeForFirestore(v)])
    );
  }
  return obj;
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
        setDoc(doc(db, 'file_deduplication_index', sha256), sanitizeForFirestore({
          fileHash: sha256,
          userId,
          originalStoragePath: storagePath,
          createdAt: new Date().toISOString(),
          reuseCount: 0
        })),
        setDoc(doc(db, 'image_uploads', uploadId), sanitizeForFirestore({
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
          exif: validationResult.exif || null
        })),
        setDoc(doc(db, 'generation_sessions', sessionId), sanitizeForFirestore({
          id: sessionId,
          userId,
          imageOriginalUrl: originalUrl,
          imageCompressedUrl: compressedUrl,
          imageMetadata: dimensions,
          base64Image: base64Image || null,
          createdAt: new Date().toISOString(),
          scanStatus: 'pending'
        }), { merge: true }),
        setDoc(doc(db, 'file_validation_results', validationId), sanitizeForFirestore({
          id: validationId || `val_${Date.now()}`,
          userId: userId || 'anonymous',
          fileHash: sha256 || 'unknown',
          validationTimestamp: new Date().toISOString(),
          validationSteps: validationResult.steps || [],
          validationPassed: !!validationResult.allValid,
          validationErrors: (validationResult.steps || []).filter(s => !s.valid).map(s => s.error || 'Unknown Validation Error')
        }))
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
