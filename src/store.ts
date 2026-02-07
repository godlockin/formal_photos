import { create } from 'zustand';
import type { Person, Design, Prompt, Photo, ReviewResult } from './types';

export type WorkflowStep = 'consent' | 'upload' | 'processing' | 'result';

interface WorkflowState {
    step: WorkflowStep;
    image: string | null;
    person: Person | null;
    design: Design | null;
    prompt: Prompt | null;
    photos: Photo[];
    currentAction: string;
    progress: number;
    error: string | null;
    retryCount: number;
    isProcessing: boolean;
    currentReview: ReviewResult | null;
    setStep: (step: WorkflowStep) => void;
    setImage: (image: string) => void;
    setPerson: (person: Person) => void;
    setDesign: (design: Design) => void;
    setPrompt: (prompt: Prompt) => void;
    addPhoto: (photo: Photo) => void;
    setPhotos: (photos: Photo[]) => void;
    setCurrentAction: (action: string) => void;
    setProgress: (progress: number) => void;
    setError: (error: string | null) => void;
    incrementRetry: () => void;
    resetRetry: () => void;
    setProcessing: (processing: boolean) => void;
    setCurrentReview: (review: ReviewResult | null) => void;
    reset: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
    step: 'consent',
    image: null,
    person: null,
    design: null,
    prompt: null,
    photos: [],
    currentAction: '',
    progress: 0,
    error: null,
    retryCount: 0,
    isProcessing: false,
    currentReview: null,

    setStep: (step) => set({ step }),
    setImage: (image) => set({ image }),
    setPerson: (person) => set({ person }),
    setDesign: (design) => set({ design }),
    setPrompt: (prompt) => set({ prompt }),
    addPhoto: (photo) => set((state) => ({ photos: [...state.photos, photo] })),
    setPhotos: (photos) => set({ photos }),
    setCurrentAction: (currentAction) => set({ currentAction }),
    setProgress: (progress) => set({ progress }),
    setError: (error) => set({ error }),
    incrementRetry: () => set((state) => ({ retryCount: state.retryCount + 1 })),
    resetRetry: () => set({ retryCount: 0 }),
    setProcessing: (isProcessing) => set({ isProcessing }),
    setCurrentReview: (currentReview) => set({ currentReview }),

    reset: () => set({
        step: 'consent',
        image: null,
        person: null,
        design: null,
        prompt: null,
        photos: [],
        currentAction: '',
        progress: 0,
        error: null,
        retryCount: 0,
        isProcessing: false,
        currentReview: null,
    }),
}));

interface ReviewState {
    currentReview: ReviewResult | null;
    setCurrentReview: (review: ReviewResult | null) => void;
    clearReview: () => void;
}

export const useReviewStore = create<ReviewState>((set) => ({
    currentReview: null,
    setCurrentReview: (currentReview) => set({ currentReview }),
    clearReview: () => set({ currentReview: null }),
}));
