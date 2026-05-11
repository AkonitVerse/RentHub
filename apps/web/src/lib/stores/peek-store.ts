import { create } from 'zustand';

interface PeekState {
  /** Тип сущности и id, либо null. */
  peek: { type: 'order' | 'client'; id: number } | null;
  open: (peek: { type: 'order' | 'client'; id: number }) => void;
  close: () => void;
}

/**
 * Глобальное состояние split-view peek-панели.
 * Не persist — peek сбрасывается при перезагрузке страницы.
 */
export const usePeekStore = create<PeekState>((set) => ({
  peek: null,
  open: (peek) => set({ peek }),
  close: () => set({ peek: null }),
}));
