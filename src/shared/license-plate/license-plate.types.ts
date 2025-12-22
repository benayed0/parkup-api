/**
 * License plate type enumeration
 * Matches the Flutter LicensePlate model
 */
export enum PlateType {
  // Regular Series (Tunisian)
  TUNIS = 'tunis',
  RS = 'rs', // Régime Suspensif

  // Government Series
  GOVERNMENT = 'government',

  // Foreign plates
  LIBYA = 'libya',
  ALGERIA = 'algeria',
  EU = 'eu',
  OTHER = 'other',

  // Diplomatic Series
  CMD = 'cmd', // Chef Mission Diplomatique
  CD = 'cd', // Corps Diplomatique
  MD = 'md', // Mission Diplomatique
  PAT = 'pat', // Personnel Administratif et Technique

  // Consular Series
  CC = 'cc', // Corps Consulaire
  MC = 'mc', // Mission Consulaire
}

/**
 * Plate category for visual styling
 */
export enum PlateCategory {
  REGULAR = 'regular',
  GOVERNMENT = 'government',
  DIPLOMATIC = 'diplomatic',
  CONSULAR = 'consular',
  EU = 'eu',
  LIBYA = 'libya',
  ALGERIA = 'algeria',
  OTHER = 'other',
}

/**
 * Structured license plate interface
 */
export interface ILicensePlate {
  type: PlateType;
  category: PlateCategory;
  left?: string;
  right?: string;
  formatted: string;
}

/**
 * Get category for a plate type
 */
export function getCategoryForType(type: PlateType): PlateCategory {
  switch (type) {
    case PlateType.TUNIS:
    case PlateType.RS:
      return PlateCategory.REGULAR;
    case PlateType.GOVERNMENT:
      return PlateCategory.GOVERNMENT;
    case PlateType.CMD:
    case PlateType.CD:
    case PlateType.MD:
    case PlateType.PAT:
      return PlateCategory.DIPLOMATIC;
    case PlateType.CC:
    case PlateType.MC:
      return PlateCategory.CONSULAR;
    case PlateType.EU:
      return PlateCategory.EU;
    case PlateType.LIBYA:
      return PlateCategory.LIBYA;
    case PlateType.ALGERIA:
      return PlateCategory.ALGERIA;
    case PlateType.OTHER:
      return PlateCategory.OTHER;
    default:
      return PlateCategory.REGULAR;
  }
}

/**
 * Get display label for a plate type
 */
export function getDisplayLabel(type: PlateType): string {
  const labels: Record<PlateType, string> = {
    [PlateType.TUNIS]: 'تونس',
    [PlateType.RS]: 'ن ت',
    [PlateType.GOVERNMENT]: '-',
    [PlateType.LIBYA]: 'ليبيا',
    [PlateType.ALGERIA]: 'الجزائر',
    [PlateType.EU]: 'EU',
    [PlateType.OTHER]: 'Autre',
    [PlateType.CMD]: 'ر ب د',
    [PlateType.CD]: 'س د',
    [PlateType.MD]: 'ب د',
    [PlateType.PAT]: 'م ا ف',
    [PlateType.CC]: 'س ق',
    [PlateType.MC]: 'ث ق',
  };
  return labels[type] || type;
}

/**
 * Check if plate type uses single field (left only)
 */
export function isSingleFieldType(type: PlateType): boolean {
  return [
    PlateType.RS,
    PlateType.EU,
    PlateType.LIBYA,
    PlateType.ALGERIA,
    PlateType.OTHER,
  ].includes(type);
}
