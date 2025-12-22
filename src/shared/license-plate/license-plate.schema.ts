import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  PlateType,
  PlateCategory,
  getCategoryForType,
  getDisplayLabel,
  isSingleFieldType,
} from './license-plate.types';

/**
 * Mongoose schema for structured license plate storage
 */
@Schema({ _id: false })
export class LicensePlate {
  @Prop({
    required: true,
    enum: PlateType,
    default: PlateType.TUNIS,
  })
  type: PlateType;

  @Prop({
    required: true,
    enum: PlateCategory,
  })
  category: PlateCategory;

  @Prop({ uppercase: true })
  left?: string;

  @Prop({ uppercase: true })
  right?: string;

  @Prop({ required: true, uppercase: true, index: true })
  formatted: string;
}

export const LicensePlateSchema = SchemaFactory.createForClass(LicensePlate);

/**
 * Format a license plate from its components
 */
export function formatLicensePlate(
  type: PlateType,
  left?: string,
  right?: string,
): string {
  const l = (left || '').trim().toUpperCase();
  const r = (right || '').trim().toUpperCase();
  const label = getDisplayLabel(type);

  // Single field types
  if (isSingleFieldType(type)) {
    if (!l) return '';
    // RS and Libya append label
    if (type === PlateType.RS || type === PlateType.LIBYA) {
      return `${l} ${label}`;
    }
    // EU, Algeria, Other - just the number
    return l;
  }

  // Two field types (Standard, Government, Diplomatic, Consular)
  if (!l && !r) return '';
  if (!l) return `${label} ${r}`;
  if (!r) return `${l} ${label}`;
  return `${l} ${label} ${r}`;
}

/**
 * Create a LicensePlate object from components
 */
export function createLicensePlate(
  type: PlateType,
  left?: string,
  right?: string,
): LicensePlate {
  const plate = new LicensePlate();
  plate.type = type;
  plate.category = getCategoryForType(type);
  plate.left = left?.trim().toUpperCase() || undefined;
  plate.right = right?.trim().toUpperCase() || undefined;
  plate.formatted = formatLicensePlate(type, left, right);
  return plate;
}

/**
 * Parse a formatted license plate string (legacy support)
 * This attempts to detect the plate type from the string content
 */
export function parseLicensePlateString(
  formatted: string,
  suggestedType?: PlateType,
): LicensePlate {
  const normalized = formatted.trim().toUpperCase();

  // Use suggested type if provided
  if (suggestedType) {
    return parseWithType(normalized, suggestedType);
  }

  // Try to detect type from content
  const detectedType = detectPlateType(normalized);
  return parseWithType(normalized, detectedType);
}

/**
 * Detect plate type from formatted string
 */
function detectPlateType(formatted: string): PlateType {
  // Check for known labels
  if (formatted.includes('تونس')) return PlateType.TUNIS;
  if (formatted.includes('ن ت') || formatted.includes('ن.ت'))
    return PlateType.RS;
  if (formatted.includes('ليبيا')) return PlateType.LIBYA;
  if (formatted.includes('الجزائر')) return PlateType.ALGERIA;

  // Diplomatic labels
  if (formatted.includes('ر ب د') || formatted.includes('CMD'))
    return PlateType.CMD;
  if (formatted.includes('س د') || formatted.includes('CD')) return PlateType.CD;
  if (formatted.includes('ب د') || formatted.includes('MD')) return PlateType.MD;
  if (formatted.includes('م ا ف') || formatted.includes('PAT'))
    return PlateType.PAT;

  // Consular labels
  if (formatted.includes('س ق') || formatted.includes('CC')) return PlateType.CC;
  if (formatted.includes('ث ق') || formatted.includes('MC')) return PlateType.MC;

  // Check for EU pattern (letters-numbers-letters)
  if (/^[A-Z]{1,3}[-\s]?\d+[-\s]?[A-Z]{1,3}$/.test(formatted)) {
    return PlateType.EU;
  }

  // Default to Tunis for numeric patterns
  if (/^\d+\s+\d+$/.test(formatted.replace(/[^\d\s]/g, ''))) {
    return PlateType.TUNIS;
  }

  return PlateType.OTHER;
}

/**
 * Parse formatted string with a known type
 */
function parseWithType(formatted: string, type: PlateType): LicensePlate {
  const label = getDisplayLabel(type);
  let left = '';
  let right = '';

  if (isSingleFieldType(type)) {
    // Remove the label if present
    left = formatted.replace(label, '').trim();
  } else {
    // Split by label
    const parts = formatted.split(label).map((p) => p.trim());
    if (parts.length >= 2) {
      left = parts[0].replace(/\s/g, '');
      right = parts[1].replace(/\s/g, '');
    } else if (parts.length === 1) {
      // Just numbers, try to split
      const numbers = parts[0].replace(/\s+/g, ' ').split(' ');
      if (numbers.length >= 2) {
        left = numbers[0];
        right = numbers.slice(1).join('');
      } else {
        left = parts[0];
      }
    }
  }

  return createLicensePlate(type, left, right);
}

/**
 * Normalize a license plate for comparison/querying
 * Returns uppercase formatted string without extra spaces
 */
export function normalizeLicensePlate(plate: LicensePlate | string): string {
  if (typeof plate === 'string') {
    return plate.toUpperCase().replace(/\s+/g, ' ').trim();
  }
  return plate.formatted.toUpperCase().replace(/\s+/g, ' ').trim();
}
