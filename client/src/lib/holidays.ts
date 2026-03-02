interface Holiday {
  date: Date;
  name: string;
  state?: string;
}

function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getNationalHolidays(year: number): Holiday[] {
  const easterSunday = easter(year);
  const holidays: Holiday[] = [
    { date: new Date(year, 0, 1), name: "New Year's Day" },
    { date: new Date(year, 0, 26), name: "Australia Day" },
    { date: addDays(easterSunday, -2), name: "Good Friday" },
    { date: addDays(easterSunday, -1), name: "Easter Saturday" },
    { date: addDays(easterSunday, 1), name: "Easter Monday" },
    { date: new Date(year, 3, 25), name: "Anzac Day" },
    { date: getSecondMonday(year, 5), name: "Queen's Birthday" },
    { date: new Date(year, 11, 25), name: "Christmas Day" },
    { date: new Date(year, 11, 26), name: "Boxing Day" },
  ];
  return holidays;
}

function getSecondMonday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dayOfWeek = first.getDay();
  const firstMonday = dayOfWeek <= 1 ? 1 + (1 - dayOfWeek) : 1 + (8 - dayOfWeek);
  return new Date(year, month, firstMonday + 7);
}

function getFirstTuesday(year: number, month: number, afterDay: number): Date {
  const d = new Date(year, month, afterDay);
  while (d.getDay() !== 2) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function getLastFridayBefore(year: number, month: number, day: number): Date {
  const d = new Date(year, month, day);
  d.setDate(d.getDate() - 1);
  while (d.getDay() !== 5) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function getVictoriaHolidays(year: number): Holiday[] {
  return [
    { date: getFirstTuesday(year, 10, 1), name: "Melbourne Cup Day", state: "VIC" },
    { date: getLastFridayBefore(year, 8, 25), name: "AFL Grand Final Friday", state: "VIC" },
  ];
}

function getStateHolidays(year: number, state: string): Holiday[] {
  switch (state) {
    case "VIC":
      return getVictoriaHolidays(year);
    default:
      return [];
  }
}

function getAllHolidays(year: number, state: string = "VIC"): Holiday[] {
  return [...getNationalHolidays(year), ...getStateHolidays(year, state)];
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

export function getHolidaysInWeek(weekStart: Date, state: string = "VIC"): Holiday[] {
  const year = weekStart.getFullYear();
  const allHolidays = [...getAllHolidays(year, state), ...getAllHolidays(year + 1, state)];
  const result: Holiday[] = [];
  for (let i = 0; i < 5; i++) {
    const day = addDays(weekStart, i);
    if (!isWeekday(day)) continue;
    for (const h of allHolidays) {
      if (isSameDate(day, h.date)) {
        result.push(h);
      }
    }
  }
  return result;
}

export function getMaxAllocation(weekStart: Date, state: string = "VIC"): number {
  const holidays = getHolidaysInWeek(weekStart, state);
  if (holidays.length === 0) return 100;
  const workDays = 5;
  const availableDays = workDays - holidays.length;
  return Math.round((availableDays / workDays) * 100);
}

export function hasHolidayInWeek(weekStart: Date, state: string = "VIC"): boolean {
  return getHolidaysInWeek(weekStart, state).length > 0;
}

export const STATES = [
  { value: "VIC", label: "Victoria" },
  { value: "NSW", label: "NSW (national only)" },
  { value: "QLD", label: "QLD (national only)" },
  { value: "SA", label: "SA (national only)" },
  { value: "WA", label: "WA (national only)" },
  { value: "TAS", label: "TAS (national only)" },
  { value: "ACT", label: "ACT (national only)" },
  { value: "NT", label: "NT (national only)" },
] as const;
