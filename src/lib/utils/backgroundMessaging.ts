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
    chrome.runtime.sendMessage(
      { type: "API_REQUEST", action, params },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || "Unknown error"));
        }
      }
    );
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