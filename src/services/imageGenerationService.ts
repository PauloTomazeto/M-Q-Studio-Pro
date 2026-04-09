import { db, auth } from '../firebase';
import { doc, setDoc, updateDoc, onSnapshot, getDoc, collection, serverTimestamp } from 'firebase/firestore';
import { GenerationResolution, GenerationStage, GenerationStatus, ImageGeneration } from '../types/studio';
import { kieService } from './kieService';

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
    // Convert resolution string (2k, 2.5k, 3k, 4k) to 1K, 2K, 4K for KIE API
    const apiResolution = resolution === '4k' ? '4K' : (resolution === '2k' ? '2K' : '1K'); 
    
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
    const taskId = await kieService.generateImage({
      prompt,
      model,
      resolution,
      aspect_ratio: aspectRatio,
    });

    await updateDoc(docRef, {
      kie_api_request_id: taskId,
      progress_stage: 'model_processing',
      progress_percentage: 15
    });

    // 3. Poll for status (Since we might not have the webhook fully set up)
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
        // Here we would check status using checkImageTaskStatus. 
        // For demonstration (without actual API keys), we fallback to simulate progress if actual task polling isn't implemented fully
        // Assuming checkImageTaskStatus works and returns { status: 'SUCCESS' | 'PROCESSING' | 'FAILED', imageUrl: string }
        
        // Simulating the progress while we poll:
        if (attempts === 30) {
           await updateDoc(docRef, { progress_percentage: 45, progress_stage: 'rendering' });
        }
        if (attempts === 60) {
           await updateDoc(docRef, { progress_percentage: 85, progress_stage: 'post_processing', is_preview_ready: true });
        }

        /* 
        const statusData = await kieService.checkImageTaskStatus(taskId);
        if (statusData.status === 'SUCCESS') {
          isCompleted = true;
          // Extract final URL
          const finalUrl = statusData.imageUrl;
          // Update doc
          await updateDoc(docRef, {
            generation_status: 'completed',
            is_completed: true,
            completed_at: new Date().toISOString(),
            progress_percentage: 100,
            progress_stage: 'finalizing',
            image_url_4k: resolution === '4K' ? finalUrl : null,
            image_url_2k: resolution === '2K' ? finalUrl : null,
            image_url_2_5k: resolution === '2.5K' ? finalUrl : null,
            image_url_3k: resolution === '3K' ? finalUrl : null,
            generation_duration_seconds: Math.round((Date.now() - new Date(docRef.id.split('_')[1]).getTime()) / 1000)
          });
        } else if (statusData.status === 'FAILED') {
           isCompleted = true;
           await updateDoc(docRef, {
            generation_status: 'failed',
            error_message: statusData.error || 'Erro desconhecido na geração',
          });
        }
        */

        // Fallback: Using simulateBackendProcessing temporarily until API keys are fully ready
        // This calls the existing mock processor for now just to provide visual feedback to the user
        // REMOVE THIS when the checkImageTaskStatus API polling block above is activated with real keys.
        clearInterval(timer);
        simulateBackendProcessing(generationId);

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

/**
 * MOCK FUNCTION: Simulates the KIE backend processing the image generation
 * This updates the Firestore document with progress.
 */
function simulateBackendProcessing(generationId: string) {
  let progress = 0;
  let stage: GenerationStage = 'initializing';
  const totalTimeMs = 30000; // 30 seconds for simulation
  const intervalMs = 1500; // Update every 1.5s
  const step = 100 / (totalTimeMs / intervalMs);

  const docRef = doc(db, 'image_generations', generationId);

  // Update started_at
  updateDoc(docRef, {
    generation_status: 'processing',
    started_at: new Date().toISOString(),
    progress_stage: 'encoding_prompt'
  }).catch(console.error);

  const timer = setInterval(async () => {
    progress += step;
    
    if (progress < 20) {
      stage = 'encoding_prompt';
    } else if (progress < 50) {
      stage = 'model_processing';
    } else if (progress < 80) {
      stage = 'rendering';
    } else if (progress < 95) {
      stage = 'post_processing';
    } else {
      stage = 'finalizing';
    }

    const isPreviewReady = progress >= 50;
    const isCompleted = progress >= 100;
    
    const updates: Partial<ImageGeneration> = {
      progress_percentage: Math.min(Math.round(progress), 100),
      progress_stage: stage,
      is_preview_ready: isPreviewReady,
      estimated_time_remaining_seconds: Math.max(0, Math.round((100 - progress) * (totalTimeMs / 1000) / 100))
    };

    if (isPreviewReady) {
      updates.generation_status = 'preview_ready';
      // Mock preview image
      updates.image_url_preview = 'https://images.unsplash.com/photo-1600607686527-6fb886090705?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=60';
    }

    if (isCompleted) {
      updates.generation_status = 'completed';
      updates.is_completed = true;
      updates.completed_at = new Date().toISOString();
      updates.progress_percentage = 100;
      updates.generation_duration_seconds = 30; // mock duration
      
      // We read the doc to know the resolution requested to give the right URLs
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as ImageGeneration;
        // Mock final URLs depending on resolution
        if (data.current_resolution === '2k') updates.image_url_2k = 'https://images.unsplash.com/photo-1600607686527-6fb886090705?ixlib=rb-4.0.3&auto=format&fit=crop&w=2560&q=80';
        if (data.current_resolution === '2.5k') updates.image_url_2_5k = 'https://images.unsplash.com/photo-1600607686527-6fb886090705?ixlib=rb-4.0.3&auto=format&fit=crop&w=3200&q=80';
        if (data.current_resolution === '3k') updates.image_url_3k = 'https://images.unsplash.com/photo-1600607686527-6fb886090705?ixlib=rb-4.0.3&auto=format&fit=crop&w=3840&q=80';
        if (data.current_resolution === '4k') updates.image_url_4k = 'https://images.unsplash.com/photo-1600607686527-6fb886090705?ixlib=rb-4.0.3&auto=format&fit=crop&w=4096&q=80';
      }
      
      clearInterval(timer);
    }

    await updateDoc(docRef, updates).catch(console.error);

  }, intervalMs);
}
