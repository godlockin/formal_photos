export type Step = 'invite' | 'consent' | 'upload' | 'face' | 'analyze' | 'prompt' | 'review' | 'generate' | 'final' | 'download';

export interface Face { x: number; y: number; w: number; h: number; }
export interface Person { race: string; skin: string; gender: string; age: string; features: string[]; }
export interface Prompt { base: string; lighting: string; camera: string; }
export interface Photo { id: string; type: string; url: string; approved: boolean; review: Review; }
export interface Review { score: number; comments: string; approved: boolean; }
