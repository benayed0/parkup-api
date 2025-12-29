export interface SeasonalPeriod {
  name: string; // e.g., "Summer", "Winter", "Ramadan"
  startMonth: number; // 1-12
  startDay: number; // 1-31
  endMonth: number; // 1-12
  endDay: number; // 1-31
  is24h: boolean;
  hoursFrom?: string; // "08:00" (required if !is24h)
  hoursTo?: string; // "20:00" (required if !is24h)
}
