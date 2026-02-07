export type Step = 'invite' | 'consent' | 'upload' | 'face' | 'analyze' | 'design' | 'prompt' | 'review' | 'generate' | 'final' | 'download';

export type ExpertRole = 'MAKEUP_ARTIST' | 'STYLIST' | 'POSTURE_COACH' | 'LIGHTING_SPEC' | 'PHOTOGRAPHER' | 'DIRECTOR';

export interface ExpertReview {
  expert: ExpertRole;
  score: number;
  comments: string;
  approved: boolean;
}

export interface ReviewResult {
  reviews: ExpertReview[];
  consensusScore: number;
  approved: boolean;
  summary: string;
  suggestions?: string[];
  passRate?: number;
  lockReason?: string;
}

export type Review = ReviewResult;

export interface Face { x: number; y: number; w: number; h: number; }

export interface Person {
  race: string;
  skinTone: string;
  gender: string;
  age: string;
  faceShape: string;
  skinConcerns: string[];
  uniqueFeatures: string[];
  preservationPoints: string[];
  lighting?: string;
  expression?: string;
}

export interface Design {
  makeup: { base: string; eyes: string; lips: string; blush: string };
  styling: { clothing: string; colors: string; accessories: string };
  posture: { standing: string; sitting: string; expression: string };
  lighting: { type: string; position: string; ratio: string };
  photography: { angle: string; lens: string; focus: string };
  director: { overall: string; suggestions: string[] };
}

export interface Prompt {
  prompt: string;
  preservation: string[];
  technical: { camera: string; lens: string; aperture: string; lighting: string };
  style: { mood: string; lightingStyle: string; colorStyle: string };
  type?: string;
}

export interface Photo {
  id: string;
  type: string;
  url: string;
  approved: boolean;
  review: ReviewResult;
}
