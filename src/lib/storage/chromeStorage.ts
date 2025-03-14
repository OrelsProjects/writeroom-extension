import { Idea, AIUsageType } from "@/types/idea";

// Define the shape of our storage
export interface StorageState {
  ideas: Idea[];
  selectedIdea: Idea | null;
  settings: {
    usage: {
      [AIUsageType.IDEA_GENERATION]: number;
      [AIUsageType.TEXT_ENHANCEMENT]: number;
      [AIUsageType.TITLE_OR_SUBTITLE_REFINEMENT]: number;
    };
  };
  ui: {
    showIdeasPanel: boolean;
  };
}

// Default state
export const defaultState: StorageState = {
  ideas: [],
  selectedIdea: null,
  settings: {
    usage: {
      [AIUsageType.IDEA_GENERATION]: 0,
      [AIUsageType.TEXT_ENHANCEMENT]: 0,
      [AIUsageType.TITLE_OR_SUBTITLE_REFINEMENT]: 0,
    },
  },
  ui: {
    showIdeasPanel: false,
  },
};

// Get the entire state
export const getState = async (): Promise<StorageState> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(["appState"], (result) => {
      if (result.appState) {
        resolve(result.appState as StorageState);
      } else {
        // Initialize with default state if nothing exists
        chrome.storage.local.set({ appState: defaultState });
        resolve(defaultState);
      }
    });
  });
};

// Set the entire state
export const setState = async (state: StorageState): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ appState: state }, () => {
      resolve();
    });
  });
};

// Update a specific part of the state
export const updateState = async (
  updater: (state: StorageState) => StorageState
): Promise<StorageState> => {
  const currentState = await getState();
  const newState = updater(currentState);
  await setState(newState);
  return newState;
};

// Listen for changes to the storage
export const addStorageListener = (
  callback: (state: StorageState) => void
): void => {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.appState) {
      callback(changes.appState.newValue as StorageState);
    }
  });
};

// Remove a storage listener
export const removeStorageListener = (
  callback: (state: StorageState) => void
): void => {
  chrome.storage.onChanged.removeListener((changes, areaName) => {
    if (areaName === "local" && changes.appState) {
      callback(changes.appState.newValue as StorageState);
    }
  });
}; 