import { AIUsageType, IdeaStatus } from "@/types/idea";
import { Idea } from "@/types/idea";
import { useCallback } from "react";
import { useIdeas } from "./useChromeStorage";
import { useSettings } from "./useChromeStorage";
import { useUI } from "./useChromeStorage";
import { 
  sendMessageToBackground, 
  BackgroundActions,
  debugLog
} from "@/lib/utils/backgroundMessaging";

export const useIdea = () => {
  const {
    ideas,
    selectedIdea,
    setIdeas,
    addIdeas,
    setSelectedIdea: setSelectedIdeaInStorage,
    updateIdeaStatus,
    updateIdeaContent,
  } = useIdeas();

  const { incrementUsage } = useSettings();
  const { setShowIdeasPanel } = useUI();

  // Store the last used idea ID in Chrome storage
  const setLastUsedIdea = useCallback(async (ideaId: string | null) => {
    chrome.storage.local.set({ lastUsedIdea: ideaId });
  }, []);

  // Get the last used idea ID from Chrome storage
  const getLastUsedIdea = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      chrome.storage.local.get(["lastUsedIdea"], (result) => {
        resolve(result.lastUsedIdea || null);
      });
    });
  }, []);

  const updateStatus = async (
    ideaId: string,
    status: IdeaStatus | "favorite"
  ) => {
    let newStatus = status;
    let didReplaceSelectedIdea = false;
    const idea = ideas.find((idea) => idea.id === ideaId);
    if (!idea) {
      throw new Error("Idea not found");
    }
    if (idea.status === status) {
      newStatus = IdeaStatus.NEW;
    }

    // optimistic update
    await updateIdeaStatus(ideaId, newStatus);

    if (status === "archived" && selectedIdea?.id === ideaId) {
      didReplaceSelectedIdea = true;
      // Select next idea in the list
      const nextIdea = ideas.find(
        (idea) => idea.status !== "archived" && idea.id !== ideaId
      );
      if (nextIdea) {
        await setSelectedIdeaInStorage(nextIdea);
      } else {
        await setSelectedIdeaInStorage(null);
      }
    } else {
      if (!selectedIdea) {
        await setSelectedIdeaInStorage(idea);
      }
    }

    try {
      // Call the background script to update the status
      debugLog('Updating idea status', { ideaId, status: newStatus });
      await sendMessageToBackground(BackgroundActions.UPDATE_IDEA_STATUS, [ideaId, newStatus]);
    } catch (error: any) {
      debugLog('Error updating idea status', error);
      // revert optimistic update
      await updateIdeaStatus(ideaId, idea.status as IdeaStatus | "favorite");
      if (didReplaceSelectedIdea) {
        await setSelectedIdeaInStorage(idea);
      }
      throw error;
    }
  };

  const updateIdea = async (
    ideaId: string,
    body: string,
    title: string,
    subtitle: string
  ) => {
    const idea = ideas.find((idea) => idea.id === ideaId);
    if (!idea) {
      throw new Error("Idea not found");
    }

    // optimistic update
    await updateIdeaContent(ideaId, body, title, subtitle);

    try {
      // Call the background script to update the idea
      debugLog('Updating idea content', { ideaId, title });
      await sendMessageToBackground(BackgroundActions.UPDATE_IDEA_CONTENT, [ideaId, body, title, subtitle]);
    } catch (error: any) {
      debugLog('Error updating idea content', error);
      // undo optimistic update
      await updateIdeaContent(ideaId, idea.body, idea.title, idea.subtitle);
      throw error;
    }
  };

  const setSelectedIdea = async (idea: Idea) => {
    await setSelectedIdeaInStorage(idea);
    await setLastUsedIdea(idea.id);
  };

  const generateIdeas = async (
    options: { topic?: string; ideasCount?: number; shouldSearch?: boolean } = {
      shouldSearch: false,
    }
  ): Promise<Idea[]> => {
    try {
      // Call the background script to generate ideas
      debugLog('Generating ideas', options);
      const data = await sendMessageToBackground<Idea[]>(BackgroundActions.GENERATE_IDEAS, [
        options.topic || "",
        options.ideasCount || 3,
        options.shouldSearch || false
      ]);

      await addIdeas(data);
      await incrementUsage(AIUsageType.IDEA_GENERATION);
      return data;
    } catch (error: any) {
      debugLog('Error generating ideas', error);
      throw error;
    }
  };

  const improveText = async (
    text: string,
    type: string,
    textFrom: number,
    textTo: number,
    ideaId: string
  ): Promise<{ text: string; textFrom: number; textTo: number } | null> => {
    try {
      // Call the background script to improve text
      debugLog('Improving text', { type, ideaId });
      const data = await sendMessageToBackground<string>(BackgroundActions.IMPROVE_TEXT, [text, type, ideaId]);
      
      await incrementUsage(AIUsageType.TEXT_ENHANCEMENT);
      
      return data
        ? {
            text: data,
            textFrom,
            textTo,
          }
        : null;
    } catch (error: any) {
      debugLog('Error improving text', error);
      throw error;
    }
  };

  const improveTitle = async (
    menuType: "title" | "subtitle",
    improveType: string,
    ideaId: string,
    value: string
  ): Promise<{ title: string; subtitle: string }> => {
    try {
      // Call the background script to improve title
      debugLog('Improving title', { menuType, improveType, ideaId });
      const data = await sendMessageToBackground<{ title: string; subtitle: string }>(
        BackgroundActions.IMPROVE_TITLE, 
        [menuType, improveType, ideaId, value]
      );
      
      if (!data || (!data.title && !data.subtitle)) {
        throw new Error("Improvement service failed.");
      }
      
      await incrementUsage(AIUsageType.TITLE_OR_SUBTITLE_REFINEMENT);
      return data;
    } catch (error: any) {
      debugLog('Error improving title', error);
      throw error;
    }
  };

  const createNewIdea = async (options?: { showIdeasAfterCreate: boolean }) => {
    try {
      // Call the background script to create a new idea
      debugLog('Creating new idea');
      const data = await sendMessageToBackground<Idea>(BackgroundActions.CREATE_NEW_IDEA);
      
      await addIdeas([data]);
      await setSelectedIdea(data);
      await setLastUsedIdea(data.id);

      if (options?.showIdeasAfterCreate) {
        await setShowIdeasPanel(true);
      }
      return data;
    } catch (error: any) {
      debugLog('Error creating new idea', error);
      throw error;
    }
  };

  return {
    ideas,
    selectedIdea,
    updateStatus,
    updateIdea,
    setSelectedIdea,
    generateIdeas,
    setIdeas,
    addIdeas,
    improveText,
    improveTitle,
    createNewIdea,
  };
};
