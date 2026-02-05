import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Step, Face, Person, Prompt, Photo } from './types';

interface State {
  step: Step;
  image: string | null;
  faces: Face[];
  selectedFace: number;
  person: Person | null;
  prompt: Prompt | null;
  photos: Photo[];
  inviteCode: string | null;
  inviteType: string | null;

  // actions - 合并所有操作
  setStep: (s: Step) => void;
  setImage: (i: string | null) => void;
  setFaces: (f: Face[]) => void;
  selectFace: (i: number) => void;
  setPerson: (p: Person | null) => void;
  setPrompt: (p: Prompt | null) => void;
  setPhotos: (p: Photo[]) => void;
  updatePhoto: (id: string, approved: boolean, comments: string) => void;
  setInvite: (code: string, type: string) => void;
  reset: () => void;
}

const initial = {
  step: 'invite' as Step,
  image: null,
  faces: [] as Face[],
  selectedFace: 0,
  person: null,
  prompt: null,
  photos: [] as Photo[],
  inviteCode: null,
  inviteType: null,
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...initial,

      setStep: (step) => set({ step }),
      setImage: (image) => set({ image }),
      setFaces: (faces) => set({ faces }),
      selectFace: (i) => set({ selectedFace: i }),
      setPerson: (person) => set({ person }),
      setPrompt: (prompt) => set({ prompt }),
      setPhotos: (photos) => set({ photos }),
      updatePhoto: (id, approved, comments) => set((state) => ({
        photos: state.photos.map((p) =>
          p.id === id ? { ...p, approved, review: { ...p.review, approved, comments } } : p
        ),
      })),
      setInvite: (code, type) => set({ inviteCode: code, inviteType: type }),
      reset: () => set(initial),
    }),
    { name: 'photo-store' }
  )
);
