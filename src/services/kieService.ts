import axios from 'axios';
import { z } from 'zod';
import { db, auth } from '../firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { uploadTempImage, deleteTempImage } from './storageService';

// Zod Schema for ScanResult
const PBRDiffuseSchema = z.object({
  description: z.string(),
  color_hex: z.string(),
  color_rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }),
  saturation: z.number(),
  brightness: z.number(),
  texture_type: z.enum(['solid', 'pattern', 'natural', 'fabric_weave', 'rough']),
  texture_scale: z.enum(['micro', 'fine', 'medium', 'coarse'])
});

const PBRReflectionSchema = z.object({
  intensity: z.number(),
  fresnel_at_0: z.number(),
  fresnel_at_90: z.number(),
  is_metallic: z.boolean(),
  metallic_type: z.string().optional()
});

const PBRGlossinessSchema = z.object({
  smoothness: z.number(),
  roughness: z.number(),
  micro_surface_variation: z.number(),
  is_isotropic: z.boolean(),
  anisotropy_direction: z.string().optional(),
  anisotropy_strength: z.number().optional()
});

const PBRBumpSchema = z.object({
  description: z.string(),
  bump_height: z.number(),
  bump_frequency: z.enum(['fine', 'medium', 'coarse']),
  bump_pattern: z.enum(['smooth', 'subtle', 'pronounced', 'extreme']),
  has_grooves: z.boolean().optional(),
  groove_direction: z.string().optional()
});

const PBRLightBehaviorSchema = z.object({
  scattering_description: z.string(),
  subsurface_scattering: z.boolean().optional(),
  sss_depth: z.number().optional(),
  ambient_occlusion_intensity: z.number().optional(),
  translucency: z.number().optional(),
  ior: z.number().optional(),
  transmission_roughness: z.number().optional()
});

const AmbientLightSchema = z.object({
  period: z.enum(['golden_hour', 'morning', 'afternoon', 'late_afternoon', 'evening', 'night', 'blue_hour', 'overcast', 'indoor_artificial']),
  temp_k: z.number().int().min(2700).max(8000),
  azimuthal_direction: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
  elevation_angle: z.number().min(0).max(90),
  quality: z.enum(['hard', 'soft', 'diffuse', 'volumetric']),
  dominant_source: z.enum(['natural', 'artificial', 'mixed']),
  indirect_ratio: z.string(),
  light_mixing_description: z.string(),
  bloom_glare: z.boolean(),
  bloom_intensity: z.number().min(0).max(100).optional(),
  bloom_threshold: z.number().min(0).max(2).optional(),
  bloom_color_tint: z.string().optional(),
  has_shadow_direction: z.boolean(),
  is_backlit: z.boolean().optional(),
  is_rim_lit: z.boolean().optional(),
  confidence: z.number().min(0).max(100),
  confidence_factors: z.array(z.string()).optional()
});

const LightPointSchema = z.object({
  id: z.string(),
  location_description: z.string(),
  type: z.enum(['rectangle', 'sphere', 'spot', 'ies', 'omni', 'dome', 'emissive', 'ambient']),
  intensity_initial: z.number().min(0).max(100),
  temp_k_initial: z.number().int().min(2700).max(8000),
  color_hex: z.string(),
  color_rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }),
  shape: z.enum(['rectangular', 'elliptical', 'spherical', 'conical', 'mesh']),
  decay: z.enum(['inverse_square', 'linear', 'none']),
  cone_angle: z.number().optional(),
  penumbra_angle: z.number().optional(),
  directionality: z.number().min(0).max(1),
  shadow_softness: z.number().min(0).max(1),
  ray_traced_shadows: z.boolean(),
  affect_specular: z.boolean(),
  affect_diffuse: z.boolean(),
  affect_reflections: z.boolean(),
  visible_in_render: z.boolean(),
  spatial_x_pct: z.number().min(0).max(100),
  spatial_y_pct: z.number().min(0).max(100),
  spatial_z_depth: z.enum(['foreground', 'midground', 'background']).optional(),
  bloom_glare: z.boolean(),
  lens_distortion_contribution: z.number().min(0).max(1).optional(),
  artifacts_visible: z.boolean().optional(),
  confidence: z.number().min(0).max(100),
  confidence_factors: z.array(z.string()).optional(),
  is_speculative: z.boolean().optional(),
  visual_impact: z.enum(['high', 'medium', 'low']),
  serves_as: z.enum(['key_light', 'fill_light', 'back_light', 'rim_light', 'accent', 'ambient'])
});

const MaterialSchema = z.object({
  id: z.string(),
  elemento: z.string(),
  location_description: z.string().optional(),
  location_reference: z.string().optional(),
  acabamento: z.string(),
  reflectancia: z.enum(['matte', 'semi-matte', 'semi-gloss', 'gloss', 'espelhado']),
  pbr_diffuse: PBRDiffuseSchema,
  pbr_reflection: PBRReflectionSchema,
  pbr_glossiness: PBRGlossinessSchema,
  pbr_bump: PBRBumpSchema,
  pbr_light_behavior: PBRLightBehaviorSchema,
  adjacent_materials: z.array(z.string()).optional(),
  interaction_with_light: z.string().optional(),
  confidence: z.number(),
  confidence_factors: z.array(z.string()).optional(),
  visibility: z.number(),
  is_dominant: z.boolean().optional(),
  material_category: z.enum([
    'paint_coating', 'wood', 'stone', 'ceramic_tile', 'glass', 
    'metal', 'concrete', 'textile', 'plastic_composite', 
    'leather', 'paper_wallpaper', 'custom'
  ])
});

export const ScanResultSchema = z.object({
  isFloorPlan: z.boolean(),
  typology: z.enum(['PLANTA_BAIXA', 'PERSPECTIVA', 'FACHADA', 'CORTE', 'ELEVAÇÃO', 'DETALHE', '3D_MOCK']),
  floors: z.number().int().optional(),
  volumes: z.string().optional(),
  materials: z.array(MaterialSchema),
  cameraData: z.object({
    height_m: z.number(),
    distance_m: z.number(),
    focal_apparent: z.number(),
    focal_actual: z.number().optional(),
    fov_horizontal: z.number(),
    fov_vertical: z.number(),
    depth_of_field: z.number(),
    lens_distortion: z.object({
      type: z.enum(['rectilinear', 'fisheye', 'panoramic']),
      coefficient: z.number()
    }),
    pitch: z.number(),
    yaw: z.number(),
    roll: z.number(),
    aspect_ratio: z.string(),
    image_width_px: z.number(),
    image_height_px: z.number(),
    image_type_influence: z.object({
      floor_plan_compatible: z.boolean(),
      perspective_type: z.enum(['isometric', 'dimetric', 'linear', 'aerial', 'worm', 'bird', 'frontal']),
      viewing_angle: z.string()
    }),
    vanishing_points: z.number(),
    perspective_lines: z.object({
      primary: z.array(z.number()),
      secondary: z.array(z.number())
    }).optional(),
    rendering_impact: z.object({
      render_distance_optimal: z.number(),
      fov_for_composition: z.number(),
      depth_field_strength: z.number(),
      lens_quality: z.enum(['sharp', 'soft', 'cinematic'])
    }),
    confidence: z.object({
      height: z.number(),
      distance: z.number(),
      focal: z.number(),
      perspective: z.number(),
      general: z.number()
    }),
    detected_at: z.string(),
    camera_preset: z.string(),
    editable: z.boolean()
  }),
  light: AmbientLightSchema,
  lightPoints: z.array(LightPointSchema),
  confidence: z.object({
    materials: z.number().min(0).max(100),
    camera: z.number().min(0).max(100),
    light: z.number().min(0).max(100),
    context: z.number().min(0).max(100),
    general: z.number().min(0).max(100),
    composition: z.number().min(0).max(100),
    lighting_quality: z.number().min(0).max(100),
    photorealism: z.number().min(0).max(100),
    technical_accuracy: z.number().min(0).max(100)
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
- Estimate floors and describe geometric volumes.

[TOOL-PLANTA: FLOOR PLAN ANALYSIS]
- If isFloorPlan is true: Prioritize analysis of wall thickness, openings (doors/windows), and spatial distribution.

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
  
  try {
    return JSON.parse(content);
  } catch (e) {
    const match = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch (e2) {
        console.error("Failed to parse extracted JSON:", e2);
      }
    }
    
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } catch (e3) {
        console.error("Failed to parse substring JSON:", e3);
      }
    }
    
    throw new Error("Invalid JSON response from AI: " + content);
  }
};

const extractContent = (data: any): string => {
  if (!data) return '';
  
  // Handle KIE specific error format (e.g. 500 maintenance)
  if (data.code && data.code !== 200 && data.code !== 0) {
    const errorMsg = data.msg || data.message || 'Unknown KIE API Error';
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
  async diagnoseImage(imageInput: string, sessionId: string): Promise<ScanResult> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('AUTH_REQUIRED');

    console.log('Starting diagnosis for session:', sessionId);
    const startTime = Date.now();

    // NOVO: Aceitar URLs com/sem credenciais E base64
    let formattedImage = imageInput;
    let imageSource = 'unknown';

    // Detectar tipo de input
    if (imageInput.startsWith('data:image')) {
      console.log('Input is base64 data URL');
      formattedImage = imageInput;
      imageSource = 'base64_direct';
    } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      console.log('Input is HTTP/HTTPS URL (signed or proxy)');
      formattedImage = imageInput;
      imageSource = 'signed_url';
    } else if (imageInput.startsWith('blob:')) {
      console.log('Input is blob URL (CORS may fail)');
      formattedImage = imageInput;
      imageSource = 'blob_url';
    } else if (imageInput.includes('firebasestorage')) {
      console.log('Input contains Firebase URL structure');
      formattedImage = imageInput;
      imageSource = 'firebase_url';
    } else {
      // Assume it's base64 without prefix
      console.log('Input appears to be raw base64, adding prefix');
      formattedImage = `data:image/jpeg;base64,${imageInput}`;
      imageSource = 'base64_raw';
    }

    console.log('Image data format check:', {
      length: formattedImage.length,
      prefix: formattedImage.substring(0, 50),
      source: imageSource,
      isDataUrl: formattedImage.startsWith('data:'),
      isUrl: formattedImage.startsWith('http')
    });

    try {
      console.log('Calling KIE Gemini API for diagnosis...');
      const response = await axios.post('/api/kie/gemini', {
        model: 'gemini-3.1-pro',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYSTEM_INSTRUCTION },
              { type: 'text', text: 'Perform a full architectural diagnosis of this image. Return ONLY the JSON object.' },
              { type: 'image_url', image_url: { url: formattedImage } }
            ]
          }
        ],
        max_tokens: 8192,
        temperature: 0.7,
        stream: false
      }, { timeout: 120000 });

      console.log('KIE Gemini API responded successfully. Status:', response.status);

      const content = extractContent(response.data);
      if (!content) {
        console.error('Failed to extract content from AI response. Full data:', response.data);
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
      console.log('Saving scan results to Firestore...', { scanId, userId, sessionId });

      const scanDocData = {
        id: scanId,
        userId: userId, // Explicitly ensure this matches the rule
        sessionId,
        scanData: validatedData,
        imageSource, // NOVO: Log qual fonte de imagem foi usada
        createdAt: new Date().toISOString()
      };

      setDoc(doc(db, 'scan_results', scanId), scanDocData)
        .then(() => console.log('Successfully saved scan results'))
        .catch(e => {
          console.error('CRITICAL: Permission denied saving scan_results. Check rules.', e);
          console.log('Attempted data:', scanDocData);
        });

      const sessionUpdateData = {
        userId: userId, // Explicitly provide userId for rules
        scanResult: validatedData,
        scanStatus: 'completed',
        scanDurationMs: durationMs,
        imageSource, // NOVO: Track image source in session
        updatedAt: new Date().toISOString()
      };

      setDoc(doc(db, 'generation_sessions', sessionId), sessionUpdateData, { merge: true })
        .then(() => console.log('Successfully updated generation session'))
        .catch(e => {
          console.error('CRITICAL: Permission denied updating generation_sessions. Check rules.', e);
          console.log('Attempted data:', sessionUpdateData);
        });

      return validatedData;
    } catch (err: any) {
      console.error('Diagnosis Error:', err);

      // NOVO: Melhor tratamento de erro
      const errorMsg = err.message || 'Unknown error during diagnosis';
      const isNetworkError = errorMsg.includes('network') || errorMsg.includes('TIMEOUT') || errorMsg.includes('401') || errorMsg.includes('403');

      console.error('Error details:', {
        source: imageSource,
        isNetworkError,
        errorMsg
      });

      try {
        setDoc(doc(db, 'generation_sessions', sessionId), {
          userId,
          scanStatus: 'failed',
          scanErrors: [errorMsg],
          imageSource,
          failureReason: isNetworkError ? 'network_or_auth' : 'validation_or_ai',
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      } catch (updateErr) {
        console.error('Failed to update session status:', updateErr);
      }
      throw err;
    }
  },

  async detectArchitecture(imageBase64: string) {
    // Ensure imageBase64 is a proper data URL
    let formattedImage = imageBase64;
    if (!formattedImage.startsWith('data:')) {
      formattedImage = `data:image/jpeg;base64,${formattedImage}`;
    }

    const response = await axios.post('/api/kie/gemini', {
      model: 'gemini-3.1-pro',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'You are an architectural expert. Your task is to determine if an image represents an architectural subject (building, interior, floor plan, facade, etc.). Respond ONLY with a JSON object: {"isArchitecture": boolean, "confidence": number, "reason": string}' },
            {
              type: 'image_url',
              image_url: {
                url: formattedImage,
              },
            },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.1,
      stream: false
    }, { timeout: 30000 });
    
    const content = extractContent(response.data);
    return parseJsonResponse(content);
  },

  async generatePrompt(scanResult: any, configParams: any, mode: 'single' | 'blocks') {
    const negativePrompt = `CGI, render, 3D render, unreal engine, octane render, vray, blender, digital art, artificial lighting, studio lighting, harsh shadows, oversaturated, low quality, blurry, distorted, watermark, text, people, illustration, painting, sketch, cartoon, plastic texture, fake, synthetic, computer generated, sketchup, maquete, maquette, architectural model, clay render, wireframe, added windows, added doors, added openings, extra furniture, invented objects, hallucinated elements, curtains where there are walls, blinds on solid walls, symmetrical composition, perfect geometry, raytracing.`;

    const systemPrompt = `Você é um engenheiro de prompts arquitetônicos especialista. Seu objetivo é transformar dados técnicos de ScanResult e configurações do usuário em prompts de alta fidelidade e fotorrealistas para o modelo Nano Banana (Gemini 2.5 Flash Image).

[CRITICAL: IDIOMA]
O prompt gerado deve estar INTEGRALMENTE em PORTUGUÊS DO BRASIL.

[CRITICAL: NEGATIVE PROMPT]
Você DEVE SEMPRE incluir este prompt negativo na sua resposta:
"${negativePrompt}"

[CRITICAL: NANO BANANA (GEMINI 2.5 FLASH IMAGE) RULES]
Este modelo é extremamente capaz de seguir instruções detalhadas. Seja muito específico, descritivo e use parâmetros de documentação técnica.

[CRITICAL: PLANTA_BAIXA (TOP-DOWN) RULES]
Se a tipologia for PLANTA_BAIXA:
1. Use o parâmetro 'topDownAngle':
   - 90°: Descreva como "perspectiva superior (top-down)", "vista aérea (bird's eye view)", "planta baixa arquitetônica perfeitamente vertical".
   - 45°: Descreva como "perspectiva isométrica", "corte arquitetônico 3D", "vista axonometrica".
2. Use o parâmetro 'environmentType' (Contexto: Brasil):
   - CONDOMINIO_ALTO_PADRAO: "Condomínio fechado brasileiro de alto padrão", "paisagismo residencial de luxo", "arquitetura contemporânea sofisticada".
   - URBANO: "Ambiente urbano brasileiro", "contexto de cidade", "densidade metropolitana".
   - RURAL: "Paisagem rural brasileira", "cenário de campo", "arquitetura integrada à natureza".
   - BAIRRO_COMUM: "Bairro brasileiro típico", "área residencial comum", "contexto suburbano".

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
- Gere 4-6 blocos temáticos.
- Retorne um objeto JSON com: { "blocks": [{ "block_type": string, "title": string, "content": string, "word_count": number, "engine_recommendation": string, "quality_score": number, "quality_breakdown": { "clarity": number, "specificity": number, "coherence": number, "brevity": number } }], "overall_quality_score": number, "overall_quality_breakdown": { "clarity": number, "specificity": number, "coherence": number, "brevity": number }, "total_word_count": number }.
- Tipos de bloco: "visual_style", "materials_textures", "lighting", "camera_composition", "post_production", "technical_params".
- Cada bloco deve ser independente e detalhado (100-200 palavras cada). O bloco "technical_params" DEVE conter o "--- RESUMO DE CONFIGURAÇÃO TÉCNICA ---" com todos os dados de ConfigParams.
`}

[MANDATORY: TECHNICAL CONFIGURATION SUMMARY]
Ao final do prompt (ou como campo separado se JSON), você DEVE incluir uma seção intitulada "--- RESUMO DE CONFIGURAÇÃO TÉCNICA ---".
Nesta seção, liste TODOS os parâmetros de configuração do usuário (de ConfigParams) em um formato estruturado e legível (Chave: Valor).

Formato de saída: ${mode === 'single' ? 'Texto plano com JSON de análise ao final' : 'Objeto JSON completo'}.`;

    const userMessage = `Gere um prompt baseado em:
    ScanResult: ${JSON.stringify(scanResult)}
    ConfigParams: ${JSON.stringify(configParams)}
    Mode: ${mode}`;

    const response = await axios.post('/api/kie/gemini', {
      model: 'gemini-3.1-pro',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            { type: 'text', text: userMessage }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.7,
      stream: false
    }, { timeout: 60000 });

    const content = extractContent(response.data);
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
  },

  async generateImage(params: {
    prompt: string;
    model: 'nano-banana-2' | 'nano-banana-pro';
    resolution: '1K' | '2K' | '4K';
    aspect_ratio: string;
    image_input?: string[];
  }) {
    const response = await axios.post('/api/kie/nano-banana/create', {
      model: params.model,
      input: {
        prompt: params.prompt,
        image_input: params.image_input || [],
        aspect_ratio: params.aspect_ratio,
        resolution: params.resolution,
        output_format: 'jpg'
      }
    });
    
    if (response.data.code !== 200) {
      throw new Error(response.data.msg || "Failed to create generation task");
    }
    
    return response.data.data.taskId;
  },

  async getTaskStatus(taskId: string) {
    const response = await axios.get(`/api/kie/nano-banana/status/${taskId}`);
    
    if (response.data.code !== 200) {
      throw new Error(response.data.msg || "Failed to get task status");
    }
    
    return response.data.data;
  },

  async analyzeMaterialImage(imageBase64: string): Promise<any> {
    // Ensure imageBase64 is a proper data URL
    let formattedImage = imageBase64;
    if (!formattedImage.startsWith('data:')) {
      formattedImage = `data:image/jpeg;base64,${formattedImage}`;
    }

    const systemInstruction = `You are an expert architectural material analyst. Your task is to analyze a single image of a material and extract its physical and PBR properties.
    
    [OBJECTIVE]
    Generate a Material JSON object with 100% technical accuracy.
    
    [CRITICAL RULE: IDIOMA]
    The material name (elemento) and finish (acabamento) MUST be in Brazilian Portuguese.
    
    [CRITICAL RULE: CGI]
    NEVER use CGI terms. Focus on physical reality.
    
    [SCHEMA REFERENCE]
    ${JSON.stringify(MaterialSchema.shape, null, 2)}`;

    const response = await axios.post('/api/kie/gemini', {
      model: 'gemini-3.1-pro',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemInstruction },
            { type: 'text', text: 'Analyze this material image and extract its properties as JSON.' },
            { type: 'image_url', image_url: { url: formattedImage } }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.7,
      stream: false
    }, { timeout: 60000 });

    const content = extractContent(response.data);
    return parseJsonResponse(content);
  }
};
