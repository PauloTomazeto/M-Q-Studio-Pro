
import { ImageType, TypeMetadata } from '../types/studio';

export const detectTypeFromFeatures = (scanResult: any): { type: ImageType; confidence: number; isAmbiguous: boolean; alternatives: ImageType[] } => {
  const { camera, light, typology, confidence: scanConfidence } = scanResult;
  const elevation = camera?.elevation_angle || light?.elevation_angle || 45;
  
  // Heuristic logic based on PRD
  if (elevation >= 80) {
    return { type: 'PLANTA_BAIXA', confidence: 90, isAmbiguous: false, alternatives: ['3D_MOCK'] };
  }
  
  if (elevation >= 40 && elevation < 80) {
    return { type: 'PERSPECTIVA', confidence: 85, isAmbiguous: false, alternatives: ['3D_MOCK', 'DETALHE'] };
  }
  
  if (elevation <= 15) {
    return { type: 'FACHADA', confidence: 88, isAmbiguous: false, alternatives: ['ELEVAÇÃO', 'CORTE'] };
  }

  // Fallback to typology if available
  if (typology && ['PLANTA_BAIXA', 'PERSPECTIVA', 'FACHADA', 'CORTE', 'ELEVAÇÃO', 'DETALHE', '3D_MOCK'].includes(typology)) {
    return { 
      type: typology as ImageType, 
      confidence: scanConfidence?.general || 70, 
      isAmbiguous: (scanConfidence?.general || 70) < 65,
      alternatives: [] 
    };
  }

  return { type: 'PERSPECTIVA', confidence: 45, isAmbiguous: true, alternatives: ['FACHADA', 'PLANTA_BAIXA'] };
};

export const getPresetsForType = (type: ImageType) => {
  switch (type) {
    case 'PLANTA_BAIXA':
      return {
        focusDistance: 1000,
        temperature: 5500,
        ambient: 90,
        directional: 30,
        promptMode: 'single',
        topDownAngle: 90,
        environmentType: 'URBANO',
        humanizationStyle: 'CONTEMPORANEO'
      };
    case 'PERSPECTIVA':
      return {
        focusDistance: 5.0,
        temperature: 4500,
        ambient: 60,
        directional: 70,
        promptMode: 'blocks'
      };
    case 'FACHADA':
      return {
        focusDistance: 50.0,
        temperature: 6500,
        ambient: 80,
        directional: 40,
        promptMode: 'single'
      };
    case 'CORTE':
    case 'ELEVAÇÃO':
      return {
        focusDistance: 100,
        temperature: 5000,
        ambient: 100,
        directional: 0,
        promptMode: 'single'
      };
    case 'DETALHE':
      return {
        focusDistance: 0.5,
        temperature: 5000,
        ambient: 70,
        directional: 80,
        promptMode: 'blocks'
      };
    case '3D_MOCK':
      return {
        focusDistance: 10.0,
        temperature: 5500,
        ambient: 80,
        directional: 50,
        promptMode: 'single'
      };
    default:
      return {};
  }
};
