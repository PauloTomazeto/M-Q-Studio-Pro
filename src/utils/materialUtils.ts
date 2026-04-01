import { Material, MaterialMetrics, MaterialCategory } from '../types/studio';

export const MIN_MATERIAL_VISIBILITY = 5;
export const MIN_CONFIDENCE_ANALYSIS = 50;
export const MAX_MATERIALS_LIMIT = 20;

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'paint_coating', 'wood', 'stone', 'ceramic_tile', 'glass', 
  'metal', 'concrete', 'textile', 'plastic_composite', 
  'leather', 'paper_wallpaper', 'custom'
];

export const validateMaterial = (material: Material): Material => {
  const m = { ...material };

  // Clip PBR values to 0-1
  m.pbr_reflection.intensity = Math.max(0, Math.min(1, m.pbr_reflection.intensity));
  m.pbr_reflection.fresnel_at_0 = Math.max(0, Math.min(1, m.pbr_reflection.fresnel_at_0));
  m.pbr_reflection.fresnel_at_90 = Math.max(0, Math.min(1, m.pbr_reflection.fresnel_at_90));
  
  m.pbr_glossiness.smoothness = Math.max(0, Math.min(1, m.pbr_glossiness.smoothness));
  m.pbr_glossiness.roughness = 1 - m.pbr_glossiness.smoothness;
  m.pbr_glossiness.micro_surface_variation = Math.max(0, Math.min(1, m.pbr_glossiness.micro_surface_variation));
  
  m.pbr_bump.bump_height = Math.max(0, Math.min(1, m.pbr_bump.bump_height));
  
  if (m.pbr_light_behavior.sss_depth !== undefined) {
    m.pbr_light_behavior.sss_depth = Math.max(0, Math.min(50, m.pbr_light_behavior.sss_depth));
  }
  
  if (m.pbr_light_behavior.ior !== undefined) {
    m.pbr_light_behavior.ior = Math.max(1.0, Math.min(2.5, m.pbr_light_behavior.ior));
  }

  // Calculate reflectance based on formula
  // reflectance = reflection_intensity × (0.5 + glossiness × 0.5) × 100
  const reflectanceValue = m.pbr_reflection.intensity * (0.5 + m.pbr_glossiness.smoothness * 0.5) * 100;
  
  if (reflectanceValue <= 20) m.reflectancia = 'matte';
  else if (reflectanceValue <= 40) m.reflectancia = 'semi-matte';
  else if (reflectanceValue <= 70) m.reflectancia = 'semi-gloss';
  else if (reflectanceValue <= 95) m.reflectancia = 'gloss';
  else m.reflectancia = 'espelhado';

  return m;
};

export const calculateMaterialMetrics = (materials: Material[]): MaterialMetrics => {
  const total_unique_materials = materials.length;
  const total_dominant_materials = materials.filter(m => m.visibility > 50).length;
  const total_secondary_materials = materials.filter(m => m.visibility >= 10 && m.visibility <= 50).length;
  const total_accent_materials = materials.filter(m => m.visibility < 10).length;

  const avg_reflectance = materials.reduce((acc, m) => {
    const r = m.pbr_reflection.intensity * (0.5 + m.pbr_glossiness.smoothness * 0.5) * 100;
    return acc + r;
  }, 0) / (total_unique_materials || 1);

  const avg_roughness = materials.reduce((acc, m) => acc + m.pbr_glossiness.roughness, 0) / (total_unique_materials || 1);

  const metallic_count = materials.filter(m => m.pbr_reflection.is_metallic).length;
  const translucent_count = materials.filter(m => (m.pbr_light_behavior.translucency || 0) > 0).length;

  // Simple compatibility logic
  let compatibility = 80;
  materials.forEach(m => {
    if (m.pbr_reflection.is_metallic && (m.pbr_light_behavior.translucency || 0) > 0.5) {
      compatibility -= 5; // Potential blooming/glare issues
    }
  });

  return {
    total_unique_materials,
    total_dominant_materials,
    total_secondary_materials,
    total_accent_materials,
    color_palette_range: 'monochromatic', // Placeholder
    average_reflectance: avg_reflectance,
    average_roughness: avg_roughness,
    surface_variety: total_unique_materials > 10 ? 'high' : total_unique_materials > 5 ? 'medium' : 'low',
    metallic_count,
    translucent_count,
    material_compatibility: Math.max(0, Math.min(100, compatibility))
  };
};

export const createBlankMaterial = (id: string): Material => {
  return {
    id,
    elemento: 'Novo Material',
    acabamento: 'Padrão',
    reflectancia: 'matte',
    material_category: 'custom',
    confidence: 100,
    visibility: 50,
    pbr_diffuse: {
      description: 'Cor sólida',
      color_hex: '#808080',
      color_rgb: { r: 128, g: 128, b: 128 },
      saturation: 0,
      brightness: 50,
      texture_type: 'solid',
      texture_scale: 'medium'
    },
    pbr_reflection: {
      intensity: 0.1,
      fresnel_at_0: 0.04,
      fresnel_at_90: 1,
      is_metallic: false
    },
    pbr_glossiness: {
      smoothness: 0.5,
      roughness: 0.5,
      micro_surface_variation: 0.2,
      is_isotropic: true
    },
    pbr_bump: {
      description: 'Superfície lisa',
      bump_height: 0,
      bump_frequency: 'medium',
      bump_pattern: 'smooth'
    },
    pbr_light_behavior: {
      scattering_description: 'Diffuse',
      ior: 1.5
    }
  };
};

export const getCategoryDefaults = (category: MaterialCategory): Partial<Material> => {
  switch (category) {
    case 'wood':
      return {
        reflectancia: 'semi-matte',
        pbr_reflection: { intensity: 0.15, fresnel_at_0: 0.04, fresnel_at_90: 1, is_metallic: false },
        pbr_glossiness: { smoothness: 0.4, roughness: 0.6, micro_surface_variation: 0.3, is_isotropic: false, anisotropy_direction: 'vertical' },
        pbr_light_behavior: { scattering_description: 'Diffuse absorption', ior: 1.5 }
      };
    case 'metal':
      return {
        reflectancia: 'gloss',
        pbr_reflection: { intensity: 0.9, fresnel_at_0: 0.8, fresnel_at_90: 1, is_metallic: true, metallic_type: 'steel' },
        pbr_glossiness: { smoothness: 0.9, roughness: 0.1, micro_surface_variation: 0.1, is_isotropic: true },
        pbr_light_behavior: { scattering_description: 'Specular reflection', ior: 2.0 }
      };
    case 'glass':
      return {
        reflectancia: 'gloss',
        pbr_reflection: { intensity: 0.1, fresnel_at_0: 0.04, fresnel_at_90: 1, is_metallic: false },
        pbr_glossiness: { smoothness: 1.0, roughness: 0, micro_surface_variation: 0, is_isotropic: true },
        pbr_light_behavior: { scattering_description: 'Transparent', translucency: 1, ior: 1.52 }
      };
    default:
      return {};
  }
};
