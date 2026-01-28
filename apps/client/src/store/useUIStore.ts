
import { create } from 'zustand';

export type DialogChoice = 'SAVE' | 'DISCARD' | 'CANCEL';

interface ConfirmOptions {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'danger';
}

interface UIStore {
  dialog: {
    isOpen: boolean;
    options: ConfirmOptions | null;
    resolve: ((choice: DialogChoice) => void) | null;
  };
  
  // The async method that UI components call
  confirm: (options: ConfirmOptions) => Promise<DialogChoice>;
  
  // Internal methods for the Dialog component
  closeDialog: (choice: DialogChoice) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  dialog: {
    isOpen: false,
    options: null,
    resolve: null,
  },

  confirm: (options) => {
    return new Promise<DialogChoice>((resolve) => {
      set({
        dialog: {
          isOpen: true,
          options,
          resolve,
        },
      });
    });
  },

  closeDialog: (choice) => {
    const { resolve } = get().dialog;
    if (resolve) resolve(choice);
    set({
      dialog: {
        isOpen: false,
        options: null,
        resolve: null,
      },
    });
  },
}));
