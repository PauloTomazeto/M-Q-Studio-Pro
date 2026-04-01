import { LightPoint, LightingMetrics, AmbientLight } from '../types/studio';

export const createBlankLightPoint = (x: number = 50, y: number = 50): LightPoint => {
  return {
    id: `light-${Math.random().toString(36).substr(2, 9)}`,
    location_description: 'Novo ponto de luz',
    type: 'rectangle',
    intensity_initial: 50,
    temp_k_initial: 3200,
    color_hex: '#ffffff',
    color_rgb: { r: 255, g: 255, b: 255 },
    shape: 'rectangular',
    decay: 'inverse_square',
    directionality: 0.5,
    shadow_softness: 0.5,
    ray_traced_shadows: true,
    affect_specular: true,
    affect_diffuse: true,
    affect_reflections: true,
    visible_in_render: true,
    spatial_x_pct: x,
    spatial_y_pct: y,
    spatial_z_depth: 'midground',
    bloom_glare: false,
    confidence: 100,
    visual_impact: 'medium',
    serves_as: 'accent',
    user_added: true
  };
};

export const calculateLightingMetrics = (
  ambientLight: AmbientLight | null,
  lightPoints: LightPoint[]
): LightingMetrics => {
  const total_light_points = lightPoints.length;
  const dominant_light_count = lightPoints.filter(p => p.visual_impact === 'high').length;
  const key_light_identified = lightPoints.some(p => p.serves_as === 'key_light');
  const has_rim_light = lightPoints.some(p => p.serves_as === 'rim_light');
  const has_back_light = lightPoints.some(p => p.serves_as === 'back_light');
  
  const fill_lights = lightPoints.filter(p => p.serves_as === 'fill_light');
  const key_lights = lightPoints.filter(p => p.serves_as === 'key_light');
  const fill_light_ratio = key_lights.length > 0 ? fill_lights.length / key_lights.length : 0;

  const avg_shadow_softness = lightPoints.length > 0 
    ? lightPoints.reduce((acc, p) => acc + p.shadow_softness, 0) / lightPoints.length
    : 0.5;

  let shadow_quality: 'hard' | 'medium' | 'soft' = 'medium';
  if (avg_shadow_softness < 0.3) shadow_quality = 'hard';
  else if (avg_shadow_softness > 0.7) shadow_quality = 'soft';

  return {
    total_light_points,
    dominant_light_count,
    key_light_identified,
    fill_light_ratio,
    has_rim_light,
    has_back_light,
    shadow_quality,
    overall_lighting_quality: 'good',
    realism_score: 85,
    compatibility_with_materials: 90,
    bloom_potential: lightPoints.filter(p => p.bloom_glare).length / (lightPoints.length || 1)
  };
};

export const kelvinToColor = (kelvin: number) => {
  // Simplified Kelvin to RGB conversion for UI preview
  if (kelvin < 4000) return 'text-orange-400';
  if (kelvin < 6000) return 'text-yellow-200';
  return 'text-blue-200';
};
