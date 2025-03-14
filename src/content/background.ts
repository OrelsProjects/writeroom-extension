// background.ts
import { getState } from '../lib/storage/chromeStorage';
import { IdeaStatus } from '@/types/idea';

// Base URL for API requests
const API_BASE_URL = 'http://localhost:3000';

async function makeAuthenticatedRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include", // Include cookies automatically
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

// Define API handler types
type ApiHandlers = {
  updateIdeaStatus: (ideaId: string, status: IdeaStatus | "favorite") => Promise<any>;
  updateIdeaContent: (ideaId: string, body: string, title: string, subtitle: string) => Promise<any>;
  generateIdeas: (topic?: string, ideasCount?: number, shouldSearch?: boolean) => Promise<any>;
  improveText: (text: string, type: string, ideaId: string) => Promise<any>;
  improveTitle: (menuType: "title" | "subtitle", improveType: string, ideaId: string, value: string) => Promise<any>;
  createNewIdea: () => Promise<any>;
  generateIdeasTest: () => Promise<any>;
  createSubstackPost: (message?: string) => Promise<any>;
};

// API request handlers
const apiHandlers: ApiHandlers = {
  // Idea status update
  updateIdeaStatus: async (ideaId: string, status: IdeaStatus | "favorite") => {
    const searchParamsStatus = status === "favorite" ? "isFavorite=true" : `status=${status}`;
    return makeAuthenticatedRequest(`/api/idea/${ideaId}/status?${searchParamsStatus}`, {
      method: 'PATCH'
    });
  },

  // Idea content update
  updateIdeaContent: async (ideaId: string, body: string, title: string, subtitle: string) => {
    return makeAuthenticatedRequest(`/api/idea/${ideaId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        body,
        title,
        subtitle,
      })
    });
  },

  // Generate ideas
  generateIdeas: async (topic: string = "", ideasCount: number = 3, shouldSearch: boolean = false) => {
    return makeAuthenticatedRequest(
      `/api/post/generate/ideas?topic=${topic}&ideasCount=${ideasCount}&shouldSearch=${shouldSearch}`
    );
  },

  // Improve text
  improveText: async (text: string, type: string, ideaId: string) => {
    return makeAuthenticatedRequest("/api/post/improve", {
      method: 'POST',
      body: JSON.stringify({
        text,
        type,
        ideaId,
      })
    });
  },

  // Improve title or subtitle
  improveTitle: async (menuType: "title" | "subtitle", improveType: string, ideaId: string, value: string) => {
    return makeAuthenticatedRequest("/api/post/improve/title", {
      method: 'POST',
      body: JSON.stringify({
        menuType,
        improveType,
        ideaId,
        value,
      })
    });
  },

  // Create new idea
  createNewIdea: async () => {
    return makeAuthenticatedRequest("/api/idea", {
      method: 'POST'
    });
  },

  // Test idea generation (legacy handler)
  generateIdeasTest: async () => {
    return makeAuthenticatedRequest("/api/post/generate/ideas-test");
  },

  // Create a post on Substack
  createSubstackPost: async (message: string = "This is a test that was posted automatically with WriteRoom Chrome extension.") => {
    try {
      // First, check if we have the necessary permissions
      const hasPermissions = await checkSubstackPermissions();
      if (!hasPermissions) {
        throw new Error("Missing permissions to access Substack");
      }

      // Find or create a tab with Substack
      const tab = await openSubstackTab();
      if (!tab || !tab.id) {
        throw new Error("Failed to open Substack tab");
      }

      // Wait for the page to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Execute script to create a post
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: createPost,
        args: [message]
      });

      return { success: true, message: "Post created successfully", result };
    } catch (error) {
      console.error("Error creating Substack post:", error);
      return { success: false, error: error.message };
    }
  }
};

// Helper function to check if we have the necessary permissions
async function checkSubstackPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains({
      origins: ["https://*.substack.com/*"]
    }, (result) => {
      if (result) {
        resolve(true);
      } else {
        // Request permissions if we don't have them
        chrome.permissions.request({
          origins: ["https://*.substack.com/*"]
        }, (granted) => {
          resolve(granted);
        });
      }
    });
  });
}

// Helper function to open a Substack tab
async function openSubstackTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve) => {
    // First, check if we already have a Substack tab open
    chrome.tabs.query({ url: "https://*.substack.com/*" }, (tabs) => {
      if (tabs.length > 0) {
        // If we have a tab, activate it
        chrome.tabs.update(tabs[0].id!, { active: true }, (tab) => {
          resolve(tab!);
        });
      } else {
        // Otherwise, create a new tab
        chrome.tabs.create({ url: "https://substack.com" }, (tab) => {
          resolve(tab);
        });
      }
    });
  });
}

// Function to be injected into the Substack page
function createPost(message: string): { success: boolean, error?: string } {
  try {
    // Step 2: Click on the composer div to open it
    const composerSelector = 'div.pencraft.pc-display-flex.pc-gap-12.pc-padding-16.pc-alignItems-center.pc-boxShadow-xs.pc-reset.bg-primary-zk6FDl.animate-XFJxE4.cursor-pointer-LYORKw.userSelect-none-oDUy26.border-detail-EGrm7T.pc-borderRadius-md.inlineComposer-v8PLSi';
    const composerDiv = document.querySelector(composerSelector);
    
    if (!composerDiv) {
      // If we can't find the composer, try to navigate to the home page
      if (!window.location.href.includes('substack.com')) {
        window.location.href = 'https://substack.com';
        return { success: false, error: "Navigating to Substack home page" };
      }
      return { success: false, error: "Composer div not found" };
    }
    
    // Click the composer to open it
    (composerDiv as HTMLElement).click();
    
    // Wait for the editor to appear
    setTimeout(() => {
      // Step 3: Fill the editor with our message
      const editorSelector = 'div.tiptap.ProseMirror.feedCommentBodyInner-AOzMIC';
      const editor = document.querySelector(editorSelector);
      
      if (!editor) {
        console.error("Editor not found");
        return;
      }
      
      // Set the content
      editor.innerHTML = `<p>${message}</p>`;
      
      // Dispatch input event to trigger any listeners
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Wait a moment before clicking post
      setTimeout(() => {
        // Step 4: Click the Post button
        const postButtonSelector = 'button.pencraft.pc-reset.pencraft.buttonBase-GK1x3M.button-iUdbkg.buttonNew-KfJF0Q.button2-bH8fBu.priority_primary-RfbeYt.size_md-gCDS3o';
        const postButton = document.querySelector(postButtonSelector);
        
        if (!postButton) {
          console.error("Post button not found");
          return;
        }
        
        // Click the post button
        (postButton as HTMLElement).click();
        
        console.log("Post created successfully");
      }, 1000);
    }, 1000);
    
    return { success: true };
  } catch (error) {
    console.error("Error in createPost:", error);
    return { success: false, error: error.toString() };
  }
}

// Define message types
interface ApiRequestMessage {
  type: "API_REQUEST";
  action: keyof ApiHandlers;
  params?: unknown[];
}

interface GenerateIdeasMessage {
  type: "GENERATE_IDEAS";
}

type ChromeMessage = ApiRequestMessage | GenerateIdeasMessage;

// Helper function to safely call API handlers with dynamic parameters
function callApiHandler(action: keyof ApiHandlers, params: unknown[] = []): Promise<any> {
  switch (action) {
    case 'updateIdeaStatus':
      return apiHandlers.updateIdeaStatus(
        params[0] as string, 
        params[1] as IdeaStatus | "favorite"
      );
    case 'updateIdeaContent':
      return apiHandlers.updateIdeaContent(
        params[0] as string,
        params[1] as string,
        params[2] as string,
        params[3] as string
      );
    case 'generateIdeas':
      return apiHandlers.generateIdeas(
        params[0] as string | undefined,
        params[1] as number | undefined,
        params[2] as boolean | undefined
      );
    case 'improveText':
      return apiHandlers.improveText(
        params[0] as string,
        params[1] as string,
        params[2] as string
      );
    case 'improveTitle':
      return apiHandlers.improveTitle(
        params[0] as "title" | "subtitle",
        params[1] as string,
        params[2] as string,
        params[3] as string
      );
    case 'createNewIdea':
      return apiHandlers.createNewIdea();
    case 'generateIdeasTest':
      return apiHandlers.generateIdeasTest();
    case 'createSubstackPost':
      return apiHandlers.createSubstackPost(params[0] as string | undefined);
    default:
      return Promise.reject(new Error(`Unknown action: ${action}`));
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request: ChromeMessage, sender, sendResponse) => {
  console.log("Background script received message:", request);

  // Handle API requests
  if (request.type === "API_REQUEST") {
    const { action, params } = request;
    
    if (action) {
      callApiHandler(action, params)
        .then((data: any) => {
          sendResponse({ success: true, data });
        })
        .catch((error: Error) => {
          console.error(`Error in API request (${action}):`, error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Will respond asynchronously
    }
  }
  
  // Legacy handler for backward compatibility
  if (request.type === "GENERATE_IDEAS") {
    apiHandlers.generateIdeasTest()
      .then((data: any) => {
        sendResponse({ success: true, data });
      })
      .catch((error: Error) => {
        console.error("Error generating ideas:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond asynchronously
  }
});

export { makeAuthenticatedRequest };
