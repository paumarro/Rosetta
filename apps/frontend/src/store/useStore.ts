import { create } from 'zustand';

interface StoreState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

const useStore = create<StoreState>((set) => ({
  // Define your store state and actions here
  count: 0,
  increment: () => {
    set((state) => ({ count: state.count + 1 }));
  },
  decrement: () => {
    set((state) => ({ count: state.count - 1 }));
  },
  reset: () => {
    set({ count: 0 });
  },
}));

export default useStore;
