/**
 * Utility functions for communicating with the background script
 */

/**
 * Send a message to the background script and get a response
 * 
 * @param action The API action to call in the background script
 * @param params Optional parameters to pass to the action
 * @returns A promise that resolves with the response data
 */
export const sendMessageToBackground = <T>(action: string, params?: unknown[]): Promise<T> => {
  return new Promise((resolve, reject) => {
    try {
      // Check if runtime is available first
      if (!chrome.runtime) {
        reject(new Error("Extension context invalidated. Please refresh the page."));
        return;
      }
      
      chrome.runtime.sendMessage(
        { type: "API_REQUEST", action, params },
        (response) => {
          if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message || "Unknown error";
            
            // Special handling for context invalidated errors
            if (errorMessage.includes("Extension context invalidated") || 
                errorMessage.includes("context invalid")) {
              reject(new Error("Extension context invalidated. Please refresh the page."));
            } else {
              reject(new Error(errorMessage));
            }
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || "Unknown error"));
          }
        }
      );
    } catch (error) {
      // Catch any synchronous errors from chrome.runtime call
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Extension context") || !chrome.runtime) {
        reject(new Error("Extension context invalidated. Please refresh the page."));
      } else {
        reject(error);
      }
    }
  });
};

/**
 * API actions available in the background script
 */
export const BackgroundActions = {
  UPDATE_IDEA_STATUS: 'updateIdeaStatus',
  UPDATE_IDEA_CONTENT: 'updateIdeaContent',
  GENERATE_IDEAS: 'generateIdeas',
  IMPROVE_TEXT: 'improveText',
  IMPROVE_TITLE: 'improveTitle',
  CREATE_NEW_IDEA: 'createNewIdea',
  CREATE_SUBSTACK_POST: 'createSubstackPost',
  GET_SCHEDULED_POSTS: 'getScheduledPosts',
} as const;

/**
 * Type for background actions
 */
export type BackgroundAction = typeof BackgroundActions[keyof typeof BackgroundActions];

/**
 * Check if the extension is in development mode
 * This is useful for debugging
 * 
 * In a Chrome extension, we can detect development mode by checking
 * if the extension is loaded unpacked (has no update URL)
 */
export const isDevelopment = (): boolean => {
  return !chrome.runtime.getManifest().update_url;
};

/**
 * Log a message only in development mode
 */
export const debugLog = (message: string, ...args: any[]): void => {
  if (isDevelopment()) {
    console.log(`[Extension Debug] ${message}`, ...args);
  }
};

/**
 * Create a post on Substack with the given message
 * 
 * @param message The message to post on Substack
 * @param scheduleSeconds Optional number of seconds to delay the post
 * @param autoCloseTab Optional boolean to control whether the tab should be closed after posting
 * @returns A promise that resolves when the post is created or scheduled
 */
export const createSubstackPost = async (
  message: string = "This is a test that was posted automatically with WriteStack Chrome extension.",
  scheduleSeconds: number = 0,
  autoCloseTab: boolean = true
): Promise<any> => {
  try {
    debugLog('Creating Substack post', { message, scheduleSeconds, autoCloseTab });
    return await sendMessageToBackground(BackgroundActions.CREATE_SUBSTACK_POST, [message, scheduleSeconds, autoCloseTab]);
  } catch (error) {
    debugLog('Error creating Substack post', error);
    // Format the response to match the expected structure even in error case
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Get all scheduled posts
 * 
 * @returns A promise that resolves with the list of scheduled posts
 */
export const getScheduledPosts = async (): Promise<any> => {
  try {
    debugLog('Getting scheduled posts');
    return await sendMessageToBackground(BackgroundActions.GET_SCHEDULED_POSTS);
  } catch (error) {
    debugLog('Error getting scheduled posts', error);
    // Format the response to match the expected structure even in error case
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
      posts: [] // Return empty posts array to prevent UI errors
    };
  }
}; 