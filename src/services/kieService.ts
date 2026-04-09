import axios from 'axios';
import { z } from 'zod';
import { db, auth } from '../firebase';
import { usageService } from './usageService';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  runTransaction, 
  collection, 
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { uploadTempImage, deleteTempImage } from './storageService';

// Zod Schema for ScanResult
const PBRDiffuseSchema = z.object({
  description: z.string().optional(),
  color_hex: z.string().optional(),
  color_rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }).optional(),
  saturation: z.number().nullish(),
  brightness: z.number().nullish(),
  texture_type: z.string().optional(),
  texture_scale: z.string().optional()
});

const PBRReflectionSchema = z.object({
  intensity: z.number().nullish(),
  fresnel_at_0: z.number().nullish(),
  fresnel_at_90: z.number().nullish(),
  is_metallic: z.boolean().nullish(),
  metallic_type: z.string().optional()
});

const PBRGlossinessSchema = z.object({
  smoothness: z.number().nullish(),
  roughness: z.number().nullish(),
  micro_surface_variation: z.number().nullish(),
  is_isotropic: z.boolean().nullish(),
  anisotropy_direction: z.string().optional(),
  anisotropy_strength: z.number().optional()
});

const PBRBumpSchema = z.object({
  description: z.string().optional(),
  bump_height: z.number().nullish(),
  bump_frequency: z.string().optional(),
  bump_pattern: z.string().optional(),
  has_grooves: z.boolean().optional(),
  groove_direction: z.string().optional()
});

const PlantaTypeSchema = z.enum(['A', 'B', 'C', 'D']);

const AmbienteSchema = z.object({
  id: z.number(),
  nome: z.string(),
  area_m2: z.number().optional(),
  tipo: z.enum(['interno', 'externo', 'semi-externo', 'circulacao', 'servico', 'molhado']),
  posicao_no_lote: z.string().optional(),
  adjacencias: z.array(z.string()).optional(),
  aberturas: z.array(z.string()).optional(),
  equipamentos_fixos: z.array(z.string()).optional(),
  veiculos: z.array(z.string()).optional()
});

const PBRLightBehaviorSchema = z.object({
  scattering_description: z.string().optional(),
  subsurface_scattering: z.boolean().optional(),
  sss_depth: z.number().optional(),
  ambient_occlusion_intensity: z.number().optional(),
  translucency: z.number().optional(),
  ior: z.number().optional(),
  transmission_roughness: z.number().optional()
});

const AmbientLightSchema = z.object({
  period: z.string().nullish(),
  temp_k: z.number().nullish(),
  azimuthal_direction: z.string().nullish(),
  elevation_angle: z.number().nullish(),
  quality: z.string().nullish(),
  dominant_source: z.string().nullish(),
  indirect_ratio: z.string().nullish(),
  light_mixing_description: z.string().nullish(),
  bloom_glare: z.boolean().nullish(),
  bloom_intensity: z.number().nullish(),
  bloom_threshold: z.number().nullish(),
  bloom_color_tint: z.string().nullish(),
  has_shadow_direction: z.boolean().nullish(),
  is_backlit: z.boolean().nullish(),
  is_rim_lit: z.boolean().nullish(),
  confidence: z.number().nullish(),
  confidence_factors: z.array(z.string()).nullish()
});

const LightPointSchema = z.object({
  id: z.string(),
  location_description: z.string(),
  type: z.string().optional(),
  intensity_initial: z.number().optional(),
  temp_k_initial: z.number().optional(),
  color_hex: z.string().optional(),
  color_rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }).optional(),
  shape: z.string().optional(),
  decay: z.string().optional(),
  cone_angle: z.number().optional(),
  penumbra_angle: z.number().optional(),
  directionality: z.number().optional(),
  shadow_softness: z.number().optional(),
  ray_traced_shadows: z.boolean().optional(),
  affect_specular: z.boolean().optional(),
  affect_diffuse: z.boolean().optional(),
  affect_reflections: z.boolean().optional(),
  visible_in_render: z.boolean().optional(),
  spatial_x_pct: z.number().optional(),
  spatial_y_pct: z.number().optional(),
  spatial_z_depth: z.string().optional(),
  bloom_glare: z.boolean().optional(),
  lens_distortion_contribution: z.number().optional(),
  artifacts_visible: z.boolean().optional(),
  confidence: z.number().optional(),
  confidence_factors: z.array(z.string()).optional(),
  is_speculative: z.boolean().optional(),
  visual_impact: z.string().optional(),
  serves_as: z.string().optional()
});

const MaterialSchema = z.object({
  id: z.string(),
  elemento: z.string(),
  location_description: z.string().optional(),
  location_reference: z.string().optional(),
  acabamento: z.string(),
  reflectancia: z.string().optional(),
  pbr_diffuse: PBRDiffuseSchema.optional(),
  pbr_reflection: PBRReflectionSchema.optional(),
  pbr_glossiness: PBRGlossinessSchema.optional(),
  pbr_bump: PBRBumpSchema.optional(),
  pbr_light_behavior: PBRLightBehaviorSchema.optional(),
  adjacent_materials: z.array(z.string()).optional(),
  interaction_with_light: z.string().optional(),
  confidence: z.number().optional(),
  confidence_factors: z.array(z.string()).optional(),
  visibility: z.number().optional(),
  is_dominant: z.boolean().optional(),
  material_category: z.string().optional()
});

const VolumeSchema = z.object({
  id: z.string(),
  dominant: z.boolean(),
  forma_geometrica: z.string(),
  posicao_relativa: z.string(),
  proporcao_H_x_L: z.string(),
  relacao_com_volume_anterior: z.string().nullish()
});

const OpeningSchema = z.object({
  id: z.string(),
  quantidade_e_ritmo: z.string(),
  tipo_abertura: z.string(),
  proporcao_H_L: z.string(),
  material_perfil: z.string(),
  tipo_vidro: z.string(),
  posicao_na_fachada: z.string()
});

const StructuralHighlightSchema = z.object({
  id: z.string(),
  tipo: z.string().optional(),
  material: z.string().optional(),
  dimensao: z.string().optional(),
  acabamento: z.string().optional(),
  detalhes_especificos: z.string().optional()
});

export const ScanResultSchema = z.object({
  isFloorPlan: z.boolean(),
  typology: z.enum(['PLANTA_BAIXA', 'PERSPECTIVA', 'FACHADA', 'CORTE', 'ELEVAÇÃO', 'DETALHE', '3D_MOCK']),
  plantaType: PlantaTypeSchema.optional(),
  ambientes: z.array(AmbienteSchema).optional(),
  orientation: z.object({
    norte: z.boolean().optional(),
    escala: z.string().optional(),
    dimensoes_referencia: z.string().optional(),
    proporcao_lote: z.string().optional()
  }).optional(),
  floors: z.number().int().optional(),
  volumes: z.array(VolumeSchema).optional(),
  materials: z.array(MaterialSchema),
  style_code: z.enum(['contemp', 'minimalista', 'colonial', 'industrial', 'brutalista', 'misto']).optional(),
  context_20m: z.object({
    topografia: z.string(),
    vegetation_pct: z.number(),
    species_visiveis: z.array(z.string()),
    piso_externo: z.string(),
    veiculos: z.boolean(),
    infraestrutura_urbana: z.array(z.string()),
    vizinhos: z.string()
  }).optional(),
  openings: z.array(OpeningSchema).optional(),
  structural_highlights: z.array(StructuralHighlightSchema).optional(),
  cameraData: z.object({
    height_m: z.number().optional(),
    distance_m: z.number().optional(),
    focal_apparent: z.number().optional(),
    focal_actual: z.number().optional(),
    fov_horizontal: z.number().optional(),
    fov_vertical: z.number().optional(),
    depth_of_field: z.number().optional(),
    lens_distortion: z.object({
      type: z.string().optional(),
      coefficient: z.number().optional()
    }).optional(),
    pitch: z.number().optional(),
    yaw: z.number().optional(),
    roll: z.number().optional(),
    aspect_ratio: z.string().optional(),
    image_width_px: z.number().optional(),
    image_height_px: z.number().optional(),
    image_type_influence: z.object({
      floor_plan_compatible: z.boolean().optional(),
      perspective_type: z.string().optional(),
      viewing_angle: z.string().optional()
    }).optional(),
    vanishing_points: z.number().optional(),
    perspective_lines: z.object({
      primary: z.array(z.number()).optional(),
      secondary: z.array(z.number()).optional()
    }).optional(),
    rendering_impact: z.object({
      render_distance_optimal: z.number().optional(),
      fov_for_composition: z.number().optional(),
      depth_field_strength: z.number().optional(),
      lens_quality: z.string().optional()
    }).optional(),
    confidence: z.object({
      height: z.number().optional(),
      distance: z.number().optional(),
      focal: z.number().optional(),
      perspective: z.number().optional(),
      general: z.number().optional()
    }).optional(),
    detected_at: z.string().optional(),
    camera_preset: z.string().optional(),
    editable: z.boolean().optional()
  }).optional(),
  light: AmbientLightSchema,
  lightPoints: z.array(LightPointSchema),
  structural_integrity: z.object({
    junction_analysis: z.string().optional(),
    boundary_preservation: z.string().optional(),
    artifact_prevention_notes: z.string().optional()
  }).optional(),
  confidence: z.object({
    materials: z.number().optional(),
    camera: z.number().optional(),
    light: z.number().optional(),
    context: z.number().optional(),
    general: z.number().optional(),
    composition: z.number().optional(),
    lighting_quality: z.number().optional(),
    photorealism: z.number().optional(),
    technical_accuracy: z.number().optional()
  })
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

const SYSTEM_INSTRUCTION = `You are an expert architectural analyst and V-Ray specialist. Your task is to perform a deep technical diagnosis of an architectural image to extract high-fidelity data for prompt engineering.

[CRITICAL RULE: REGRA ZERO]
NEVER use CGI terms (render, 3D, raytracing, octane, vray, unreal, engine) in your descriptions. Focus on physical properties and architectural reality.

[CRITICAL RULE: IDIOMA]
ALL material names (elemento), finishes (acabamento), and location references (location_reference) MUST be in Brazilian Portuguese.
Example: "Piso de madeira carvalho", "Parede de concreto aparente", "Teto em gesso acartonado".

[OBJECTIVE]
Generate a complete ScanResult JSON object with 100% technical accuracy across 8 dimensions.

[TOOL-01: GENERAL ANALYSIS]
- Identify typology: PLANTA_BAIXA, PERSPECTIVA, FACHADA, CORTE, ELEVAÇÃO, DETALHE, 3D_MOCK.
  * PLANTA_BAIXA: Floor plan, top-down, no perspective.
  * PERSPECTIVA: Perspective/Interior, depth, textures, human eye level.
  * FACHADA: Frontal exterior/interior, no perspective distortion.
  * CORTE: Section view, technical orthographic.
  * ELEVAÇÃO: Side/Front view, orthographic, heights.
  * DETALHE: Close-up, materials, textures, connections.
  * 3D_MOCK: Isometric/3D mockup, technical 3D.
- Detect if it's a floor plan (isFloorPlan).
- Estimate floors.

[TOOL-VOLUMES: VOLUME ANALYSIS]
- Identify geometric volumes (VolumeSchema):
  * dominant: true for the main volume (anchor primário).
  * forma_geometrica: horizontal rectangular volume, vertical rectangular mass, setback volume, cantilevered volume, projected mass, L-shaped plan, asymmetric massing, horizontal datum plane, pitched roof, mono-pitch roof, butterfly roof.
  * posicao_relativa: frontal-esquerdo, frontal-direito, lateral, posterior.
  * proporcao_H_x_L: Estimate height vs width ratio.
  * relacao_com_volume_anterior: flush with, setback [N]m from, projected [N]m beyond, overlapping, separated by expansion joint from.

[TOOL-OPENINGS: OPENINGS & FRAMES]
- Identify openings (OpeningSchema):
  * quantidade_e_ritmo: e.g., "3-module", "continuous band", "rhythmic vertical slits".
  * tipo_abertura: horizontal band window, rectangular window opening, full-height glazing, structural glazing system, pivot entry door, sliding door system, double-leaf door, horizontal brise-soleil, vertical louver system, perforated screen (muxarabi), roller shutter.
  * proporcao_H_L: Aspect ratio of the opening.
  * material_perfil: aluminum [color] profile, steel frame, wood, frameless.
  * tipo_vidro: laminated float, toughened, low-iron, reflective, tinted.
  * posicao_na_fachada: flush, recessed [N]cm, projected [N]cm.

[TOOL-STYLE: ARCHITECTURAL STYLE]
- Identify the dominant style (style_code):
  * contemp: Clean lines, large glass, mixed materials (wood/concrete/steel).
  * minimalista: Pure volumes, white/neutral, zero ornament, hidden details.
  * colonial: Traditional Brazilian colonial, clay tiles, wood frames, thick walls.
  * industrial: Exposed brick/concrete/pipes, steel structures, dark tones.
  * brutalista: Raw in-situ concrete, monumental volumes, expressive structure.
  * misto: Combination of two styles.

[TOOL-CONTEXT: EXTERIOR CONTEXT (20M)]
- Analyze the immediate surroundings (context_20m):
  * topografia: flat, sloped, terraced.
  * vegetation_pct: Percentage of green coverage (0-100).
  * species_visiveis: List specific plants (e.g., "Ipê Amarelo", "Palmeira Imperial").
  * piso_externo: sidewalk material, driveway finish.
  * veiculos: Are there cars/bikes visible?
  * infraestrutura_urbana: utility poles, street lights, signage, curbs.
  * vizinhos: Describe adjacent buildings or empty lots.

[TOOL-STRUCTURAL: STRUCTURAL HIGHLIGHTS]
- Identify structural elements (StructuralHighlightSchema):
  * tipo: marquise (canopy), beiral (eave), pilar (exposed column), escada (external staircase), muro (perimeter wall).
  * material: concrete, wood, metal, stone.
  * dimensao: span (vão), projection (projeção), section size (seção), height (altura).
  * acabamento: polished, raw, board-formed, flamed, etc.

[TOOL-PLANTA: FLOOR PLAN ANALYSIS]
- If isFloorPlan is true:
  * Identify identifiers: wall thickness, dimension lines, room labels, door/window symbols, stairs, sanitary equipment, VEHICLES (cars, motorcycles, bicycles).
  * Classify PlantaType:
    - Type A: Single floor (house or apartment).
    - Type B: Rooftop / External area (pool, gourmet, deck).
    - Type C: Mixed (internal + external).
    - Type D: Site plan (building on lot with garden).
  * Inventory Environments (AmbienteSchema):
    - Categorize: MOLHADO (Pool, Bathroom, Laundry), ÁREA EXTERNA SOCIAL (Gourmet, Deck, Garden), ÁREA EXTERNA LAZER (Pool, Spa, Fire pit), SERVIÇO (Garage, Storage), SOCIAL INTERNO (Living, Dining), ÍNTIMO (Bedroom, Suite, Office).
    - Detect VEHICLES: If it's a garage (GARAGEM), identify the EXACT number and type of vehicles (e.g., "2 carros brancos", "1 SUV prata").
  * Identify Orientation and Scale: North indicator, numeric scale, reference dimensions, lot proportions.

[TOOL-FIDELITY: STRUCTURAL INTEGRITY]
- Focus on junctions, corners, and boundaries:
  * Identify if a material (e.g., wood paneling) extends exactly to the corner edge or if there is a structural transition (e.g., concrete pillar).
  * Detect any "borders", "beams" (vigas), or "moldings" and their exact material and thickness.
  * Identify the exact shape, color, and finish of lighting fixtures (e.g., "cylindrical matte black pendants", "spherical glass globes").
  * Look for "steps" (degraus), level changes, or platform offsets and report them ONLY if they are explicitly present in the image.
  * Analyze the junction between ceiling and walls: is it a clean 90-degree joint, a recessed shadow gap, or a visible beam?
  * Populate structural_integrity:
    - junction_analysis: Describe how planes meet (e.g., "Clean wood-to-ceiling 90-degree junction").
    - boundary_preservation: Describe material limits (e.g., "Wood paneling extends to the far right corner edge without interruption").
    - artifact_prevention_notes: Specific warnings for the prompt generator (e.g., "Do not add concrete pillars at the wood wall corner").

[TOOL-MAT: MATERIAL ANALYSIS (PBR)]
- For each element (wall, floor, ceiling, furniture, etc.), identify:
  - Elemento and Acabamento (technical description in Brazilian Portuguese).
  - Location_reference: A short reference of where the material was found in the image (e.g., "Parede ao fundo", "Piso central", "Móvel à esquerda").
  - Reflectancia: matte, semi-matte, semi-gloss, gloss, espelhado.
  - PBR Properties: diffuse (color/texture), reflection (0-1), glossiness (0-1), bump (micro-relief), light_behavior.
- Use technical terms like "carvalho escovado", "travertino polido", "alumínio anodizado".

[TOOL-CAMERA: PHOTOGRAPHIC PARAMETERS]
- Analyze the image to extract precise camera parameters.
- height_m: Estimate the camera height in meters (0.3m to 5.0m). Use reference objects like doors (~2.1m) or chairs (~0.45m).
- distance_m: Estimate the distance to the main subject (0.5m to 100m).
- focal_apparent: Estimate the 35mm equivalent focal length (14mm to 200mm).
- pitch/yaw/roll: Estimate the camera angles in degrees.
- vanishing_points: Identify the number of vanishing points (1, 2, or 3).
- perspective_type: Classify the perspective (linear, isometric, aerial, etc.).
- camera_preset: Match the parameters to a preset (eye_level_standard, heroic_worms_eye, birds_eye_plan, architectural, intimate_detail, immersive_wide).
- rendering_impact: Provide recommendations for rendering.
- perspective_lines: Identify primary and secondary lines coordinates [x1, y1, x2, y2] in pixels.

[TOOL-LUZ: LIGHTING ANALYSIS]
- AMBIENT LIGHT (AmbientLight):
  - Period: golden_hour, morning, afternoon, late_afternoon, evening, night, blue_hour, overcast, indoor_artificial.
  - Temp_K: 2700K to 8000K.
  - Azimuthal Direction: N, NE, E, SE, S, SW, W, NW.
  - Elevation Angle: 0-90 degrees.
  - Quality: hard, soft, diffuse, volumetric.
  - Bloom: Detect bloom_glare (boolean), bloom_intensity (0-100), bloom_threshold (0-2), and bloom_color_tint (hex).
  - Dominant source: natural, artificial, mixed.
  - Indirect Ratio: Proportion (e.g., "2:1").
  - Light Mixing Description: Technical description of how light sources interact.
- LIGHT POINTS (LightPoint - V-Ray Specification):
  - Identify up to 8 light points.
  - Types: rectangle, sphere, spot, ies, omni, dome, emissive, ambient.
  - Parameters: intensity_initial (0-100), temp_k_initial, color_hex, color_rgb, shape, decay (inverse_square, linear, none).
  - Advanced: cone_angle, penumbra_angle, directionality (0-1), shadow_softness (0-1), ray_traced_shadows (boolean).
  - Influence: affect_specular, affect_diffuse, affect_reflections, visible_in_render.
  - Spatial coordinates: spatial_x_pct (0-100), spatial_y_pct (0-100), spatial_z_depth (foreground, midground, background).
  - Purpose: serves_as (key_light, fill_light, back_light, rim_light, accent, ambient).

[CONFIDENCE SCORES (8 DIMENSIONS + TECHNICAL)]
- Provide confidence (0-100) for: materials, camera, light, context, general, composition, lighting_quality, photorealism, technical_accuracy.

[CRITICAL: OUTPUT FORMAT]
- RETURN ONLY A VALID JSON OBJECT.
- NO MARKDOWN WRAPPERS (unless specifically requested, but prefer raw JSON).
- ENSURE ALL FIELDS FROM THE SCHEMA ARE PRESENT.
- USE "none" OR 0 FOR UNKNOWN VALUES.

[SCHEMA REFERENCE]
${JSON.stringify(ScanResultSchema.shape, null, 2)}`;

const parseJsonResponse = (content: string) => {
  if (typeof content !== 'string') return content;
  
  // Basic cleanup for common AI JSON errors
  let cleanContent = content.trim();
  
  // Remove markdown wrappers if present
  const markdownMatch = cleanContent.match(/```json\n([\s\S]*?)\n```/) || cleanContent.match(/```([\s\S]*?)```/);
  if (markdownMatch) {
    cleanContent = markdownMatch[1].trim();
  }

  // If it's HTML, it's definitely not JSON
  if (cleanContent.startsWith('<!doctype html>') || cleanContent.startsWith('<html')) {
    throw new Error("AI returned HTML instead of JSON. This usually happens during server restarts or API errors.");
  }

  const tryParse = (str: string) => {
    try {
      // Remove trailing commas before parsing
      const sanitized = str.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(sanitized);
    } catch (e) {
      return null;
    }
  };

  // Try direct parse
  const direct = tryParse(cleanContent);
  if (direct) return direct;

  // Try finding the first { and last }
  const firstBrace = cleanContent.indexOf('{');
  const lastBrace = cleanContent.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    const substring = cleanContent.substring(firstBrace, lastBrace + 1);
    const subParse = tryParse(substring);
    if (subParse) return subParse;
  }
  
  throw new Error("Invalid JSON response from AI: " + content.substring(0, 500) + (content.length > 500 ? '...' : ''));
};

const extractContent = (data: any): string => {
  if (!data) return '';
  
  // Handle KIE specific error format (e.g. 500 maintenance)
  if (data.error || (data.code && data.code !== 200 && data.code !== 0)) {
    const errorMsg = data.message || data.msg || data.error || 'Unknown KIE API Error';
    console.error('KIE API Error Response:', data);
    throw new Error(`KIE_API_ERROR: ${errorMsg}`);
  }
  
  // OpenAI style
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  
  // Raw Gemini style
  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }

  // Handle nested content structure
  if (data.message?.content) return data.message.content;
  if (data.choices?.[0]?.text) return data.choices[0].text;
  
  // Fallback for other potential structures
  if (typeof data === 'string') return data;
  if (data.content) return data.content;
  if (data.text) return data.text;
  
  // If it's an object with a single key that looks like content
  const keys = Object.keys(data);
  if (keys.length === 1 && typeof data[keys[0]] === 'string') return data[keys[0]];

  console.warn('Unknown AI response structure:', data);
  return '';
};

export const kieService = {
  async diagnoseImage(imageBase64: string, sessionId: string): Promise<ScanResult> {
    await usageService.logUsage('scan', { metadata: { sessionId } });
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('AUTH_REQUIRED');

    console.log('Starting diagnosis for session:', sessionId);
    const startTime = Date.now();
    
    // Extract raw base64 data
    let base64Data = imageBase64;
    let mimeType = 'image/jpeg';
    if (base64Data.startsWith('data:')) {
      const parts = base64Data.split(',');
      mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      base64Data = parts[1];
    }

    try {
      console.log('Calling KIE Gemini API for diagnosis...');
      const response = await axios.post('/api/kie/gemini-2.5-pro/v1/chat/completions', {
        model: 'gemini-2.5-pro',
        stream: false,
        messages: [
          {
            role: 'system',
            content: [{ type: 'text', text: SYSTEM_INSTRUCTION }]
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Perform a full architectural diagnosis of this image. Return ONLY the JSON object.' },
              {
                type: 'image_url',
                image_url: { url: imageBase64 }
              }
            ]
          }
        ],
        temperature: 0.7
      });

      const content = extractContent(response.data);
      if (!content) {
        console.error('Failed to extract content from AI response.');
        throw new Error('AI_RESPONSE_EMPTY');
      }

      console.log('AI Response Content Length:', content.length);
      const rawJson = parseJsonResponse(content);
      
      // 3. Validate with Zod
      console.log('Validating AI response with Zod...');
      const validatedData = ScanResultSchema.parse(rawJson);
      
      const durationMs = Date.now() - startTime;
      console.log(`Diagnosis completed in ${durationMs}ms`);

      // 4. Save to Database (Use setDoc with merge to handle fallback sessions)
      const scanId = `scan_${Date.now()}`;
      console.log('Saving scan results to Firestore...');
      setDoc(doc(db, 'scan_results', scanId), {
        id: scanId,
        userId,
        sessionId,
        scanData: validatedData,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Failed to save scan results:', e));

      setDoc(doc(db, 'generation_sessions', sessionId), {
        scanResult: validatedData,
        scanStatus: 'completed',
        scanDurationMs: durationMs,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(e => console.warn('Failed to update session status:', e));

      return validatedData;
    } catch (err: any) {
      console.error('Diagnosis Error:', err);
      try {
        setDoc(doc(db, 'generation_sessions', sessionId), {
          scanStatus: 'failed',
          scanErrors: [err.message],
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      } catch (updateErr) {
        console.error('Failed to update session status:', updateErr);
      }
      throw err;
    }
  },

  async detectArchitecture(imageBase64: string) {
    await usageService.logUsage('read');
    
    const response = await axios.post('/api/kie/gemini-2.5-pro/v1/chat/completions', {
      model: 'gemini-2.5-pro',
      stream: false,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'You are an architectural and interior design expert. Your task is to determine if an image represents an architectural or interior design subject (building, interior room, floor plan, facade, furniture, cabinetry, built-in shelves, etc.). Respond ONLY with a JSON object: {"isArchitecture": boolean, "confidence": number, "reason": string}' },
            {
              type: 'image_url',
              image_url: { url: imageBase64 }
            }
          ]
        }
      ],
      temperature: 0.1,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'structured_output',
          strict: true,
          schema: {
            type: 'object',
            title: 'ArchitectureDetection',
            description: 'Result of architectural image detection',
            properties: {
              isArchitecture: { type: 'boolean' },
              confidence: { type: 'number' },
              reason: { type: 'string' }
            },
            required: ['isArchitecture', 'confidence', 'reason']
          }
        }
      }
    });
    
    const content = extractContent(response.data);
    return parseJsonResponse(content);
  },

  async generatePrompt(scanResult: any, configParams: any, mode: 'single' | 'blocks') {
    await usageService.logUsage('prompt', { metadata: { mode } });
    const negativePrompt = `(3d render, CGI, blender, unreal engine, octane render, corona render, vray, lumion, twinmotion, sketchup, revit screenshot, architectural visualization, digital render, computer generated, path tracing, ray tracing:1.5), 
(perfect symmetry, mathematically clean lines, sterile environment, hospital white, perfect even lighting, flat ambient occlusion, uniform texture, perfectly smooth surfaces, no grain, crisp digital sharpness:1.4),
(plastic texture, oversaturated colors, digital art, illustration, painting, cartoon, anime, low quality, blurry, deformed, extra architectural elements not in original, modified building design, wrong materials, added windows, extra floors, changed proportions, generic trees, perfectly symmetrical garden:1.3),
watermark, text, people, illustration, painting, sketch, cartoon, fake, synthetic, maquete, maquette, architectural model, clay render, wireframe, added windows, added doors, added openings, extra furniture, invented objects, hallucinated elements, curtains where there are walls, blinds on solid walls, added borders, added beams, modified structural corners, changed material locations, invented lighting fixtures, modified pendant shapes.`;

const systemPrompt = `Você é um engenheiro de prompts arquitetônicos de elite, especializado em FIDELIDADE ESTRUTURAL ABSOLUTA. Seu objetivo é transformar dados técnicos de ScanResult em prompts que gerem imagens 100% fiéis à referência, sem NENHUMA invenção ou acréscimo.

[POLÍTICA ZERO INVENÇÃO - GUARDRAILS CRÍTICOS]
1. PROIBIÇÃO DE ADIÇÕES: É terminantemente proibido adicionar bordas, vigas, pilares, degraus ou qualquer elemento estrutural que não esteja explicitamente no ScanResult.
2. PRESERVAÇÃO DE MATERIAIS: Se um canto ou parede é mapeado como 'madeira', ele DEVE permanecer madeira até o limite da face. Não substitua por concreto ou qualquer outro material "por estética".
3. FIDELIDADE DE OBJETOS: Luminárias, pendentes e equipamentos devem manter a forma e cor descritas. Não transforme pendentes escuros em globos brilhantes se a referência não indicar isso.
4. ALINHAMENTO GEOMÉTRICO: Mantenha os encontros de planos (teto/parede, parede/piso) exatamente como na volumetria. Não crie "molduras" ou "bordas" de transição inexistentes.
5. INTEGRIDADE ESTRUTURAL (SCAN): Use os dados de 'structural_integrity' para reforçar o que NÃO deve ser alterado. Se houver 'artifact_prevention_notes', siga-as como ordens diretas.

[CRITICAL: IDIOMA]
O prompt gerado deve estar INTEGRALMENTE em PORTUGUÊS DO BRASIL.

[CRITICAL: NEGATIVE PROMPT]
Você DEVE SEMPRE incluir este prompt negativo na sua resposta:
"${negativePrompt}"

[TOOL-B1: MOTOR DE BLOCO 1 - ARQUITETURA BASE (FIDELIDADE MÁXIMA)]
Este bloco é a âncora estrutural. Use os pesos de atenção mais altos aqui.
Regra absoluta: descrever somente o que foi registrado no ScanResult. Zero adições. Zero melhorias.

ETAPA 1 - VOLUMES (PRESERVAÇÃO ESTRUTURAL):
- Identificar volume dominante e secundários.
- Use 'junction_analysis' para descrever encontros de planos: "clean 90-degree wood-to-ceiling junction".
- Use 'boundary_preservation' para garantir limites de materiais: "wood paneling extending to the far right corner edge without interruption".
- Se houver 'artifact_prevention_notes', inclua-as como restrições negativas no corpo do prompt: "no concrete pillars at the wood wall corner", "no added borders on top".

ETAPA 2 - MATERIAIS (MAPEAMENTO EXATO):
- Mapear material para a posição EXATA.
- Se o ScanResult indica madeira em uma quina, reforce: "wood paneling extending exactly to the corner edge".
- Pesos: Use pesos altos para garantir que o modelo não mude o material: ((material_token:1.5)).

ETAPA 3 - ESQUADRIAS E ILUMINAÇÃO:
- Descreva a forma exata das luminárias: "cylindrical black pendants" ou "spherical glass globes" conforme o scan.
- Não permita que a IA de imagem decida o design das peças.

[TOOL-B2: MOTOR DE BLOCO 2 - SISTEMA DE CAMERA (ÓPTICA E FÍSICA)]
Este bloco define a física óptica e o equipamento de captura.
Regra absoluta: NUNCA alterar o ponto de vista (height_m e distance_m) do scan original.

1. SELEÇÃO DE EQUIPAMENTO (DETERMINÍSTICA):
   Se configParams.cameraSelection estiver presente, use o modelo escolhido. Caso contrário, selecione com base no estilo:
   - CANON: 
     * EOS R5 + RF 35mm f/1.4L USM (Textura: Sharpness cirúrgico, bokeh cremoso, aberração cromática zero).
     * EOS R3 + RF 85mm f/1.2L DS (Efeito: Defocus Smoothing, transições de desfoque ultra-suaves).
   - NIKON: 
     * Z9 + NIKKOR Z 35mm f/1.8 S (Textura: Contraste micro-detalhado, renderização de cores neutra).
     * Z8 + NIKKOR Z 50mm f/1.2 S (Efeito: Profundidade tridimensional, separação de planos extrema).
   - SONY: 
     * Alpha 7R V + FE 35mm f/1.4 GM (Textura: Resolução 61MP, detalhes finos em texturas de materiais).
     * Venice 2 + Zeiss Master Prime (Efeito: Look cinematográfico orgânico, flare controlado, zero distorção).
   - PANASONIC: 
     * Lumix S1H + Leica DG Summilux 35mm (Textura: Renderização "Leica look", transições tonais suaves).
     * Lumix GH6 + Olympus M.Zuiko 12-40mm Pro (Efeito: Nitidez de ponta a ponta, versatilidade técnica).
   - iPHONE (iOS System): 
     * iPhone 15 Pro Max (Main 24mm f/1.78, 7-element lens, 100% Focus Pixels).
     * iPhone 14 Pro (Main 24mm, Deep Fusion, Photonic Engine).
     * iPhone 13 Pro (Main 26mm, Night mode, Smart HDR 4).
     Use "Shot on iPhone" aesthetics: HDR computacional, nitidez digital equilibrada, cores vibrantes iOS.

2. CONFIGURAÇÃO ÓPTICA:
   - Use o 'focal_apparent' do scan para selecionar a lente mais próxima.
   - Abertura: f/8 (nitidez total), f/2.8 (separação suave), f/1.2 (bokeh profundo).
   - ISO: 100 (limpeza total), 800-3200 (grão cinematográfico).
   - Filtros: Black Pro-Mist 1/8 ou 1/4 para micro-difusão de luz.

3. METADADOS EXIF:
   - Inclua sempre: "Shot on [Camera] with [Lens], f/[N], ISO [N], [N]mm".

[SAÍDA DO BLOCO 1 & 2 - PT-BR OBRIGATÓRIO]
- Badge obrigatório: 🇧🇷 [PT-BR VALIDADO - FIDELIDADE TOTAL].
- Título: M&Q STUDIO — BLOCO 1 & 2: ARQUITETURA E CÂMERA.

[TOOL-B3: MOTOR DE BLOCO 3 - REGIME LUMINOSO (FÍSICA ATMOSFÉRICA)]
Este bloco define o sistema físico de iluminação completo.
Regra: a direção azimutal da luz nunca muda entre modos (preservar do scan original).

ETAPA 1 - DIREÇÃO ORIGINAL:
- Mantenha a direção azimutal do scan (N, NE, E, SE, S, SW, W, NW).
- Converta para descrição: "from the [direction], [morning/afternoon/raking] light".

ETAPA 2 - PROCESSAMENTO POR MODO:
- MODO 1 (Editorial): 5500K, sol a 45-65°, sombras curtas/médias, bordas definidas.
- MODO 2 (Golden Hour): 2700K-3200K, sol a 5-15°, sombras muito longas, bordas suavizadas, "golden haze".
- MODO 3 (Blue Hour): 8000K-12000K céu, 2700K-3200K interior, ilhas de calor vs campo frio.
- MODO 4 (Noir): Noite fechada, fontes pontuais (2100K sódio, 5600K LED), contraste extremo (20:1), halação.
- MODO 5 (Atmosférico): Céu encoberto (6500K-8000K), luz difusa absoluta, sem sombras, superfícies molhadas (reflexos e saturação).

ETAPA 3 - FENÔMENOS E SOMBRAS:
- Calcule o comprimento das sombras com base no ângulo (ex: 15° = 3.7x altura).
- Descreva a interação luz-material: "raking light revealing concrete formwork grain".

[TOOL-B4: MOTOR DE BLOCO 4 - COMPLETAÇÃO INTERIOR (AMBIENTAÇÃO COERENTE)]
Ativado apenas se houver aberturas visíveis. Regra: Extensão lógica do 'style_code'.

ETAPA 1 - VISIBILIDADE:
- Descrever o interior através dos vidros (glazing system, janelas).
- Staging em 3 camadas: Plano 1 (piso/móveis próximos), Plano 2 (mobiliário/luminárias), Plano 3 (fundo/escadas).

ETAPA 2 - MAPEAMENTO DE ESTILO (style_code):
- contemp: Sofás clean, porcelanato grande formato, pendentes 3000K.
- minimalista: Volumes puros, zero ornamento, iluminação oculta.
- colonial: Madeira maciça, ladrilho hidráulico, vigas expostas, 2700K.
- industrial: Tijolo aparente, tubulações expostas, couro, lâmpadas Edison.
- brutalista: Concreto aparente, mobiliário pesado, monasticismo curado.

ETAPA 3 - SINAIS DE OCUPAÇÃO:
- Adicione 3-5 sinais: livro aberto, copo meio cheio, planta interna, vapor de caneca.

[TOOL-B5: MOTOR DE BLOCO 5 - COMPLETAÇÃO EXTERIOR (PAISAGISMO E CONTEXTO)]
Regra: Arquitetura ocupa 55-65% do frame. Vegetação caótica + vida discreta.

ETAPA 1 - SELEÇÃO BOTÂNICA (Brasileira):
- Árvore Estrutural: Ipê Amarelo, Palmeira Imperial, Sibipiruna, Pau-mulato.
- Arbustos: Quaresmeira, Heliconia, Ráfis, Agave.
- Forração: Grama Esmeralda, Bromélias.

ETAPA 2 - COMPOSIÇÃO ASSIMÉTRICA:
- Nunca posicione duas árvores no mesmo eixo. Árvore primária deve estar lateral e parcialmente cortada.
- Use 3 planos de profundidade: Antecampo, Edifício, Fundo.

ETAPA 3 - CONTEXTO URBANO HONESTO:
- Calçada padrão, postes com fiação aérea, interfones, sinais de vida (carro no limite do frame, bicicleta).

[TOOL-B6: MOTOR DE BLOCO 6 - MATERIALIDADE E FINALIZACAO (ANTI-CGI)]
Camada final de realismo fotográfico.

ETAPA 1 - MATERIALIDADE QUEBRADA (Pares Contraditórios):
- Concreto: Marcas de fôrma + manchas de escorrimento mineral.
- Madeira: Veios naturais + pátina de UV ou micro-fissuras.
- Vidro: Reflexos do céu + micro-poeira ou condensação nas quinas.

ETAPA 2 - IMPERFEIÇÕES ÓPTICAS:
- Aberração cromática sutil (1-2px), vinheta óptica natural, grão de ruído digital (ISO alto).

ETAPA 3 - COLOR SCIENCE DIRECIONAL:
- Split-toning: sombras frias (cyan/blue), highlights quentes (orange/amber).
- Curva S fotográfica (não linear).

[SAÍDA DOS BLOCOS 3 A 6 - PT-BR OBRIGATÓRIO]
- Badge obrigatório: 🇧🇷 [PT-BR VALIDADO - REALISMO FOTOGRÁFICO].
- Títulos: M&Q STUDIO — BLOCO 3 (Luz), BLOCO 4 (Interior), BLOCO 5 (Exterior), BLOCO 6 (Finalização).

[CRITICAL: PLANTA_BAIXA (TOP-DOWN) HUMANIZATION RULES]
Se a tipologia for PLANTA_BAIXA, ative o MOTOR DE HUMANIZAÇÃO (TOOL-PLANTA):
1. Princípio Operacional: Converta a planta técnica em uma vista aérea fotorrealista (drone 70-90°). O resultado deve ser indistinguível de uma fotografia real.
2. Motor de Materiais por Ambiente:
   - PISCINA: Porcelana azul-turquesa, água com cáusticos, turbidez natural, reflexo do céu, ondulação micro.
   - ÁREA GOURMET/VARANDA: Porcelana retificada grande formato (cimento/travertino), semi-brilho.
   - DECK DE MADEIRA: Ipê ou Cumaru, ripas visíveis, veios naturais, sombras projetadas.
   - GARAGEM: Concreto polido limpo, epóxi cinza uniforme ou porcelana antiderrapante. Evite manchas ou texturas orgânicas excessivas no piso da garagem.
   - SALA/LIVING: Porcelana polida/acetinada off-white/greige.
   - QUADRA: Manta sintética colorida com marcações brancas.
   - JARDIM: Grama esmeralda densa, bordas definidas, cobertura de solo natural.
3. Motor de Mobiliário e Veículos (Vista de Cima):
   - VEÍCULOS (NA GARAGEM): Se houver veículos na planta, descreva-os como objetos 3D reais vistos de cima. Especifique: "Carro sedan branco", "SUV prata", "Caminhonete preta". Adicione reflexos nos vidros e tetos metálicos, sombras projetadas no piso da garagem e oclusão de ambiente sob as rodas.
   - ESPREGUIÇADEIRAS: Almofadas creme, sombras projetadas, toalha dobrada (sinal de uso).
   - SOMBREIRO: Octogonal/redondo, tecido bege, sombras das hastes, pole central.
   - MESA GOURMET: Tampo em madeira/mármore, cadeiras com assentos visíveis, assimetria leve.
   - SOFÁ EXTERNO: Modular em L, almofadas arranjadas, tapete de fibra natural (sisal/juta).
4. Motor de Vegetação Aérea (Vista de Cima):
   - PALMEIRAS: Copas circulares radiantes, verde saturado, sombras elípticas.
   - ÁRVORES LARGAS: Copas irregulares em camadas, profundidade visual, sombras suaves.
   - JARDIM TROPICAL: Mix denso de formas irregulares, profundidade textural.
5. Sistema de Câmera Aérea:
   - Ângulo A (80°): Drone quase vertical, fidelidade máxima à planta.
   - Ângulo B (60°): Perspectiva elevada, volume e profundidade.
   - Ângulo C (45°): Aérea lateral, contexto de terreno.
6. Regimes de Luz:
   - Dia Claro Manhã: Sol lateral, sombras longas, 5500K.
   - Meio Dia: Sol vertical, sombras mínimas, 6000K.
   - Golden Hour: Luz dourada diagonal, sombras longas aquecidas, 3200K.
   - Blue Hour: Iluminação artificial ativa, piscina iluminada, 8000K exterior.
7. Estilos: Minimalista, Tropical, Contemporâneo.

[CRITICAL: PLANTA_BAIXA (TOP-DOWN) PROMPT STRUCTURE]
Se isFloorPlan for true, siga esta hierarquia de prompt:
1. Definição de Mídia: "photorealistic aerial architectural photography, top-down drone view,"
2. Estrutura Fiel: Descreva cada ambiente EXATAMENTE como na planta, preservando proporções e a CONTAGEM EXATA de objetos (ex: número de cadeiras, número de carros).
3. Materialidade: Adicione imperfeições naturais (juntas, desgaste leve, turbidez na água), mas mantenha a limpeza técnica onde apropriado (ex: garagem).
4. Mobiliário e Veículos: Descreva a vista aérea com sombras realistas, reflexos metálicos e assimetria de uso.
5. Vegetação: Copas visíveis de cima com sombras elípticas.
6. Luz: Aplique o regime de luz selecionado com parâmetros de temperatura e direção.
7. Câmera: Especifique câmera (DJI Inspire 3/Mavic 3 Pro), lente e altura AGL.
8. Imperfeições: Vinheta natural, aberração cromática leve, névoa atmosférica.

[GENERAL RULES]
- Foque em materiais (PBR), iluminação (qualidade V-Ray) e configurações de câmera.
- Mantenha o realismo arquitetônico.
- NÃO use termos de CGI (render, 3D, etc.) na descrição da cena, foque na realidade física.
- Se um material for marcado como 'is_mirror', inclua detalhes de 'reflection_analysis' para garantir que o espelho reflita o ambiente correto. Mencione 'mirror_location_color_hex' como a cor base da moldura ou superfície do espelho.
- Para Iluminação:
  * Descreva a luz ambiente (período, qualidade, direção).
  * Liste cada Ponto de Luz individualmente, especificando tipo, intensidade, cor e localização/propósito exato (ex: "Luz principal: Retângulo no canto do teto, 3200K, 80% de intensidade").
- Para Atmosfera:
  * Use 'atmosphere_type' para definir o humor geral (limpo, nublado, encoberto, pôr do sol, noite, dramático, neblina).
  * Use 'fog_density', 'fog_color' e 'fog_distance' para descrever a perspectiva aérea e profundidade.
  * Use parâmetros de Bloom para descrever o brilho e espalhamento de luz.
- Para Color Grading:
  * Use saturação, contraste, vibrance, hue shift, shadows e highlights para descrever o look final.

[MODE SPECIFIC RULES: ${mode.toUpperCase()}]
${mode === 'single' ? `
- Gere um ÚNICO prompt COESO.
- Comece com: "Uma imagem fotorrealista de..."
- Incorpore todos os dados sequencialmente: [estética] [materiais] [iluminação] [câmera] [efeitos] [parâmetros técnicos].
- Tamanho: 400-800 palavras.
- No final, inclua um objeto JSON de análise de qualidade neste formato:
[QUALITY_ANALYSIS: { "score": 85, "breakdown": { "clarity": 88, "specificity": 82, "coherence": 85, "brevity": 80 } }]
` : `
- Gere 6 blocos temáticos obrigatórios.
- Retorne um objeto JSON com: { "blocks": [{ "block_type": string, "title": string, "content": string, "word_count": number, "engine_recommendation": string, "quality_score": number, "quality_breakdown": { "clarity": number, "specificity": number, "coherence": number, "brevity": number } }], "overall_quality_score": number, "overall_quality_breakdown": { "clarity": number, "specificity": number, "coherence": number, "brevity": number }, "total_word_count": number }.
- Tipos de bloco: "architecture_base", "camera_system", "lighting_regime", "interior_completion", "exterior_completion", "materiality_finishing".
- Cada bloco deve ser independente e detalhado (150-250 palavras cada). O bloco "materiality_finishing" DEVE conter o "--- RESUMO DE CONFIGURAÇÃO TÉCNICA ---" com todos os dados de ConfigParams.
`}

[MANDATORY: TECHNICAL CONFIGURATION SUMMARY]
Ao final do prompt (ou como campo separado se JSON), você DEVE incluir uma seção intitulada "--- RESUMO DE CONFIGURAÇÃO TÉCNICA ---".
Nesta seção, liste TODOS os parâmetros de configuração do usuário (de ConfigParams) em um formato estruturado e legível (Chave: Valor).

Formato de saída: ${mode === 'single' ? 'Texto plano com JSON de análise ao final' : 'Objeto JSON completo'}.`;

    const userMessage = `Gere um prompt baseado em:
    ScanResult: ${JSON.stringify(scanResult)}
    ConfigParams: ${JSON.stringify(configParams)}
    Mode: ${mode}`;

    try {
      const response = await axios.post('/api/kie/gemini-2.5-pro/v1/chat/completions', {
        model: 'gemini-2.5-pro',
        stream: false,
        messages: [
          { role: 'system', content: [{ type: 'text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'text', text: userMessage }] }
        ],
        temperature: 0.7
      });

      const content = extractContent(response.data);
      if (!content) {
        throw new Error('AI_RESPONSE_EMPTY');
      }

      if (mode === 'blocks') {
        return parseJsonResponse(content);
      }
      
      // Parse quality analysis for single mode
      const analysisMatch = content.match(/\[QUALITY_ANALYSIS:\s*({[\s\S]*?})\]/);
    let qualityScore = 85;
    let qualityBreakdown = { clarity: 80, specificity: 80, coherence: 85, brevity: 80 };
    
    if (analysisMatch) {
      try {
        const analysis = JSON.parse(analysisMatch[1]);
        qualityScore = analysis.score;
        qualityBreakdown = analysis.breakdown;
      } catch (e) {
        console.error("Failed to parse quality analysis JSON", e);
      }
    }
    
    return {
      content: content.replace(/\[QUALITY_ANALYSIS:\s*{[\s\S]*?}\]/, '').trim(),
      qualityScore,
      qualityBreakdown
    };
    } catch (error) {
      console.error('Error in generatePrompt:', error);
      throw error;
    }
  },

  async generateImage(params: {
    prompt: string;
    model: 'nano-banana-2' | 'nano-banana-pro';
    resolution: '1K' | '2K' | '3K';
    aspect_ratio: string;
    image_input?: string[];
    sessionId: string;
    creditsCost: number;
  }) {
    await usageService.logUsage('image', { 
      model: params.model, 
      resolution: params.resolution,
      metadata: { sessionId: params.sessionId } 
    });
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('AUTH_REQUIRED');

    const generationId = `gen_${Date.now()}`;
    
    // 1. Create initial record in Firestore
    await setDoc(doc(db, 'image_generations', generationId), {
      id: generationId,
      userId,
      sessionId: params.sessionId,
      promptContent: params.prompt,
      generationStatus: 'queued',
      progressPercentage: 0,
      currentResolution: params.resolution.toLowerCase(),
      kieApiModel: params.model,
      creditsCost: params.creditsCost,
      creditsDeducted: true,
      createdAt: new Date().toISOString(),
      isCompleted: false,
      isPreviewReady: false,
      retryCount: 0
    });

    // 2. Call KIE API
    try {
      console.log(`[KIE] Creating task for model: ${params.model}`);
      const response = await axios.post('/api/kie/v1/nano-banana/create', {
        model: params.model,
        input: {
          prompt: params.prompt,
          image_input: params.image_input || [],
          aspect_ratio: params.aspect_ratio,
          resolution: params.resolution,
          output_format: 'jpg'
        }
      });
      
      const data = response.data;
      if (data.code !== 200) {
        throw new Error(data.msg || "Erro ao criar tarefa");
      }
      
      const taskId = data.data.taskId;
      console.log(`[KIE] Task created: ${taskId}`);

      // 3. Update record with taskId
      await updateDoc(doc(db, 'image_generations', generationId), {
        kieApiRequestId: taskId,
        generationStatus: 'processing',
        startedAt: new Date().toISOString()
      });

      return { taskId, generationId };
    } catch (error: any) {
      const errorMsg = error.response?.data?.msg || error.message;
      console.error('[KIE] Generation Init Error:', errorMsg);
      await updateDoc(doc(db, 'image_generations', generationId), {
        generationStatus: 'failed',
        errorMessage: errorMsg
      });
      throw error;
    }
  },

  async getTaskStatus(taskId: string, generationId?: string) {
    console.log(`[KIE] Checking status for task: ${taskId}`);
    const response = await axios.get(`/api/kie/v1/nano-banana/status/${taskId}`);
    const data = response.data;
    
    if (data.code !== 200 && data.code !== 100) {
      throw new Error(data.msg || "Erro ao consultar status");
    }
    
    const taskData = data.data || data;
    // recordInfo uses 'state' instead of 'status'
    const state = taskData.state || taskData.status;
    console.log(`[KIE] Task ${taskId} state: ${state}`);

    // Universal URL extraction
    let resultUrl = taskData.result_url || 
                    taskData.works?.[0]?.url || 
                    taskData.data?.works?.[0]?.url ||
                    taskData.data?.result_url;

    // Handle recordInfo resultJson
    if (!resultUrl && taskData.resultJson) {
      try {
        const parsedResult = JSON.parse(taskData.resultJson);
        if (parsedResult.resultUrls && parsedResult.resultUrls.length > 0) {
          resultUrl = parsedResult.resultUrls[0];
        }
      } catch (e) {
        console.warn('[KIE] Failed to parse resultJson:', e);
      }
    }

    if (generationId) {
      const updateData: any = {
        kieApiStatus: state,
        updatedAt: new Date().toISOString()
      };

      // Map 'success' or 'completed' to 'completed'
      if (state === 'completed' || state === 'success' || (data.code === 200 && resultUrl)) {
        updateData.generationStatus = 'completed';
        updateData.isCompleted = true;
        updateData.completedAt = new Date().toISOString();
        if (resultUrl) {
          updateData.imageUrlPreview = resultUrl;
          updateData.generationResultUrl = resultUrl;
        }
      } else if (state === 'failed' || state === 'error' || state === 'fail') {
        updateData.generationStatus = 'failed';
        updateData.errorMessage = taskData.msg || 'Erro na geração';
      }

      updateDoc(doc(db, 'image_generations', generationId), updateData).catch(() => {});
    }
    
    return { ...taskData, resultUrl, status: state };
  },

  async logCreditTransaction(params: {
    amount: number;
    type: 'debit' | 'credit' | 'refund';
    reason: string;
    referenceId?: string;
  }) {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await setDoc(doc(db, 'credit_audit_logs', logId), {
      id: logId,
      userId,
      amount: params.amount,
      type: params.type,
      reason: params.reason,
      referenceId: params.referenceId || '',
      createdAt: new Date().toISOString()
    });
  },

  async analyzeMaterialImage(imageBase64: string): Promise<any> {
    await usageService.logUsage('scan', { metadata: { target: 'material' } });
    
    const systemInstruction = `You are an expert architectural material analyst. Your task is to analyze a single image of a material and extract its physical and PBR properties.
    
    [OBJECTIVE]
    Generate a Material JSON object with 100% technical accuracy.
    
    [CRITICAL RULE: IDIOMA]
    The material name (elemento) and finish (acabamento) MUST be in Brazilian Portuguese.
    
    [CRITICAL RULE: CGI]
    NEVER use CGI terms. Focus on physical reality.
    
    [SCHEMA REFERENCE]
    ${JSON.stringify(MaterialSchema.shape, null, 2)}`;
    
    const response = await axios.post('/api/kie/gemini-2.5-pro/v1/chat/completions', {
      model: 'gemini-2.5-pro',
      stream: false,
      messages: [
        { role: 'system', content: [{ type: 'text', text: systemInstruction }] },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this material image and extract its properties as JSON.' },
            {
              type: 'image_url',
              image_url: { url: imageBase64 }
            }
          ]
        }
      ],
      temperature: 0.7
    });

    const content = extractContent(response.data);
    return parseJsonResponse(content);
  }
};
