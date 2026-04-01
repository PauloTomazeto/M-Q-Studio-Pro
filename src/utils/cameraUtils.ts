import { CameraData } from '../types/studio';

export const CAMERA_PRESETS: Record<string, Partial<CameraData>> = {
  'eye_level_standard': {
    height_m: 1.6,
    distance_m: 5,
    focal_apparent: 50,
    pitch: 0,
    lens_distortion: { type: 'rectilinear', coefficient: 0 },
    rendering_impact: {
      render_distance_optimal: 6,
      fov_for_composition: 40,
      depth_field_strength: 10,
      lens_quality: 'sharp'
    }
  },
  'heroic_worms_eye': {
    height_m: 0.5,
    distance_m: 2,
    focal_apparent: 18,
    pitch: 40,
    lens_distortion: { type: 'rectilinear', coefficient: 0.2 },
    rendering_impact: {
      render_distance_optimal: 2.4,
      fov_for_composition: 90,
      depth_field_strength: 40,
      lens_quality: 'cinematic'
    }
  },
  'birds_eye_plan': {
    height_m: 3.5,
    distance_m: 50,
    focal_apparent: 28,
    pitch: -75,
    lens_distortion: { type: 'rectilinear', coefficient: 0 },
    rendering_impact: {
      render_distance_optimal: 60,
      fov_for_composition: 75,
      depth_field_strength: 5,
      lens_quality: 'sharp'
    }
  },
  'architectural': {
    height_m: 1.7,
    distance_m: 12,
    focal_apparent: 35,
    pitch: -5,
    lens_distortion: { type: 'rectilinear', coefficient: 0 },
    rendering_impact: {
      render_distance_optimal: 14.4,
      fov_for_composition: 55,
      depth_field_strength: 15,
      lens_quality: 'sharp'
    }
  },
  'intimate_detail': {
    height_m: 1.2,
    distance_m: 1,
    focal_apparent: 85,
    pitch: -20,
    lens_distortion: { type: 'rectilinear', coefficient: 0 },
    rendering_impact: {
      render_distance_optimal: 1.2,
      fov_for_composition: 25,
      depth_field_strength: 80,
      lens_quality: 'soft'
    }
  },
  'immersive_wide': {
    height_m: 1.6,
    distance_m: 2,
    focal_apparent: 24,
    pitch: 0,
    lens_distortion: { type: 'rectilinear', coefficient: 0.1 },
    rendering_impact: {
      render_distance_optimal: 2.4,
      fov_for_composition: 84,
      depth_field_strength: 20,
      lens_quality: 'cinematic'
    }
  }
};

export const calculateFOV = (focal: number, sensorWidth = 36, sensorHeight = 24) => {
  const hFOV = 2 * Math.atan(sensorWidth / (2 * focal)) * (180 / Math.PI);
  const vFOV = 2 * Math.atan(sensorHeight / (2 * focal)) * (180 / Math.PI);
  return { hFOV, vFOV };
};

export const calculateDOF = (focal: number, distance: number) => {
  // Simplified DOF percentage calculation for rendering context
  // High focal + low distance = low DOF (more blur)
  const base = 100 / (focal / distance);
  return Math.min(100, Math.max(0, base));
};

export const getCameraPreset = (data: CameraData): string => {
  // Logic to find the closest preset based on parameters
  // For now, we'll just return the one stored in data or 'custom'
  return data.camera_preset || 'custom';
};

export const validateCameraData = (data: CameraData): { valid: boolean; warnings: string[] } => {
  const warnings: string[] = [];
  
  if (data.height_m < 0.3) warnings.push("Altura muito próxima do chão");
  if (data.height_m > 5.0) warnings.push("Altura excessiva");
  
  if (data.distance_m < 0.5) warnings.push("Distância muito curta, distorção extrema");
  if (data.distance_m > 200) warnings.push("Distância muito longa, perda de detalhes");
  
  if (data.distance_m <= data.height_m) warnings.push("Câmera pode estar dentro do objeto (Distância <= Altura)");
  
  if (data.focal_apparent < 14) warnings.push("Ultra grande angular, distorção de peixe");
  if (data.focal_apparent > 200) warnings.push("Telefoto, comprime perspectiva");
  
  if (Math.abs(data.roll) > 20) warnings.push("Composição inclinada (Roll > 20°)");
  
  return {
    valid: warnings.length === 0,
    warnings
  };
};
