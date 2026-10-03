export type Role = "dean" | "checker" | "student";
export type CheckStatus = "verified" | "photo_review" | "pending" | "absent";

export interface Student {
  id: string;
  name: string;
  email: string;
  age: number;
  grade: string;
  nationality: string;
  room: string;
  floor: string;
  initials: string;
  status: CheckStatus;
}

export interface Room {
  id: string;
  number: string;
  hall: string;
  floor: string;
  capacity: number;
  checker: string;
  students: string[];
}

export interface CheckSession {
  id: string;
  name: string;
  time: string;
  days: string;
  enabled: boolean;
}
