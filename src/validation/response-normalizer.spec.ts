/**
 * Unit Tests for Response Normalizer
 *
 * Tests 27+ scenarios for JSON serialization fix
 */

import {
  parseColorRGB,
  parsePBRField,
  normalizeVisionResponse,
  getDiagnosticSummary,
  ParsedRGB
} from './response-normalizer';

describe('Response Normalizer - Color RGB Parsing', () => {
  describe('parseColorRGB', () => {
    // Test 1: Object format (should pass through)
    it('T1: should handle color_rgb as object with r,g,b', () => {
      const input = { r: 255, g: 250, b: 242 };
      const result = parseColorRGB(input);
      expect(result).toEqual({ r: 255, g: 250, b: 242 });
    });

    // Test 2: JSON string format (double-serialization fix)
    it('T2: should parse color_rgb from JSON string', () => {
      const input = '{"r":255,"g":250,"b":242}';
      const result = parseColorRGB(input);
      expect(result).toEqual({ r: 255, g: 250, b: 242 });
    });

    // Test 3: Comma-separated string format
    it('T3: should parse color_rgb from comma-separated string', () => {
      const input = '255, 250, 242';
      const result = parseColorRGB(input);
      expect(result).toEqual({ r: 255, g: 250, b: 242 });
    });

    // Test 4: Comma-separated without spaces
    it('T4: should parse color_rgb from comma-separated (no spaces)', () => {
      const input = '255,250,242';
      const result = parseColorRGB(input);
      expect(result).toEqual({ r: 255, g: 250, b: 242 });
    });

    // Test 5: Boundary values (0)
    it('T5: should handle min boundary (0,0,0)', () => {
      const input = { r: 0, g: 0, b: 0 };
      const result = parseColorRGB(input);
      expect(result).toEqual({ r: 0, g: 0, b: 0 });
    });

    // Test 6: Boundary values (255)
    it('T6: should handle max boundary (255,255,255)', () => {
      const input = { r: 255, g: 255, b: 255 };
      const result = parseColorRGB(input);
      expect(result).toEqual({ r: 255, g: 255, b: 255 });
    });

    // Test 7: Out-of-range values (should clamp)
    it('T7: should clamp values > 255 to 255', () => {
      const input = { r: 300, g: 250, b: 242 };
      const result = parseColorRGB(input);
      expect(result).toEqual({ r: 255, g: 250, b: 242 });
    });

    // Test 8: Negative values (should clamp to 0)
    it('T8: should clamp negative values to 0', () => {
      const input = { r: -50, g: 250, b: 242 };
      const result = parseColorRGB(input);
      expect(result).toEqual({ r: 0, g: 250, b: 242 });
    });

    // Test 9: String values (should coerce)
    it('T9: should coerce string values to numbers', () => {
      const input = { r: '255', g: '250', b: '242' };
      const result = parseColorRGB(input);
      expect(result).toEqual({ r: 255, g: 250, b: 242 });
    });

    // Test 10: Null input
    it('T10: should return null for null input', () => {
      const result = parseColorRGB(null);
      expect(result).toBeNull();
    });

    // Test 11: Undefined input
    it('T11: should return null for undefined input', () => {
      const result = parseColorRGB(undefined);
      expect(result).toBeNull();
    });

    // Test 12: Empty string
    it('T12: should return null for empty string', () => {
      const result = parseColorRGB('');
      expect(result).toBeNull();
    });

    // Test 13: Invalid JSON string
    it('T13: should return null for invalid JSON', () => {
      const result = parseColorRGB('{invalid json}');
      expect(result).toBeNull();
    });

    // Test 14: JSON string with spaces
    it('T14: should parse JSON string with spaces', () => {
      const input = '{ "r": 255, "g": 250, "b": 242 }';
      const result = parseColorRGB(input);
      expect(result).toEqual({ r: 255, g: 250, b: 242 });
    });
  });
});

describe('Response Normalizer - PBR Field Parsing', () => {
  describe('parsePBRField', () => {
    // Test 15: Object format (should pass through)
    it('T15: should handle pbr_diffuse as object', () => {
      const input = {
        description: 'Wood veneer',
        color_hex: '#8A674A',
        color_rgb: { r: 138, g: 103, b: 74 },
        saturation: 0.35,
        brightness: 0.54
      };
      const result = parsePBRField(input, 'pbr_diffuse');
      expect(result).toEqual(input);
    });

    // Test 16: JSON string format (double-serialization fix)
    it('T16: should parse pbr_diffuse from JSON string', () => {
      const input = '{"description":"Wood veneer","color_hex":"#8A674A","color_rgb":{"r":138,"g":103,"b":74}}';
      const result = parsePBRField(input, 'pbr_diffuse');
      expect(result).toEqual({
        description: 'Wood veneer',
        color_hex: '#8A674A',
        color_rgb: { r: 138, g: 103, b: 74 }
      });
    });

    // Test 17: Empty object
    it('T17: should handle empty object', () => {
      const input = {};
      const result = parsePBRField(input, 'pbr_field');
      expect(result).toEqual({});
    });

    // Test 18: Null input
    it('T18: should return null for null input', () => {
      const result = parsePBRField(null, 'pbr_field');
      expect(result).toBeNull();
    });

    // Test 19: Invalid JSON string
    it('T19: should return null for invalid JSON string', () => {
      const result = parsePBRField('{invalid}', 'pbr_field');
      expect(result).toBeNull();
    });

    // Test 20: Complex nested object
    it('T20: should parse complex nested PBR structure', () => {
      const input = '{"description":"Marble","nested":{"level":2,"data":[1,2,3]},"color_hex":"#E1E1E1"}';
      const result = parsePBRField(input, 'pbr_field');
      expect(result.description).toBe('Marble');
      expect(result.nested.level).toBe(2);
    });
  });
});

describe('Response Normalizer - Full Response Normalization', () => {
  describe('normalizeVisionResponse', () => {
    // Test 21: Response with double-serialized materials
    it('T21: should normalize materials with string pbr_diffuse', () => {
      const input = {
        materials: [
          {
            elemento: 'Painel de parede',
            pbr_diffuse: '{"description":"Wood","color_hex":"#8A674A","color_rgb":{"r":138,"g":103,"b":74}}'
          }
        ],
        lightPoints: []
      };
      const result = normalizeVisionResponse(input);
      expect(result.materials[0].pbr_diffuse).toBeTruthy();
      expect(typeof result.materials[0].pbr_diffuse).toBe('object');
      expect(result.materials[0].pbr_diffuse.description).toBe('Wood');
    });

    // Test 22: Response with double-serialized lightPoints
    it('T22: should normalize lightPoints with string color_rgb', () => {
      const input = {
        materials: [],
        lightPoints: [
          {
            type: 'spot',
            color_rgb: '{"r":255,"g":250,"b":242}'
          }
        ]
      };
      const result = normalizeVisionResponse(input);
      expect(result.lightPoints[0].color_rgb).toBeTruthy();
      expect(typeof result.lightPoints[0].color_rgb).toBe('object');
      expect(result.lightPoints[0].color_rgb.r).toBe(255);
    });

    // Test 23: Mixed format (some fields as objects, some as strings)
    it('T23: should normalize mixed format response', () => {
      const input = {
        materials: [
          {
            elemento: 'Material 1',
            pbr_diffuse: { description: 'Already object', color_hex: '#000000' },
            pbr_reflection: '{"intensity":0.5}'
          }
        ],
        lightPoints: []
      };
      const result = normalizeVisionResponse(input);
      expect(typeof result.materials[0].pbr_diffuse).toBe('object');
      expect(typeof result.materials[0].pbr_reflection).toBe('object');
    });

    // Test 24: Response with multiple materials and light points
    it('T24: should normalize response with multiple materials and lights', () => {
      const input = {
        materials: [
          { elemento: 'M1', pbr_diffuse: '{"description":"D1"}' },
          { elemento: 'M2', pbr_diffuse: '{"description":"D2"}' }
        ],
        lightPoints: [
          { type: 'spot', color_rgb: '{"r":255,"g":255,"b":255}' },
          { type: 'rect', color_rgb: '{"r":100,"g":150,"b":200}' }
        ]
      };
      const result = normalizeVisionResponse(input);
      expect(result.materials.length).toBe(2);
      expect(result.lightPoints.length).toBe(2);
      expect(typeof result.materials[0].pbr_diffuse).toBe('object');
      expect(typeof result.lightPoints[0].color_rgb).toBe('object');
    });

    // Test 25: Empty response
    it('T25: should handle empty response', () => {
      const input = { materials: [], lightPoints: [] };
      const result = normalizeVisionResponse(input);
      expect(result.materials).toEqual([]);
      expect(result.lightPoints).toEqual([]);
    });

    // Test 26: Null response
    it('T26: should return null for null response', () => {
      const result = normalizeVisionResponse(null);
      expect(result).toBeNull();
    });

    // Test 27: Response with nested color_rgb in pbr_diffuse
    it('T27: should normalize nested color_rgb in pbr fields', () => {
      const input = {
        materials: [
          {
            elemento: 'Wall',
            pbr_diffuse: '{"description":"Material","color_hex":"#8A674A","color_rgb":{"r":138,"g":103,"b":74}}'
          }
        ],
        lightPoints: []
      };
      const result = normalizeVisionResponse(input);
      const pbr = result.materials[0].pbr_diffuse;
      expect(typeof pbr).toBe('object');
      expect(typeof pbr.color_rgb).toBe('object');
      expect(pbr.color_rgb.r).toBe(138);
    });
  });
});

describe('Diagnostic Summary', () => {
  it('should report changes detected when normalization succeeds', () => {
    const original = {
      materials: [{ pbr_diffuse: '{"description":"test"}' }],
      lightPoints: []
    };
    const normalized = {
      materials: [{ pbr_diffuse: { description: 'test' } }],
      lightPoints: []
    };
    const summary = getDiagnosticSummary(original, normalized);
    expect(summary.materialsProcessed).toBe(1);
    expect(summary.fieldErrors.length).toBe(0);
    expect(summary.changesDetected).toBe(true);
  });
});
