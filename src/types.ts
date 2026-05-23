export interface LeafDetail {
  name: string;
  explanation: string;
  example: string;
  contemplation: string;
}

export interface BranchData {
  name: string;
  leaves: LeafDetail[];
}

export interface BookData {
  id: string;
  title: string;
  author: string;
  cover: string; // e.g., 'sage-green', 'calm-blue', 'warm-amber', 'sunset-orange'
  essence: string;
  mindsetShifts: string[];
  trunk: string;
  branches: BranchData[];
  hasConsciousnessMap: boolean;
  challenges: string[]; // List of 7 challenges (Day 1 to 7)
  quotes: string[]; // Quotes unlocked on completing tasks
}

export interface ConsciousnessLevel {
  level: number;
  name: string;
  emotion: string;
  viewOfLife: string;
  description: string;
  color: string;
}
