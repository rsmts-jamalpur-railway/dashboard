/**
 * Indian Railways Rolling Stock Asset Classification & Validation Engine
 * Jamalpur Workshop (JMPW) - Eastern Railway
 *
 * Covers:
 * 1. WAGON (11-Digit IR Scheme with 6-step Modulo-10 Check Digit)
 * 2. LOCO (5-Digit IR Locomotive Road Numbers)
 * 3. CRANE (6-Digit Heavy Breakdown Cranes - 140T / 175T)
 * 4. TOWER_CAR (3 to 6 Digits OHE Inspection Cars - 8W-DETC / 4W-DHTC)
 */

export interface AssetCategoryConfig {
  code: 'WAGON' | 'LOCO' | 'CRANE' | 'TOWER_CAR';
  label: string;
  icon: string;
  idLength: number | number[];
  requiresCheckDigit: boolean;
  description: string;
  placeholder: string;
  subtypes: Array<{ code: string; name: string }>;
}

export const ASSET_CATEGORIES: Record<string, AssetCategoryConfig> = {
  WAGON: {
    code: 'WAGON',
    label: 'Freight Wagon',
    icon: '🚃',
    idLength: 11,
    requiresCheckDigit: true,
    description: '11-digit IR standard: Type (2) + Railway (2) + Year (2) + Serial (4) + Check Digit (1)',
    placeholder: 'e.g. 21021845128',
    subtypes: [
      { code: 'BOXNHL', name: 'BOXNHL (Bogie Open High Sided Lightweight)' },
      { code: 'BCNHL', name: 'BCNHL (Bogie Covered High Capacity)' },
      { code: 'BVZI', name: 'BVZI (Bogie Brake Van with Air Brake)' },
      { code: 'BTPN', name: 'BTPN (Bogie Tank Wagon for Petroleum)' },
      { code: 'BOBRN', name: 'BOBRN (Rapid Discharge Bottom Hopper)' },
      { code: 'BOXN', name: 'BOXN (Standard Bogie Open Wagon)' },
      { code: 'BRNA', name: 'BRNA (Bogie Rail / Flat Wagon)' },
      { code: 'BOST', name: 'BOST (Bogie Open Steel Wagon)' },
    ],
  },
  LOCO: {
    code: 'LOCO',
    label: 'Locomotive',
    icon: '🚂',
    idLength: 5,
    requiresCheckDigit: false,
    description: '5-digit IR locomotive road number (e.g. 30215, 31102, 21234)',
    placeholder: 'e.g. 30215',
    subtypes: [
      { code: 'WAP7', name: 'WAP-7 (Passenger 25kV AC Electric, 6000 HP)' },
      { code: 'WAG9', name: 'WAG-9 (Freight 25kV AC Electric, 6120 HP)' },
      { code: 'WAP5', name: 'WAP-5 (High Speed Passenger, 5450 HP)' },
      { code: 'WDG4', name: 'WDG-4 (Heavy Freight Diesel, 4000 HP)' },
      { code: 'WDM3A', name: 'WDM-3A (Mixed Traffic Diesel, 3100 HP)' },
    ],
  },
  CRANE: {
    code: 'CRANE',
    label: 'Breakdown Crane',
    icon: '🏗️',
    idLength: 6,
    requiresCheckDigit: false,
    description: '6-digit Jamalpur 140T / 175T heavy breakdown crane number',
    placeholder: 'e.g. 140012',
    subtypes: [
      { code: '140T_CRANE', name: '140-Tonne Gottwald Breakdown Crane' },
      { code: '140T_COWANS', name: '140-Tonne Cowans Sheldon Crane' },
      { code: '175T_CRANE', name: '175-Tonne Hydraulic Breakdown Crane' },
      { code: '120T_CRANE', name: '120-Tonne Steam / Diesel Crane' },
    ],
  },
  TOWER_CAR: {
    code: 'TOWER_CAR',
    label: 'Tower Car / OHE Car',
    icon: '🗼',
    idLength: [3, 4, 5, 6],
    requiresCheckDigit: false,
    description: '3 to 6 digits OHE maintenance & inspection tower car',
    placeholder: 'e.g. 080012 or 301',
    subtypes: [
      { code: '8W_DETC', name: '8-Wheeler Diesel Electric Tower Car (DETC)' },
      { code: '4W_DHTC', name: '4-Wheeler Diesel Hydraulic Tower Car (DHTC)' },
      { code: 'DETC', name: 'Diesel Electric Inspection Car' },
    ],
  },
};

/**
 * Indian Railways Wagon Type Codes (Digits 1 & 2)
 */
export const IR_WAGON_TYPES: Record<string, string> = {
  '10': 'BOXN (Open High-Sided Wagon)',
  '11': 'BOXNHA (Open High Axle Load Wagon)',
  '12': 'BOXNHS (Open High Speed Wagon)',
  '20': 'BOXNR (Rehabilitated Open Wagon)',
  '21': 'BOXNHL (Bogie Open High Capacity Wagon)',
  '22': 'BOXNLW (Low Tare Weight Open Wagon)',
  '30': 'BCNA (Covered Goods Wagon)',
  '31': 'BCNHL (Covered High Capacity Wagon)',
  '40': 'BTPN (Bogie Tank Wagon - Petroleum)',
  '41': 'BTPGLN (Bogie LPG Tank Wagon)',
  '55': 'BRNA (Bogie Rail / Steel Flat Wagon)',
  '56': 'BRNAHS (High Speed Bogie Flat Wagon)',
  '60': 'BFNS (Steel Coil Flat Wagon)',
  '70': 'BOBRN (Coal Bottom Discharge Hopper)',
  '71': 'BOBRNHL (Rapid Discharge Coal Hopper)',
  '80': 'BOST (Open Heavy Duty Steel Wagon)',
  '85': 'BVZI (8-Wheeler Brake Van)',
  '86': 'BVZC (4-Wheeler Brake Van)',
};

/**
 * Indian Railways Zonal Railway Codes (Digits 3 & 4)
 */
export const IR_ZONAL_RAILWAYS: Record<string, { name: string; hq: string }> = {
  '01': { name: 'Central Railway (CR)', hq: 'Mumbai CST' },
  '02': { name: 'Eastern Railway (ER)', hq: 'Kolkata (Jamalpur Home)' },
  '03': { name: 'Northern Railway (NR)', hq: 'New Delhi' },
  '04': { name: 'North Eastern Railway (NER)', hq: 'Gorakhpur' },
  '05': { name: 'Northeast Frontier Railway (NFR)', hq: 'Maligaon, Guwahati' },
  '06': { name: 'Southern Railway (SR)', hq: 'Chennai' },
  '07': { name: 'South Central Railway (SCR)', hq: 'Secunderabad' },
  '08': { name: 'South Eastern Railway (SER)', hq: 'Kolkata' },
  '09': { name: 'Western Railway (WR)', hq: 'Mumbai Churchgate' },
  '10': { name: 'North Central Railway (NCR)', hq: 'Prayagraj' },
  '11': { name: 'South Western Railway (SWR)', hq: 'Hubballi' },
  '12': { name: 'South East Central Railway (SECR)', hq: 'Bilaspur' },
  '13': { name: 'West Central Railway (WCR)', hq: 'Jabalpur' },
  '14': { name: 'North Western Railway (NWR)', hq: 'Jaipur' },
  '15': { name: 'East Coast Railway (ECoR)', hq: 'Bhubaneswar' },
  '16': { name: 'East Central Railway (ECR)', hq: 'Hajipur' },
  '24': { name: 'Defense / Military (MOD)', hq: 'New Delhi' },
  '25': { name: 'Container Corporation of India (CONCOR)', hq: 'New Delhi' },
  '26': { name: 'Other Private Operators / Port Trusts', hq: 'Pan-India' },
};

export interface WagonBreakdown {
  typeCode: string;
  typeName: string;
  railwayCode: string;
  railwayName: string;
  railwayHq: string;
  yearCode: string;
  manufactureYear: string;
  serialNumber: string;
  enteredCheckDigit: number;
  calculatedCheckDigit: number;
  isValidCheckDigit: boolean;
  raw: string;
}

/**
 * 6-Step Indian Railways Modulo-10 Check Digit Algorithm
 * Source: Indian Railways Board Standard Operating Procedure & PRD Section 7.3
 *
 * 1. S1 = Sum of digits at even positions (2nd, 4th, 6th, 8th, 10th - 1-indexed)
 * 2. Multiply S1 by 3
 * 3. S2 = Sum of digits at odd positions (1st, 3rd, 5th, 7th, 9th - 1-indexed)
 * 4. S4 = (3 * S1) + S2
 * 5. Round S4 up to next multiple of 10
 * 6. Check Digit = (Next multiple of 10) - S4 (If already multiple of 10, Check Digit is 0)
 */
export function calculateIndianRailwaysCheckDigit(firstTenDigits: string): number {
  if (!/^\d{10}$/.test(firstTenDigits)) {
    throw new Error('Check digit requires exactly 10 digits as input.');
  }

  const digits = firstTenDigits.split('').map(Number);

  // Even positions: index 1, 3, 5, 7, 9 (representing 2nd, 4th, 6th, 8th, 10th digits)
  const s1 = digits[1] + digits[3] + digits[5] + digits[7] + digits[9];
  const s1Multiplied = s1 * 3;

  // Odd positions: index 0, 2, 4, 6, 8 (representing 1st, 3rd, 5th, 7th, 9th digits)
  const s2 = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];

  const s4 = s1Multiplied + s2;
  const remainder = s4 % 10;
  const checkDigit = remainder === 0 ? 0 : 10 - remainder;

  return checkDigit;
}

/**
 * Decode and validate an 11-digit Indian Railways Wagon Number
 */
export function decodeWagonNumber(wagonNo: string): WagonBreakdown | null {
  const clean = wagonNo.trim();
  if (!/^\d{11}$/.test(clean)) return null;

  const typeCode = clean.substring(0, 2);
  const railwayCode = clean.substring(2, 4);
  const yearCode = clean.substring(4, 6);
  const serialNumber = clean.substring(6, 10);
  const enteredCheckDigit = parseInt(clean[10], 10);

  const calculatedCheckDigit = calculateIndianRailwaysCheckDigit(clean.substring(0, 10));
  const isValidCheckDigit = enteredCheckDigit === calculatedCheckDigit;

  const typeName = IR_WAGON_TYPES[typeCode] || `Unknown Wagon Type (${typeCode})`;
  const railwayInfo = IR_ZONAL_RAILWAYS[railwayCode] || { name: `Unknown Zone (${railwayCode})`, hq: 'N/A' };

  // Convert 2-digit year to 4-digit
  const yrNum = parseInt(yearCode, 10);
  const fullYear = yrNum <= 50 ? `20${yearCode}` : `19${yearCode}`;

  return {
    typeCode,
    typeName,
    railwayCode,
    railwayName: railwayInfo.name,
    railwayHq: railwayInfo.hq,
    yearCode,
    manufactureYear: fullYear,
    serialNumber,
    enteredCheckDigit,
    calculatedCheckDigit,
    isValidCheckDigit,
    raw: clean,
  };
}

/**
 * Validate any asset number against its category rules
 */
export function validateAssetNumber(
  assetNumber: string,
  categoryCode: 'WAGON' | 'LOCO' | 'CRANE' | 'TOWER_CAR' | string
): {
  isValid: boolean;
  message: string;
  autoFix?: string;
  breakdown?: WagonBreakdown | null;
} {
  const clean = assetNumber.trim().toUpperCase();

  if (!clean) {
    return { isValid: false, message: 'Asset number cannot be empty.' };
  }

  // 1. WAGON
  if (categoryCode === 'WAGON') {
    if (!/^\d+$/.test(clean)) {
      return { isValid: false, message: 'Wagon number must contain only numeric digits.' };
    }

    if (clean.length === 10) {
      const expectedCd = calculateIndianRailwaysCheckDigit(clean);
      return {
        isValid: false,
        message: `Entered 10 digits. Expected Check Digit is ${expectedCd}.`,
        autoFix: `${clean}${expectedCd}`,
      };
    }

    if (clean.length !== 11) {
      return {
        isValid: false,
        message: `Wagon number must be exactly 11 digits (current: ${clean.length} digits).`,
      };
    }

    const breakdown = decodeWagonNumber(clean);
    if (!breakdown) {
      return { isValid: false, message: 'Invalid wagon number format.' };
    }

    if (!breakdown.isValidCheckDigit) {
      const correctNumber = `${clean.substring(0, 10)}${breakdown.calculatedCheckDigit}`;
      return {
        isValid: false,
        message: `Invalid Check Digit: Entered ${breakdown.enteredCheckDigit}, expected ${breakdown.calculatedCheckDigit}.`,
        autoFix: correctNumber,
        breakdown,
      };
    }

    return {
      isValid: true,
      message: `✓ Valid Indian Railways 11-Digit Wagon (${breakdown.typeName.split(' ')[0]} | ${breakdown.railwayName.split(' ')[0]})`,
      breakdown,
    };
  }

  // 2. LOCO
  if (categoryCode === 'LOCO') {
    if (!/^\d+$/.test(clean)) {
      return { isValid: false, message: 'Locomotive road number must contain only numeric digits.' };
    }
    if (clean.length !== 5) {
      return {
        isValid: false,
        message: `Locomotive road number must be exactly 5 digits (current: ${clean.length}).`,
      };
    }
    return { isValid: true, message: `✓ Valid 5-Digit IR Locomotive Road Number (#${clean})` };
  }

  // 3. CRANE
  if (categoryCode === 'CRANE') {
    if (!/^\d+$/.test(clean)) {
      return { isValid: false, message: 'Crane identification number must contain only digits.' };
    }
    if (clean.length !== 6) {
      return {
        isValid: false,
        message: `Jamalpur Breakdown Crane number must be exactly 6 digits (current: ${clean.length}).`,
      };
    }
    return { isValid: true, message: `✓ Valid 6-Digit Breakdown Crane Number (#${clean})` };
  }

  // 4. TOWER_CAR
  if (categoryCode === 'TOWER_CAR') {
    if (clean.length < 3 || clean.length > 8) {
      return {
        isValid: false,
        message: 'Tower car number should be between 3 and 8 characters.',
      };
    }
    return { isValid: true, message: `✓ Valid Tower Car Asset ID (${clean})` };
  }

  // Generic fallback
  return { isValid: true, message: 'Format accepted.' };
}

/**
 * Detect the likely category of an asset number based on its format
 */
export function detectAssetCategory(assetNumber: string): 'WAGON' | 'LOCO' | 'CRANE' | 'TOWER_CAR' | 'UNKNOWN' {
  const clean = assetNumber.trim();
  if (/^\d{11}$/.test(clean)) return 'WAGON';
  if (/^\d{5}$/.test(clean)) return 'LOCO';
  if (/^\d{6}$/.test(clean)) {
    // 140xxx or 175xxx are typically cranes
    if (clean.startsWith('140') || clean.startsWith('175') || clean.startsWith('120')) return 'CRANE';
    // 080xxx or similar often tower cars
    if (clean.startsWith('08') || clean.startsWith('04')) return 'TOWER_CAR';
    return 'CRANE';
  }
  if (/^\d{3}$/.test(clean) || clean.includes('DETC') || clean.includes('DHTC') || clean.includes('TC')) return 'TOWER_CAR';
  return 'UNKNOWN';
}
