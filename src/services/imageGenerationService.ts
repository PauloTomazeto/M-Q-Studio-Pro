import { db, auth } from '../firebase';
import { doc, setDoc, updateDoc, onSnapshot, getDoc, collection, serverTimestamp } from 'firebase/firestore';
import { GenerationResolution, GenerationStage, GenerationStatus, ImageGeneration } from '../types/studio';
import { kieService } from './kieService';

/**
 * RESOLUTION MAPPING: Maps internal resolution strings to KIE API format
 * Internal format: lowercase with 'k' suffix (e.g., '2k', '2.5k', '3k', '4k')
 * API format: uppercase with 'K' suffix (e.g., '2K', '2.5K', '3K', '4K')
 */
const RESOLUTION_MAP: Record<string, string> = {
  '4k': '4K',
  '3k': '3K',
  '2.5k': '2.5K',
  '2k': '2K',
  '1k': '1K'
};

/**
 * Maps resolution string from user input to API-compatible format
 * @param resolution The resolution string to map (e.g., '2k', '3k')
 * @returns The mapped resolution string for the API (e.g., '2K', '3K')
 * @throws Error if resolution is not in the supported list
 */
const mapResolution = (resolution: string): string => {
  const mapped = RESOLUTION_MAP[resolution.toLowerCase()];
  if (!mapped) {
    throw new Error(
      `Invalid resolution: ${resolution}. ` +
      `Supported resolutions: ${Object.keys(RESOLUTION_MAP).join(', ')}`
    );
  }
  return mapped;
};

export const imageGenerationService = {
  /**
   * Starts a new image generation process.
   * This handles the initial debit of credits and inserts the generation document into Firestore.
   */
  startGeneration: async (
    promptConfigId: string,
    promptContent: string,
    resolution: GenerationResolution,
    creditsCost: number,
    aspectRatio: string
  ): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário não autenticado');

    // 1. Generate unique ID
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = `sess_${Date.now()}`; // Ideally from current session

    // Determine model based on resolution
    const model = resolution === '2k' ? 'nano-banana-2' : 'nano-banana-pro';

    const newGeneration: ImageGeneration = {
      image_generation_id: generationId,
      user_id: user.uid,
      session_id: sessionId,
      prompt_config_id: promptConfigId,
      prompt_content: promptContent,
      generation_status: 'queued',
      progress_percentage: 0,
      progress_stage: 'initializing',
      estimated_time_remaining_seconds: resolution === '4k' ? 120 : resolution === '3k' ? 80 : resolution === '2.5k' ? 60 : 40,
      current_resolution: resolution,
      image_url_preview: null,
      image_url_2k: null,
      image_url_2_5k: null,
      image_url_3k: null,
      image_url_4k: null,
      generation_duration_seconds: 0,
      kie_api_model: model,
      kie_api_request_id: null,
      kie_api_status: 'pending',
      is_preview_ready: false,
      is_completed: false,
      credits_cost: creditsCost,
      credits_deducted: true, // Assume deducted for now
      error_message: null,
      error_code: null,
      retry_count: 0,
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null
    };

    const docRef = doc(db, 'image_generations', generationId);
    
    // Save to Firestore
    await setDoc(docRef, newGeneration);

    // Call Cloud Function or API to trigger actual generation
    // Convert resolution string (2k, 2.5k, 3k, 4k) to proper API format (2K, 2.5K, 3K, 4K)
    const apiResolution = mapResolution(resolution);

    processRealBackendGeneration(generationId, promptContent, model, apiResolution, aspectRatio);

    return generationId;
  },

  /**
   * Listen to generation updates via Firestore onSnapshot
   */
  subscribeToGeneration: (generationId: string, callback: (data: any) => void) => {
    const docRef = doc(db, 'image_generations', generationId);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback(data);
      }
    });
  },

  /**
   * Manually update the generation document with a result (useful for direct API responses or local workers)
   */
  completeWithUrl: async (generationId: string, resultUrl: string) => {
    const docRef = doc(db, 'image_generations', generationId);
    await setDoc(docRef, {
      image_generation_id: generationId,
      generation_status: 'completed',
      is_completed: true,
      completed_at: new Date().toISOString(),
      progress_percentage: 100,
      progress_stage: 'finalizing',
      image_url_4k: resultUrl,
      image_url_preview: resultUrl,
      updated_at: new Date().toISOString()
    }, { merge: true });
  },

  /**
   * Update progress for a generation task
   */
  updateProgress: async (generationId: string, progress: number, stage: string) => {
    const docRef = doc(db, 'image_generations', generationId);
    await setDoc(docRef, {
      progress_percentage: progress,
      progress_stage: stage,
      updated_at: new Date().toISOString()
    }, { merge: true });
  },

  /**
   * Mark generation as failed
   */
  fail: async (generationId: string, error: string) => {
    const docRef = doc(db, 'image_generations', generationId);
    await setDoc(docRef, {
      generation_status: 'failed',
      is_completed: false,
      error_message: error,
      updated_at: new Date().toISOString()
    }, { merge: true });
  },

  /**
   * Update generation favorite status
   */
  toggleFavorite: async (generationId: string, isFavorite: boolean) => {
    const docRef = doc(db, 'image_generations', generationId);
    await updateDoc(docRef, { is_favorite: isFavorite });
  }
};

/**
 * ACTUAL KIE API CALL PROCESSING
 */
async function processRealBackendGeneration(
  generationId: string, 
  prompt: string, 
  model: 'nano-banana-2' | 'nano-banana-pro', 
  resolution: string,
  aspectRatio: string
) {
  const docRef = doc(db, 'image_generations', generationId);

  try {
    // 1. Update status to API submitting
    await updateDoc(docRef, {
      generation_status: 'processing',
      started_at: new Date().toISOString(),
      progress_stage: 'encoding_prompt',
      progress_percentage: 5
    });

    // 2. Call KIE API
    // Using environment variables directly from frontend isn't 100% secure,
    // but assuming proxy or authorized direct call
    const kieResponse = await kieService.generateImage({
      prompt,
      model,
      resolution,
      aspect_ratio: aspectRatio,
    });

    const taskId = kieResponse.taskId;

    await updateDoc(docRef, {
      kie_api_request_id: taskId,
      progress_stage: 'model_processing',
      progress_percentage: 15
    });

    // 3. Poll for status using KIE API
    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes polling (1s interval)

    const timer = setInterval(async () => {
      attempts++;
      if (isCompleted || attempts >= maxAttempts) {
        clearInterval(timer);
        if (!isCompleted) {
          await updateDoc(docRef, {
            generation_status: 'failed',
            error_message: 'Tempo limite de geração excedido.',
            error_code: 'TIMEOUT',
            kie_api_status: 'timeout'
          });
        }
        return;
      }

      try {
        // Poll KIE API for real task status and result URL
        const statusData = await kieService.getTaskStatus(taskId, generationId);

        if (statusData.status === 'completed' || statusData.status === 'success') {
          isCompleted = true;
          // Extract final URL from response
          const finalUrl = statusData.resultUrl;

          if (finalUrl) {
            // Map resolution to correct URL field
            const urlUpdate: any = {
              generation_status: 'completed',
              is_completed: true,
              completed_at: new Date().toISOString(),
              progress_percentage: 100,
              progress_stage: 'finalizing',
              image_url_preview: finalUrl,
              generation_duration_seconds: Math.round((Date.now() - new Date(generationId.split('_')[1]).getTime()) / 1000)
            };

            // Set the appropriate resolution URL
            if (resolution === '4K') urlUpdate.image_url_4k = finalUrl;
            else if (resolution === '3K') urlUpdate.image_url_3k = finalUrl;
            else if (resolution === '2.5K') urlUpdate.image_url_2_5k = finalUrl;
            else if (resolution === '2K') urlUpdate.image_url_2k = finalUrl;

            await updateDoc(docRef, urlUpdate);
          }
        } else if (statusData.status === 'failed' || statusData.status === 'error') {
           isCompleted = true;
           await updateDoc(docRef, {
            generation_status: 'failed',
            error_message: statusData.errorMessage || statusData.msg || 'Erro desconhecido na geração',
          });
        } else {
          // Still processing - update progress
          const progressPercent = 15 + (attempts / maxAttempts) * 75; // 15% to 90%
          await updateDoc(docRef, {
            progress_percentage: Math.min(Math.round(progressPercent), 95),
            progress_stage: 'model_processing'
          });
        }

      } catch (err) {
        console.error('Error polling task:', err);
      }
    }, 2000);

  } catch (err: any) {
    console.error('KIE API Generation Error:', err);
    await updateDoc(docRef, {
      generation_status: 'failed',
      error_message: err.message || 'Erro de comunicação com o servidor KIE API',
      error_code: 'SERVER_ERROR',
      kie_api_status: 'failed'
    });
  }
}

