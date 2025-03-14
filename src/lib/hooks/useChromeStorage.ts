import { useEffect, useState, useCallback } from "react";
import {
  StorageState,
  getState,
  updateState,
  addStorageListener,
  removeStorageListener,
} from "@/lib/storage/chromeStorage";
import { Idea, AIUsageType, IdeaStatus } from "@/types/idea";

// Hook to access and update the entire state
export const useChromeStorage = () => {
  const [state, setState] = useState<StorageState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadState = async () => {
      const currentState = await getState();
      setState(currentState);
      setIsLoading(false);
    };

    loadState();

    const handleStorageChange = (newState: StorageState) => {
      setState(newState);
    };

    addStorageListener(handleStorageChange);

    return () => {
      removeStorageListener(handleStorageChange);
    };
  }, []);

  const updateStateValue = useCallback(
    async (updater: (state: StorageState) => StorageState) => {
      if (!state) return;
      const newState = await updateState(updater);
      setState(newState);
      return newState;
    },
    [state]
  );

  return { state, updateState: updateStateValue, isLoading };
};

// Hook for ideas-related operations
export const useIdeas = () => {
  const { state, updateState, isLoading } = useChromeStorage();

  const setIdeas = useCallback(
    async (ideas: Idea[], selectedIdeaId?: string) => {
      return updateState((currentState) => {
        let selectedIdea = currentState.selectedIdea;
        
        if (selectedIdeaId) {
          selectedIdea = ideas.find((idea) => idea.id === selectedIdeaId) || null;
        }
        
        return {
          ...currentState,
          ideas,
          selectedIdea,
        };
      });
    },
    [updateState]
  );

  const addIdeas = useCallback(
    async (newIdeas: Idea[], selectedIdeaId?: string) => {
      return updateState((currentState) => {
        // Merge ideas, avoiding duplicates
        const existingIds = new Set(currentState.ideas.map((idea) => idea.id));
        const uniqueNewIdeas = newIdeas.filter((idea) => !existingIds.has(idea.id));
        const allIdeas = [...currentState.ideas, ...uniqueNewIdeas];
        
        let selectedIdea = currentState.selectedIdea;
        if (selectedIdeaId) {
          selectedIdea = allIdeas.find((idea) => idea.id === selectedIdeaId) || selectedIdea;
        }
        
        return {
          ...currentState,
          ideas: allIdeas,
          selectedIdea,
        };
      });
    },
    [updateState]
  );

  const setSelectedIdea = useCallback(
    async (idea: Idea | null) => {
      return updateState((currentState) => ({
        ...currentState,
        selectedIdea: idea,
      }));
    },
    [updateState]
  );

  const updateIdeaStatus = useCallback(
    async (ideaId: string, status: IdeaStatus | "favorite") => {
      return updateState((currentState) => {
        const ideas = currentState.ideas.map((idea) => {
          if (idea.id === ideaId) {
            if (status === "favorite") {
              return { ...idea, isFavorite: !idea.isFavorite };
            }
            return { ...idea, status };
          }
          return idea;
        });

        return {
          ...currentState,
          ideas,
        };
      });
    },
    [updateState]
  );

  const updateIdeaContent = useCallback(
    async (ideaId: string, body: string, title: string, subtitle: string) => {
      return updateState((currentState) => {
        const ideas = currentState.ideas.map((idea) => {
          if (idea.id === ideaId) {
            return { ...idea, body, title, subtitle };
          }
          return idea;
        });

        let selectedIdea = currentState.selectedIdea;
        if (selectedIdea && selectedIdea.id === ideaId) {
          selectedIdea = { ...selectedIdea, body, title, subtitle };
        }

        return {
          ...currentState,
          ideas,
          selectedIdea,
        };
      });
    },
    [updateState]
  );

  return {
    ideas: state?.ideas || [],
    selectedIdea: state?.selectedIdea,
    isLoading,
    setIdeas,
    addIdeas,
    setSelectedIdea,
    updateIdeaStatus,
    updateIdeaContent,
  };
};

// Hook for settings-related operations
export const useSettings = () => {
  const { state, updateState, isLoading } = useChromeStorage();

  const incrementUsage = useCallback(
    async (usageType: AIUsageType) => {
      return updateState((currentState) => {
        const currentUsage = currentState.settings.usage[usageType] || 0;
        
        return {
          ...currentState,
          settings: {
            ...currentState.settings,
            usage: {
              ...currentState.settings.usage,
              [usageType]: currentUsage + 1,
            },
          },
        };
      });
    },
    [updateState]
  );

  return {
    usage: state?.settings.usage || {
      [AIUsageType.IDEA_GENERATION]: 0,
      [AIUsageType.TEXT_ENHANCEMENT]: 0,
      [AIUsageType.TITLE_OR_SUBTITLE_REFINEMENT]: 0,
    },
    isLoading,
    incrementUsage,
  };
};

// Hook for UI-related operations
export const useUI = () => {
  const { state, updateState, isLoading } = useChromeStorage();

  const setShowIdeasPanel = useCallback(
    async (show: boolean) => {
      return updateState((currentState) => ({
        ...currentState,
        ui: {
          ...currentState.ui,
          showIdeasPanel: show,
        },
      }));
    },
    [updateState]
  );

  return {
    showIdeasPanel: state?.ui.showIdeasPanel || false,
    isLoading,
    setShowIdeasPanel,
  };
}; 