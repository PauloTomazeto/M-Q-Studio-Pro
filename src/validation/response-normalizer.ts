/**
 * Response Normalizer for Vision API Double-Serialization Fix
 *
 * Handles cases where Claude Vision returns color_rgb and PBR fields as JSON strings
 * instead of native objects. This is a defensive parser that works alongside the
 * updated prompt instructions.
 *
 * Date: 2026-04-13
 * Status: Production Ready
 * Spec: SPEC_SOLUCAO_JSON_SERIALIZATION.md
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a parsed RGB color
 */
export interface ParsedRGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse color_rgb field (handles both string and object formats)
 *
 * Examples:
 * - Input: { r: 255, g: 250, b: 242 } → Output: { r: 255, g: 250, b: 242 }
 * - Input: "{\"r\":255,\"g\":250,\"b\":242}" → Output: { r: 255, g: 250, b: 242 }
 * - Input: "255, 250, 242" → Output: { r: 255, g: 250, b: 242 }
 * - Input: null → Output: null
 */
export function parseColorRGB(value: any): ParsedRGB | null {
  // If already an object with r, g, b properties, validate and return
  if (value && typeof value === 'object' && value.r !== undefined && value.g !== undefined && value.b !== undefined) {
    return {
      r: Math.min(255, Math.max(0, Number(value.r) || 0)),
      g: Math.min(255, Math.max(0, Number(value.g) || 0)),
      b: Math.min(255, Math.max(0, Number(value.b) || 0))
    };
  }

  // If it's a string, try to parse as JSON first, then fallback to comma-separated
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();

    // Try JSON parsing first
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseColorRGB(parsed); // Recursive call for validation
      } catch (e) {
        console.warn('[parseColorRGB] Failed to parse JSON string:', trimmed, e);
      }
    }

    // Try comma-separated format (e.g., "255, 250, 242")
    const match = trimmed.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      return {
        r: Math.min(255, Math.max(0, parseInt(match[1], 10))),
        g: Math.min(255, Math.max(0, parseInt(match[2], 10))),
        b: Math.min(255, Math.max(0, parseInt(match[3], 10)))
      };
    }
  }

  // Return null for invalid/missing values
  return null;
}

/**
 * Parse any PBR field (diffuse, reflection, glossiness, bump, etc.)
 * Handles both JSON string and object formats
 *
 * Examples:
 * - Input: { description: "...", color_hex: "#8A674A" } → Output: { description: "...", color_hex: "#8A674A" }
 * - Input: "{\"description\":\"...\",\"color_hex\":\"#8A674A\"}" → Output: { description: "...", color_hex: "#8A674A" }
 * - Input: null → Output: null
 */
export function parsePBRField(value: any, fieldName: string = 'pbr_field'): any {
  // If already an object, return as-is
  if (value && typeof value === 'object') {
    return value;
  }

  // If it's a string, try to parse as JSON
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();

    // Check if it looks like JSON (starts with { or [)
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        console.log(`[parsePBRField] Successfully parsed ${fieldName} from JSON string`);
        return parsed;
      } catch (e) {
        console.warn(`[parsePBRField] Failed to parse ${fieldName} JSON string:`, trimmed);
        return null;
      }
    }
  }

  // Return null for invalid/missing values
  return null;
}

/**
 * Normalize a single material object
 * - Ensures id is present
 * - Converts pbr_* string fields to objects
 * - Parses color_rgb in nested structures
 */
function normalizeMaterial(material: any, index: number): any {
  if (!material || typeof material !== 'object') return material;

  const normalized = { ...material };

  // Ensure ID exists
  if (!normalized.id) {
    normalized.id = uuidv4();
    console.log(`[normalizeMaterial] Generated missing id for material ${index}`);
  }

  // Normalize pbr_diffuse
  if (normalized.pbr_diffuse) {
    const parsed = parsePBRField(normalized.pbr_diffuse, 'pbr_diffuse');
    if (parsed) {
      normalized.pbr_diffuse = parsed;
      // Ensure color_rgb inside pbr_diffuse is an object
      if (normalized.pbr_diffuse.color_rgb) {
        const rgbParsed = parseColorRGB(normalized.pbr_diffuse.color_rgb);
        if (rgbParsed) {
          normalized.pbr_diffuse.color_rgb = rgbParsed;
        }
      }
    }
  }

  // Normalize pbr_reflection
  if (normalized.pbr_reflection) {
    const parsed = parsePBRField(normalized.pbr_reflection, 'pbr_reflection');
    if (parsed) {
      normalized.pbr_reflection = parsed;
    }
  }

  // Normalize pbr_glossiness
  if (normalized.pbr_glossiness) {
    const parsed = parsePBRField(normalized.pbr_glossiness, 'pbr_glossiness');
    if (parsed) {
      normalized.pbr_glossiness = parsed;
    }
  }

  // Normalize pbr_bump
  if (normalized.pbr_bump) {
    const parsed = parsePBRField(normalized.pbr_bump, 'pbr_bump');
    if (parsed) {
      normalized.pbr_bump = parsed;
    }
  }

  // Normalize pbr_light_behavior
  if (normalized.pbr_light_behavior) {
    const parsed = parsePBRField(normalized.pbr_light_behavior, 'pbr_light_behavior');
    if (parsed) {
      normalized.pbr_light_behavior = parsed;
    }
  }

  return normalized;
}

/**
 * Normalize a single light point object
 * - Ensures id is present
 * - Parses color_rgb from string to object
 */
function normalizeLightPoint(lightPoint: any, index: number): any {
  if (!lightPoint || typeof lightPoint !== 'object') return lightPoint;

  const normalized = { ...lightPoint };

  // Ensure ID exists
  if (!normalized.id) {
    normalized.id = uuidv4();
    console.log(`[normalizeLightPoint] Generated missing id for lightPoint ${index}`);
  }

  // Parse color_rgb if it's a string
  if (normalized.color_rgb) {
    const parsed = parseColorRGB(normalized.color_rgb);
    if (parsed) {
      normalized.color_rgb = parsed;
      console.log(`[normalizeLightPoint] Parsed color_rgb for lightPoint ${index}`);
    }
  }

  return normalized;
}

/**
 * Main normalization function for Vision API responses
 *
 * Handles:
 * - Double-serialized JSON strings in color_rgb fields
 * - Double-serialized JSON strings in PBR fields
 * - Missing id fields
 * - Nested color_rgb in materials
 *
 * Returns the normalized response ready for Zod validation
 */
export function normalizeVisionResponse(response: any): any {
  if (!response || typeof response !== 'object') {
    return response;
  }

  const normalized = { ...response };

  // Normalize materials array
  if (normalized.materials && Array.isArray(normalized.materials)) {
    normalized.materials = normalized.materials.map((mat: any, idx: number) =>
      normalizeMaterial(mat, idx)
    );
  }

  // Normalize lightPoints array
  if (normalized.lightPoints && Array.isArray(normalized.lightPoints)) {
    normalized.lightPoints = normalized.lightPoints.map((light: any, idx: number) =>
      normalizeLightPoint(light, idx)
    );
  }

  return normalized;
}

/**
 * Diagnostic function to report normalization status
 * Used for logging and debugging
 */
export function getDiagnosticSummary(response: any, normalized: any): {
  materialsProcessed: number;
  lightPointsProcessed: number;
  changesDetected: boolean;
  fieldErrors: string[];
} {
  const fieldErrors: string[] = [];
  let changesDetected = false;

  // Check materials
  const materialsCount = normalized.materials?.length || 0;
  if (materialsCount > 0) {
    normalized.materials.forEach((mat: any, idx: number) => {
      if (typeof mat.pbr_diffuse === 'string') fieldErrors.push(`materials[${idx}].pbr_diffuse still a string`);
      if (typeof mat.pbr_reflection === 'string') fieldErrors.push(`materials[${idx}].pbr_reflection still a string`);
      if (typeof mat.pbr_glossiness === 'string') fieldErrors.push(`materials[${idx}].pbr_glossiness still a string`);
      if (typeof mat.pbr_bump === 'string') fieldErrors.push(`materials[${idx}].pbr_bump still a string`);
      if (mat.pbr_diffuse?.color_rgb && typeof mat.pbr_diffuse.color_rgb === 'string') {
        fieldErrors.push(`materials[${idx}].pbr_diffuse.color_rgb still a string`);
      }
    });
  }

  // Check lightPoints
  const lightPointsCount = normalized.lightPoints?.length || 0;
  if (lightPointsCount > 0) {
    normalized.lightPoints.forEach((light: any, idx: number) => {
      if (light.color_rgb && typeof light.color_rgb === 'string') {
        fieldErrors.push(`lightPoints[${idx}].color_rgb still a string`);
      }
    });
  }

  changesDetected = fieldErrors.length === 0;

  return {
    materialsProcessed: materialsCount,
    lightPointsProcessed: lightPointsCount,
    changesDetected,
    fieldErrors
  };
}
