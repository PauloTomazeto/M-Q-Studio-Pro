export type ImageType = 
  | 'PLANTA_BAIXA' 
  | 'PERSPECTIVA' 
  | 'FACHADA' 
  | 'CORTE' 
  | 'ELEVAÇÃO' 
  | 'DETALHE' 
  | '3D_MOCK';

export type TopDownAngle = 90 | 80 | 60 | 45;
export type EnvironmentType = 'CONDOMINIO_ALTO_PADRAO' | 'URBANO' | 'RURAL' | 'BAIRRO_COMUM';
export type HumanizationStyle = 'MINIMALISTA' | 'TROPICAL' | 'CONTEMPORANEO';

export type TypeSource = 'gemini_ai' | 'manual_override' | 'post_process';

export interface TypeMetadata {
  imageType: ImageType;
  confidence: number;
  detectedAt: string;
  source: TypeSource;
  wasOverridden: boolean;
  isAmbiguous: boolean;
  alternativeTypes: ImageType[];
}

export const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  PLANTA_BAIXA: 'Planta Baixa',
  PERSPECTIVA: 'Perspectiva',
  FACHADA: 'Fachada',
  CORTE: 'Corte',
  ELEVAÇÃO: 'Elevação',
  DETALHE: 'Detalhe',
  '3D_MOCK': '3D Mockup'
};

export const IMAGE_TYPE_DESCRIPTIONS: Record<ImageType, string> = {
  PLANTA_BAIXA: 'Visão superior ortogonal, sem perspectiva, focada em distribuição espacial.',
  PERSPECTIVA: 'Visão interior ou exterior com profundidade, texturas e iluminação realista.',
  FACHADA: 'Visão frontal plana de exterior, sem distorção de perspectiva.',
  CORTE: 'Visão técnica ortogonal mostrando seção vertical ou horizontal.',
  ELEVAÇÃO: 'Visão lateral ou frontal ortogonal focada em alturas e proporções.',
  DETALHE: 'Foco em elementos específicos, conexões e texturas em alta resolução.',
  '3D_MOCK': 'Visão isométrica ou 3D técnica mostrando múltiplas faces.'
};

export const ENVIRONMENT_LABELS: Record<EnvironmentType, string> = {
  CONDOMINIO_ALTO_PADRAO: 'Condomínio de Alto Padrão (Brasil)',
  URBANO: 'Área Urbana (Brasil)',
  RURAL: 'Área Rural (Brasil)',
  BAIRRO_COMUM: 'Bairro Comum/Baixo Padrão (Brasil)'
};

export const HUMANIZATION_STYLE_LABELS: Record<HumanizationStyle, string> = {
  MINIMALISTA: 'Minimalista',
  TROPICAL: 'Tropical',
  CONTEMPORANEO: 'Contemporâneo'
};

export type ReflectanceType = 'matte' | 'semi-matte' | 'semi-gloss' | 'gloss' | 'espelhado';
export type TextureType = 'solid' | 'pattern' | 'natural' | 'fabric_weave' | 'rough';
export type TextureScale = 'micro' | 'fine' | 'medium' | 'coarse';
export type BumpFrequency = 'fine' | 'medium' | 'coarse';
export type BumpPattern = 'smooth' | 'subtle' | 'pronounced' | 'extreme';
export type MaterialCategory = 
  | 'paint_coating' | 'wood' | 'stone' | 'ceramic_tile' | 'glass' 
  | 'metal' | 'concrete' | 'textile' | 'plastic_composite' 
  | 'leather' | 'paper_wallpaper' | 'custom';

export interface PBRDiffuse {
  description: string;
  color_hex: string;
  color_rgb: { r: number; g: number; b: number };
  saturation: number;
  brightness: number;
  texture_type: TextureType;
  texture_scale: TextureScale;
}

export interface PBRReflection {
  intensity: number;
  fresnel_at_0: number;
  fresnel_at_90: number;
  is_metallic: boolean;
  metallic_type?: string;
}

export interface PBRGlossiness {
  smoothness: number;
  roughness: number;
  micro_surface_variation: number;
  is_isotropic: boolean;
  anisotropy_direction?: string;
  anisotropy_strength?: number;
}

export interface PBRBump {
  description: string;
  bump_height: number;
  bump_frequency: BumpFrequency;
  bump_pattern: BumpPattern;
  has_grooves?: boolean;
  groove_direction?: string;
}

export interface PBRLightBehavior {
  scattering_description: string;
  subsurface_scattering?: boolean;
  sss_depth?: number;
  ambient_occlusion_intensity?: number;
  translucency?: number;
  ior?: number;
  transmission_roughness?: number;
}

export interface Material {
  id: string;
  elemento: string;
  location_description?: string;
  location_reference?: string;
  acabamento: string;
  reflectancia: ReflectanceType;
  pbr_diffuse: PBRDiffuse;
  pbr_reflection: PBRReflection;
  pbr_glossiness: PBRGlossiness;
  pbr_bump: PBRBump;
  pbr_light_behavior: PBRLightBehavior;
  adjacent_materials?: string[];
  interaction_with_light?: string;
  confidence: number;
  confidence_factors?: string[];
  visibility: number;
  is_dominant?: boolean;
  material_category: MaterialCategory;
  is_editable?: boolean;
  edit_locked?: boolean;
  user_edited?: boolean;
  attached_image_url?: string;
  
  // Mirror specific fields
  is_mirror?: boolean;
  mirror_location_color_hex?: string;
  reflection_image_url?: string;
  reflection_analysis?: any; // Data from analyzing the reflection image
}

export interface MaterialMetrics {
  total_unique_materials: number;
  total_dominant_materials: number;
  total_secondary_materials: number;
  total_accent_materials: number;
  color_palette_range: 'monochromatic' | 'analogous' | 'complementary';
  average_reflectance: number;
  average_roughness: number;
  surface_variety: 'low' | 'medium' | 'high';
  metallic_count: number;
  translucent_count: number;
  material_compatibility: number;
}

export type LightPeriod = 
  | 'golden_hour' | 'morning' | 'afternoon' | 'late_afternoon' 
  | 'evening' | 'night' | 'blue_hour' | 'overcast' | 'indoor_artificial';

export type LightQuality = 'hard' | 'soft' | 'diffuse' | 'volumetric';
export type LightDominantSource = 'natural' | 'artificial' | 'mixed';
export type AzimuthDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface AmbientLight {
  period: LightPeriod;
  temp_k: number;
  azimuthal_direction: AzimuthDirection;
  elevation_angle: number;
  quality: LightQuality;
  dominant_source: LightDominantSource;
  indirect_ratio: string;
  light_mixing_description: string;
  bloom_glare: boolean;
  has_shadow_direction: boolean;
  is_backlit?: boolean;
  is_rim_lit?: boolean;
  confidence: number;
  confidence_factors?: string[];
}

export type LightPointType = 
  | 'rectangle' | 'sphere' | 'spot' | 'ies' | 'omni' | 'dome' | 'emissive' | 'ambient';

export type LightPointShape = 'rectangular' | 'elliptical' | 'spherical' | 'conical' | 'mesh';
export type LightDecay = 'inverse_square' | 'linear' | 'none';

export interface LightPoint {
  id: string;
  location_description: string;
  type: LightPointType;
  intensity_initial: number;
  temp_k_initial: number;
  color_hex: string;
  color_rgb: { r: number; g: number; b: number };
  shape: LightPointShape;
  decay: LightDecay;
  cone_angle?: number;
  penumbra_angle?: number;
  directionality: number; // 0-1
  shadow_softness: number; // 0-1
  ray_traced_shadows: boolean;
  affect_specular: boolean;
  affect_diffuse: boolean;
  affect_reflections: boolean;
  visible_in_render: boolean;
  spatial_x_pct: number;
  spatial_y_pct: number;
  spatial_z_depth?: 'foreground' | 'midground' | 'background';
  bloom_glare: boolean;
  lens_distortion_contribution?: number;
  artifacts_visible?: boolean;
  confidence: number;
  confidence_factors?: string[];
  is_speculative?: boolean;
  visual_impact: 'high' | 'medium' | 'low';
  serves_as: 'key_light' | 'fill_light' | 'back_light' | 'rim_light' | 'accent' | 'ambient';
  estimated_wattage?: number;
  user_added?: boolean;
  user_edited?: boolean;
}

export interface LightingMetrics {
  total_light_points: number;
  dominant_light_count: number;
  key_light_identified: boolean;
  fill_light_ratio: number;
  has_rim_light: boolean;
  has_back_light: boolean;
  shadow_quality: 'hard' | 'medium' | 'soft';
  overall_lighting_quality: 'poor' | 'fair' | 'good' | 'excellent';
  realism_score: number;
  compatibility_with_materials: number;
  bloom_potential: number;
}

export interface CameraData {
  height_m: number;
  distance_m: number;
  focal_apparent: number;
  focal_actual?: number;
  
  // Derived
  fov_horizontal: number;
  fov_vertical: number;
  depth_of_field: number;
  
  lens_distortion: {
    type: 'rectilinear' | 'fisheye' | 'panoramic';
    coefficient: number;
  };
  
  // Angles
  pitch: number;
  yaw: number;
  roll: number;
  
  // Aspect and Format
  aspect_ratio: string;
  image_width_px: number;
  image_height_px: number;
  
  // Influence
  image_type_influence: {
    floor_plan_compatible: boolean;
    perspective_type: 'isometric' | 'dimetric' | 'linear' | 'aerial' | 'worm' | 'bird' | 'frontal';
    viewing_angle: string;
  };
  
  // Perspective
  vanishing_points: number;
  perspective_lines?: {
    primary: number[];
    secondary: number[];
  };
  
  // Rendering Impact
  rendering_impact: {
    render_distance_optimal: number;
    fov_for_composition: number;
    depth_field_strength: number;
    lens_quality: 'sharp' | 'soft' | 'cinematic';
  };
  
  // Confidence
  confidence: {
    height: number;
    distance: number;
    focal: number;
    perspective: number;
    general: number;
  };
  
  detected_at: string;
  camera_preset: string;
  editable: boolean;
}

export type GenerationResolution = '2k' | '2.5k' | '3k' | '4k';
export type GenerationStatus = 'queued' | 'processing' | 'preview_ready' | 'completed' | 'failed' | 'cancelled';
export type GenerationStage = 'initializing' | 'encoding_prompt' | 'model_processing' | 'rendering' | 'post_processing' | 'finalizing';

export interface ImageGeneration {
  image_generation_id: string;
  user_id: string;
  session_id: string;
  prompt_config_id: string;
  prompt_content: string;
  generation_status: GenerationStatus;
  progress_percentage: number;
  progress_stage: GenerationStage;
  estimated_time_remaining_seconds: number;
  current_resolution: GenerationResolution;
  image_url_preview: string | null;
  image_url_2k: string | null;
  image_url_2_5k: string | null;
  image_url_3k: string | null;
  image_url_4k: string | null;
  generation_duration_seconds: number;
  kie_api_model: string;
  kie_api_request_id: string | null;
  kie_api_status: string;
  is_preview_ready: boolean;
  is_completed: boolean;
  credits_cost: number;
  credits_deducted: boolean;
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  is_favorite?: boolean;
}
