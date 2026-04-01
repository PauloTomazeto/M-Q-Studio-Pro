import { create } from 'zustand';
import { ImageType, TypeMetadata, TypeSource, Material, MaterialMetrics, AmbientLight, LightPoint, LightingMetrics, CameraData } from '../types/studio';
import { getPresetsForType } from '../utils/typeDetection';
import { validateMaterial } from '../utils/materialUtils';

export type StudioMode = 'prompt' | 'move';
export type Step = 'select' | 'upload' | 'diagnosis' | 'config' | 'result' | 'generate';

interface StudioState {
  mode: StudioMode | null;
  currentStep: Step;
  image: string | null;
  base64Image: string | null;
  imageMetadata: any | null;
  sessionId: string | null;
  scanResult: any | null;
  scanStatus: 'pending' | 'processing' | 'completed' | 'failed' | null;
  scanErrors: string[] | null;
  scanDurationMs: number | null;
  
  // Materials State
  materials: Material[];
  materialMetrics: MaterialMetrics | null;
  materialAnalysisStatus: 'idle' | 'processing' | 'completed' | 'failed';

  // Lighting State
  ambientLight: AmbientLight | null;
  lightPoints: LightPoint[];
  lightingMetrics: LightingMetrics | null;
  lightingAnalysisStatus: 'idle' | 'processing' | 'completed' | 'failed';
  
  // Camera State
  cameraData: CameraData | null;
  cameraAnalysisStatus: 'idle' | 'processing' | 'completed' | 'failed';

  // New Type Metadata
  typeMetadata: TypeMetadata | null;
  
  configParams: {
    temperature: number;
    ambient: number;
    directional: number;
    reflections: number;
    brightness: number;
    saturation: number;
    contrast: number;
    vibrance: number;
    hue_shift: number;
    shadows_black_point: number;
    highlights_white_point: number;
    color_grading_config: {
      mode: string;
      lut_applied: boolean;
      colorspace: string;
      tone_curve_preset: string;
    };
    color_grading_preset: string | null;
    dofEnabled: boolean;
    fNumber: number;
    focusDistance: number;
    bokehShape: string;
    bokehSmoothness: number;
    chromaticAberration: number;
    vignette: number;
    lensFlare: boolean;
    motionBlur: number;
    grain: number;
    promptMode: 'single' | 'blocks';
    topDownAngle: number;
    environmentType: string;
    atmosphere_type: 'clear' | 'cloudy' | 'overcast' | 'sunset' | 'night' | 'dramatic' | 'foggy';
    fog_density: number;
    fog_color: string;
    fog_distance: number;
    bloom_intensity: number;
    bloom_threshold: number;
    bloom_enabled: boolean;
    bloom_radius: number;
    bloom_softness: number;
    bloom_color_tint: string;
    bloom_quality: 'low' | 'medium' | 'high';
    color_temperature_source: 'detected' | 'preset' | 'manual';
    color_temperature_preset_name: string | null;
  };
  generatedPrompt: string | null;
  generatedBlocks: any[] | null;
  qualityBreakdown: {
    clarity: number;
    specificity: number;
    coherence: number;
    brevity: number;
  } | null;
  promptId: string | null;
  isModeLocked: boolean;
  cachedPrompts: {
    single: string | null;
    blocks: any[] | null;
  };
  availableModes: ('single' | 'blocks')[];
  isComparing: boolean;
  generationResult: any | null;
  lastUsedMode: StudioMode | null;
  
  // Image Generation State
  selectedModel: 'nano-banana-2' | 'nano-banana-pro';
  selectedResolution: '1K' | '2K' | '4K';
  selectedAspectRatio: '1:1' | '16:9' | '9:16' | '5:4' | '4:5' | '3:4' | '4:3';
  generationTask: {
    taskId: string;
    status: 'queued' | 'processing' | 'preview_ready' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    stage?: string;
    resultUrl?: string;
    error?: string;
    estimatedTimeRemaining?: number;
    startTime?: number;
  } | null;
  isGenerating: boolean;
  mirrorImage: string | null;
  mainImageUrl: string | null;
  mirrorImageUrl: string | null;
  
  setMode: (mode: StudioMode) => void;
  setStep: (step: Step) => void;
  setImage: (image: string | null, metadata?: any) => void;
  setBase64Image: (base64: string | null) => void;
  setSessionId: (id: string | null) => void;
  setScanResult: (result: any, durationMs?: number) => void;
  setScanStatus: (status: 'pending' | 'processing' | 'completed' | 'failed') => void;
  setScanErrors: (errors: string[] | null) => void;
  
  // Material Actions
  setMaterials: (materials: Material[]) => void;
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  setMaterialMetrics: (metrics: MaterialMetrics) => void;
  setMaterialAnalysisStatus: (status: 'idle' | 'processing' | 'completed' | 'failed') => void;

  // Lighting Actions
  setAmbientLight: (light: AmbientLight) => void;
  setLightPoints: (points: LightPoint[]) => void;
  addLightPoint: (point: LightPoint) => void;
  updateLightPoint: (id: string, updates: Partial<LightPoint>) => void;
  deleteLightPoint: (id: string) => void;
  setLightingMetrics: (metrics: LightingMetrics) => void;
  setLightingAnalysisStatus: (status: 'idle' | 'processing' | 'completed' | 'failed') => void;

  // Camera Actions
  setCameraData: (data: CameraData) => void;
  updateCameraData: (updates: Partial<CameraData>) => void;
  setCameraAnalysisStatus: (status: 'idle' | 'processing' | 'completed' | 'failed') => void;

  // New Type Actions
  setImageType: (type: ImageType, source: TypeSource, confidence?: number, alternatives?: ImageType[]) => void;
  
  updateConfig: (params: any) => void;
  setGeneratedPrompt: (prompt: string | null) => void;
  setGeneratedBlocks: (blocks: any[] | null) => void;
  setQualityBreakdown: (breakdown: any | null) => void;
  setPromptId: (id: string | null) => void;
  setIsModeLocked: (locked: boolean) => void;
  setCachedPrompt: (mode: 'single' | 'blocks', content: any) => void;
  setIsComparing: (comparing: boolean) => void;
  setAvailableModes: (modes: ('single' | 'blocks')[]) => void;
  setGenerationResult: (result: any) => void;
  
  // Image Generation Actions
  setSelectedModel: (model: 'nano-banana-2' | 'nano-banana-pro') => void;
  setSelectedResolution: (resolution: '1K' | '2K' | '4K') => void;
  setSelectedAspectRatio: (ratio: '1:1' | '16:9' | '9:16' | '5:4' | '4:5' | '3:4' | '4:3') => void;
  setGenerationTask: (task: any | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setMirrorImage: (image: string | null) => void;
  setMainImageUrl: (url: string | null) => void;
  setMirrorImageUrl: (url: string | null) => void;
  
  reset: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  mode: sessionStorage.getItem('studioMode') as StudioMode | null,
  currentStep: 'select',
  image: null,
  base64Image: null,
  imageMetadata: null,
  sessionId: null,
  scanResult: null,
  scanStatus: null,
  scanErrors: null,
  scanDurationMs: null,
  
  materials: [],
  materialMetrics: null,
  materialAnalysisStatus: 'idle',

  ambientLight: null,
  lightPoints: [],
  lightingMetrics: null,
  lightingAnalysisStatus: 'idle',

  cameraData: null,
  cameraAnalysisStatus: 'idle',

  typeMetadata: null,
  
  configParams: {
    temperature: 5500,
    ambient: 70,
    directional: 60,
    reflections: 50,
    brightness: 0,
    saturation: 0,
    contrast: 0,
    vibrance: 0,
    hue_shift: 0,
    shadows_black_point: 0,
    highlights_white_point: 0,
    color_grading_config: {
      mode: 'standard',
      lut_applied: false,
      colorspace: 'srgb',
      tone_curve_preset: 'standard'
    },
    color_grading_preset: null,
    dofEnabled: false,
    fNumber: 8.0,
    focusDistance: 5.0,
    bokehShape: 'circular',
    bokehSmoothness: 70,
    chromaticAberration: 0,
    vignette: 0,
    lensFlare: false,
    motionBlur: 0,
    grain: 0,
    promptMode: 'single',
    topDownAngle: 90,
    environmentType: 'URBANO',
    atmosphere_type: 'clear',
    fog_density: 0,
    fog_color: '#ffffff',
    fog_distance: 1000,
    bloom_intensity: 0,
    bloom_threshold: 1.0,
    bloom_enabled: true,
    bloom_radius: 8,
    bloom_softness: 0.8,
    bloom_color_tint: '#ffffff',
    bloom_quality: 'high',
    color_temperature_source: 'detected',
    color_temperature_preset_name: null,
  },
  generatedPrompt: null,
  generatedBlocks: null,
  qualityBreakdown: null,
  promptId: null,
  isModeLocked: false,
  cachedPrompts: {
    single: null,
    blocks: null,
  },
  availableModes: ['single', 'blocks'], // Default to both, will be filtered by plan later
  isComparing: false,
  generationResult: null,
  lastUsedMode: localStorage.getItem('lastUsedMode') as StudioMode | null,
  
  selectedModel: 'nano-banana-2',
  selectedResolution: '1K',
  selectedAspectRatio: '1:1',
  generationTask: null,
  isGenerating: false,
  mirrorImage: null,
  mainImageUrl: null,
  mirrorImageUrl: null,

  setMode: (mode) => {
    sessionStorage.setItem('studioMode', mode);
    localStorage.setItem('lastUsedMode', mode);
    set({ mode, lastUsedMode: mode });
  },
  setStep: (currentStep) => set({ currentStep }),
  setImage: (image, imageMetadata) => set({ image, imageMetadata }),
  setBase64Image: (base64Image) => set({ base64Image }),
  setSessionId: (sessionId) => set({ sessionId }),
  setScanResult: (scanResult, scanDurationMs) => {
    const rawMaterials = scanResult?.materials || [];
    const validatedMaterials = rawMaterials.map((m: any, i: number) => {
      const material = {
        ...m,
        id: m.id || `mat_${i + 1}`,
        confidence: m.confidence || 85,
        visibility: m.visibility || 50,
        material_category: m.material_category || 'custom'
      };
      return validateMaterial(material);
    });

    // Map qualitative lighting to percentages
    const mapQuality = (q: string | undefined) => {
      if (q === 'high') return 70;
      if (q === 'medium') return 50;
      if (q === 'low') return 30;
      return 50;
    };

    const ambientVal = scanResult?.light?.quality === 'soft' || scanResult?.light?.quality === 'diffuse' ? 70 : 50;
    const keyLight = scanResult?.lightPoints?.find((lp: any) => lp.serves_as === 'key_light');
    const directionalVal = mapQuality(keyLight?.visual_impact || 'medium');
    
    // Reflections based on dominant material reflectance
    const dominantMat = validatedMaterials.find(m => m.is_dominant);
    let reflectionsVal = 50;
    if (dominantMat) {
      if (dominantMat.reflectancia === 'espelhado' || dominantMat.reflectancia === 'gloss') reflectionsVal = 70;
      else if (dominantMat.reflectancia === 'matte') reflectionsVal = 30;
    }

    // Atmosphere Detection
    const period = scanResult?.light?.period;
    let atmosphere: any = 'clear';
    let fogDensity = 0;
    let fogColor = '#ffffff';
    let fogDistance = 1000;
    let bloomIntensityVal = 10;
    let bloomThresholdVal = 1.2;
    let bloomColorTintVal = '#ffffff';

    // Color Grading Initial Suggestions
    let initialSaturation = 0;
    let initialContrast = 0;
    let initialVibrance = 0;
    let initialHueShift = 0;
    let initialShadows = 0;
    let initialHighlights = 0;
    let initialPreset = 'natural';

    if (period === 'sunset') {
      atmosphere = 'sunset';
      fogDensity = 20;
      fogColor = '#ff9900';
      fogDistance = 700;
      bloomIntensityVal = 50;
      bloomThresholdVal = 0.7;
      bloomColorTintVal = '#ffaa33';
      initialSaturation = 30;
      initialContrast = 15;
      initialVibrance = 25;
      initialHueShift = 25;
      initialPreset = 'golden_hour';
    } else if (period === 'night') {
      atmosphere = 'night';
      fogDensity = 10;
      fogColor = '#1a1a2e';
      fogDistance = 300;
      bloomIntensityVal = 30;
      bloomThresholdVal = 0.6;
      bloomColorTintVal = '#ffddaa';
      initialContrast = 20;
      initialShadows = -20;
      initialPreset = 'moody_blue';
    } else if (scanResult?.light?.quality === 'overcast' || scanResult?.light?.quality === 'diffuse') {
      atmosphere = 'cloudy';
      fogDensity = 15;
      fogColor = '#e0e0e0';
      fogDistance = 800;
      bloomIntensityVal = 5;
      bloomThresholdVal = 1.5;
      initialSaturation = -10;
      initialContrast = -5;
      initialPreset = 'pastel';
    } else {
      // Clear/Default
      initialSaturation = 10;
      initialContrast = 15;
      initialPreset = 'natural';
    }

    // Override with AI detected values if present
    if (scanResult?.light?.bloom_intensity !== undefined) bloomIntensityVal = scanResult.light.bloom_intensity;
    if (scanResult?.light?.bloom_threshold !== undefined) bloomThresholdVal = scanResult.light.bloom_threshold;
    if (scanResult?.light?.bloom_color_tint !== undefined) bloomColorTintVal = scanResult.light.bloom_color_tint;

    set((state) => ({ 
      scanResult, 
      scanDurationMs, 
      scanStatus: 'completed',
      materials: validatedMaterials,
      ambientLight: scanResult?.light || null,
      lightPoints: scanResult?.lightPoints || [],
      lightingAnalysisStatus: 'completed',
      cameraData: scanResult?.cameraData || null,
      cameraAnalysisStatus: 'completed',
      configParams: {
        ...state.configParams,
        temperature: scanResult?.light?.temp_k || state.configParams.temperature,
        ambient: ambientVal,
        directional: directionalVal,
        reflections: reflectionsVal,
        atmosphere_type: atmosphere,
        fog_density: fogDensity,
        fog_color: fogColor,
        fog_distance: fogDistance,
        bloom_intensity: bloomIntensityVal,
        bloom_threshold: bloomThresholdVal,
        bloom_color_tint: bloomColorTintVal,
        saturation: initialSaturation,
        contrast: initialContrast,
        vibrance: initialVibrance,
        hue_shift: initialHueShift,
        shadows_black_point: initialShadows,
        highlights_white_point: initialHighlights,
        color_grading_preset: initialPreset,
        color_temperature_source: 'detected'
      }
    }));
  },
  setScanStatus: (scanStatus) => set({ scanStatus }),
  setScanErrors: (scanErrors) => set({ scanErrors, scanStatus: 'failed' }),
  
  setMaterials: (materials) => set({ materials }),
  addMaterial: (material) => set((state) => ({
    materials: [...state.materials, validateMaterial(material)]
  })),
  updateMaterial: (id, updates) => set((state) => ({
    materials: state.materials.map(m => {
      if (m.id === id) {
        const updated = { ...m, ...updates, user_edited: true };
        return validateMaterial(updated);
      }
      return m;
    })
  })),
  setMaterialMetrics: (materialMetrics) => set({ materialMetrics }),
  setMaterialAnalysisStatus: (materialAnalysisStatus) => set({ materialAnalysisStatus }),

  setAmbientLight: (ambientLight) => set({ ambientLight }),
  setLightPoints: (lightPoints) => set({ lightPoints }),
  addLightPoint: (point) => set((state) => ({
    lightPoints: [...state.lightPoints, point]
  })),
  updateLightPoint: (id, updates) => set((state) => ({
    lightPoints: state.lightPoints.map(p => p.id === id ? { ...p, ...updates, user_edited: true } : p)
  })),
  deleteLightPoint: (id) => set((state) => ({
    lightPoints: state.lightPoints.filter(p => p.id !== id)
  })),
  setLightingMetrics: (lightingMetrics) => set({ lightingMetrics }),
  setLightingAnalysisStatus: (lightingAnalysisStatus) => set({ lightingAnalysisStatus }),

  setCameraData: (cameraData) => set({ cameraData }),
  updateCameraData: (updates) => set((state) => ({
    cameraData: state.cameraData ? { ...state.cameraData, ...updates } : null
  })),
  setCameraAnalysisStatus: (cameraAnalysisStatus) => set({ cameraAnalysisStatus }),

  setImageType: (type, source, confidence = 100, alternatives = []) => {
    const presets = getPresetsForType(type);
    const { sessionId } = useStudioStore.getState();
    
    // Update Firestore if we have a session
    if (sessionId) {
      import('../firebase').then(({ db }) => {
        import('firebase/firestore').then(({ doc, updateDoc }) => {
          updateDoc(doc(db, 'generation_sessions', sessionId), {
            image_type: type,
            image_type_confidence: confidence,
            type_detected_at: new Date().toISOString(),
            type_source: source,
            was_overridden: source === 'manual_override'
          }).catch(e => console.warn('Failed to update type metadata in store action:', e));
        });
      });
    }

    set((state): Partial<StudioState> => {
      // Refine presets with scanResult data if available
      const refinedPresets: any = { ...presets };
      if (state.scanResult) {
        if (state.scanResult.light?.temp_k) refinedPresets.temperature = state.scanResult.light.temp_k;
      }

      return {
        typeMetadata: {
          imageType: type,
          confidence,
          detectedAt: new Date().toISOString(),
          source,
          wasOverridden: source === 'manual_override',
          isAmbiguous: confidence < 65,
          alternativeTypes: alternatives
        },
        configParams: { ...state.configParams, ...refinedPresets }
      };
    });
  },

  updateConfig: (params) => {
    set((state) => ({ 
      configParams: { ...state.configParams, ...params },
      // Invalidate cache if config changes
      cachedPrompts: { single: null, blocks: null }
    }));
  },
  setGeneratedPrompt: (generatedPrompt) => set({ generatedPrompt }),
  setGeneratedBlocks: (generatedBlocks) => set({ generatedBlocks }),
  setQualityBreakdown: (qualityBreakdown) => set({ qualityBreakdown }),
  setPromptId: (promptId) => set({ promptId }),
  setIsModeLocked: (isModeLocked) => set({ isModeLocked }),
  setCachedPrompt: (mode, content) => set((state) => ({
    cachedPrompts: {
      ...state.cachedPrompts,
      [mode]: content
    }
  })),
  setIsComparing: (isComparing) => set({ isComparing }),
  setAvailableModes: (availableModes) => set({ availableModes }),
  setGenerationResult: (generationResult) => set({ generationResult }),
  
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setSelectedResolution: (selectedResolution) => set({ selectedResolution }),
  setSelectedAspectRatio: (selectedAspectRatio) => set({ selectedAspectRatio }),
  setGenerationTask: (generationTask) => set({ generationTask }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setMirrorImage: (mirrorImage) => set({ mirrorImage }),
  setMainImageUrl: (mainImageUrl) => set({ mainImageUrl }),
  setMirrorImageUrl: (mirrorImageUrl) => set({ mirrorImageUrl }),

  reset: () => set({
    mode: null,
    currentStep: 'select',
    image: null,
    base64Image: null,
    imageMetadata: null,
    sessionId: null,
    scanResult: null,
    scanStatus: null,
    scanErrors: null,
    scanDurationMs: null,
    materials: [],
    materialMetrics: null,
    materialAnalysisStatus: 'idle',
    ambientLight: null,
    lightPoints: [],
    lightingMetrics: null,
    lightingAnalysisStatus: 'idle',
    cameraData: null,
    cameraAnalysisStatus: 'idle',
    generatedPrompt: null,
    generatedBlocks: null,
    qualityBreakdown: null,
    promptId: null,
    isModeLocked: false,
    cachedPrompts: {
      single: null,
      blocks: null,
    },
    isComparing: false,
    generationResult: null,
    selectedModel: 'nano-banana-2',
    selectedResolution: '1K',
    selectedAspectRatio: '1:1',
    generationTask: null,
    isGenerating: false,
    mirrorImage: null,
    mainImageUrl: null,
    mirrorImageUrl: null,
  }),
}));
