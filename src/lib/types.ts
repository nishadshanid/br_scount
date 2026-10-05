export const SESSION_TYPES = ['Review', 'Mentoring', 'Lecturing'] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const STATUSES = ['pending', 'done', 'rescheduled', 'cancelled'] as const;
export type Status = (typeof STATUSES)[number];

export const UNASSIGNED = 'Unassigned';

export interface Session {
  id: string;
  source: 'calendar' | 'manual';
  title: string;
  type: SessionType;
  coordinator: string;
  /** true once the user picked the coordinator by hand; sync then leaves it alone */
  coordinatorManual?: boolean;
  scheduledStart: string; // ISO
  scheduledEnd: string; // ISO
  meetLink?: string;
  calendarState: 'active' | 'removed';
  status: Status;
  actualStart?: string;
  actualEnd?: string;
  countOverride?: number;
  note?: string;
  rateSnapshot?: number;
  markedAt?: string;
}

/** One file per month: data/sessions/YYYY-MM.json */
export type MonthFile = Record<string, Session>;

export interface Coordinator {
  name: string;
  /** lower-case emails used to auto-match calendar organizer / guests */
  emails: string[];
}

export interface TypeRule {
  keyword: string;
  type: SessionType;
}

export interface Settings {
  ratePerCount: number;
  tdsPercent: number;
  timezone: string;
  typeRules: TypeRule[];
  coordinators: Coordinator[];
  reminderAfterHours: number;
  /** used for the link in reminder emails */
  appUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  ratePerCount: 300,
  tdsPercent: 10,
  timezone: 'Asia/Kolkata',
  typeRules: [
    { keyword: 'review', type: 'Review' },
    { keyword: 'mentor', type: 'Mentoring' },
    { keyword: 'lectur', type: 'Lecturing' },
  ],
  coordinators: [
    { name: 'Rubeena', emails: [] },
    { name: 'Sajitha', emails: [] },
  ],
  reminderAfterHours: 12,
  appUrl: '',
};

export const SETTINGS_PATH = 'data/settings.json';
export const sessionsPath = (month: string) => `data/sessions/${month}.json`;
