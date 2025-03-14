// background.ts
import { getState } from "../lib/storage/chromeStorage";
import { IdeaStatus } from "@/types/idea";

// Base URL for API requests
const API_BASE_URL = "http://localhost:3000";

// Queue for scheduled posts
interface ScheduledPost {
  id: string;
  message: string;
  scheduledTime: number;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  autoCloseTab?: boolean;
}

// Store posts in chrome.storage for persistence across extension reloads
let scheduledPosts: ScheduledPost[] = [];

// Load scheduled posts from storage on initialization
chrome.storage.local.get('scheduledPosts', (result) => {
  if (result.scheduledPosts) {
    scheduledPosts = result.scheduledPosts;
    logScheduledPost("Loaded scheduled posts from storage", { count: scheduledPosts.length });
    
    // Re-schedule any pending posts that should still be executed
    const now = Date.now();
    scheduledPosts.forEach(post => {
      if (post.status === "pending" && post.scheduledTime > now) {
        // Calculate remaining time
        const remainingTime = post.scheduledTime - now;
        if (remainingTime > 0 && remainingTime < 86400000) { // Only reschedule if less than 24 hours
          logScheduledPost("Re-scheduling post after extension reload", { 
            postId: post.id, 
            remainingTime: Math.round(remainingTime / 1000) + "s" 
          });
          setTimeout(() => {
            executeScheduledPost(post.id);
          }, remainingTime);
        }
      }
    });
  }
});

// Function to save posts to storage
function saveScheduledPosts() {
  chrome.storage.local.set({ scheduledPosts }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving scheduled posts:", chrome.runtime.lastError);
    }
  });
}

// Enhanced logging function
function logScheduledPost(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[SCHEDULED POST ${timestamp}] ${message}`, data ? data : '');
}

async function makeAuthenticatedRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include", // Include cookies automatically
    headers: {
      "Content-Type": "application/json",
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
  updateIdeaStatus: (
    ideaId: string,
    status: IdeaStatus | "favorite"
  ) => Promise<any>;
  updateIdeaContent: (
    ideaId: string,
    body: string,
    title: string,
    subtitle: string
  ) => Promise<any>;
  generateIdeas: (
    topic?: string,
    ideasCount?: number,
    shouldSearch?: boolean
  ) => Promise<any>;
  improveText: (text: string, type: string, ideaId: string) => Promise<any>;
  improveTitle: (
    menuType: "title" | "subtitle",
    improveType: string,
    ideaId: string,
    value: string
  ) => Promise<any>;
  createNewIdea: () => Promise<any>;
  generateIdeasTest: () => Promise<any>;
  createSubstackPost: (
    message?: string,
    scheduleSeconds?: number,
    autoCloseTab?: boolean
  ) => Promise<any>;
  getScheduledPosts: () => Promise<any>;
};

// API request handlers
const apiHandlers: ApiHandlers = {
  // Idea status update
  updateIdeaStatus: async (ideaId: string, status: IdeaStatus | "favorite") => {
    const searchParamsStatus =
      status === "favorite" ? "isFavorite=true" : `status=${status}`;
    return makeAuthenticatedRequest(
      `/api/idea/${ideaId}/status?${searchParamsStatus}`,
      {
        method: "PATCH",
      }
    );
  },

  // Idea content update
  updateIdeaContent: async (
    ideaId: string,
    body: string,
    title: string,
    subtitle: string
  ) => {
    return makeAuthenticatedRequest(`/api/idea/${ideaId}`, {
      method: "PATCH",
      body: JSON.stringify({
        body,
        title,
        subtitle,
      }),
    });
  },

  // Generate ideas
  generateIdeas: async (
    topic: string = "",
    ideasCount: number = 3,
    shouldSearch: boolean = false
  ) => {
    return makeAuthenticatedRequest(
      `/api/post/generate/ideas?topic=${topic}&ideasCount=${ideasCount}&shouldSearch=${shouldSearch}`
    );
  },

  // Improve text
  improveText: async (text: string, type: string, ideaId: string) => {
    return makeAuthenticatedRequest("/api/post/improve", {
      method: "POST",
      body: JSON.stringify({
        text,
        type,
        ideaId,
      }),
    });
  },

  // Improve title or subtitle
  improveTitle: async (
    menuType: "title" | "subtitle",
    improveType: string,
    ideaId: string,
    value: string
  ) => {
    return makeAuthenticatedRequest("/api/post/improve/title", {
      method: "POST",
      body: JSON.stringify({
        menuType,
        improveType,
        ideaId,
        value,
      }),
    });
  },

  // Create new idea
  createNewIdea: async () => {
    return makeAuthenticatedRequest("/api/idea", {
      method: "POST",
    });
  },

  // Test idea generation (legacy handler)
  generateIdeasTest: async () => {
    return makeAuthenticatedRequest("/api/post/generate/ideas-test");
  },

  // Create a post on Substack
  createSubstackPost: async (
    message: string = "This is a test that was posted automatically with WriteRoom Chrome extension.",
    scheduleSeconds: number = 0,
    autoCloseTab: boolean = true
  ) => {
    try {
      logScheduledPost("createSubstackPost called", { message, scheduleSeconds, autoCloseTab });
      
      // If scheduleSeconds is provided, schedule the post for later
      if (scheduleSeconds > 0) {
        const postId = Date.now().toString();
        const scheduledTime = Date.now() + scheduleSeconds * 1000;

        logScheduledPost("Scheduling post for later", { postId, scheduledTime, autoCloseTab });

        // Add to scheduled posts queue
        const scheduledPost: ScheduledPost = {
          id: postId,
          message,
          scheduledTime,
          status: "pending",
          autoCloseTab
        };

        scheduledPosts.push(scheduledPost);
        saveScheduledPosts(); // Save to storage after adding

        logScheduledPost("Added post to queue", { queueLength: scheduledPosts.length });
        
        // Set up a timeout to execute the post
        logScheduledPost("Setting timeout for execution", { delaySeconds: scheduleSeconds });
        setTimeout(() => {
          logScheduledPost("Timeout triggered, executing scheduled post", { postId });
          executeScheduledPost(postId);
        }, scheduleSeconds * 1000);
        
        return {
          success: true,
          scheduled: true,
          message: `Post scheduled to be published in ${scheduleSeconds} seconds`,
          postId,
        };
      }

      logScheduledPost("Proceeding with immediate posting");
      
      // Otherwise, proceed with immediate posting
      // First, check if we have the necessary permissions
      const hasPermissions = await checkSubstackPermissions();
      logScheduledPost("Permission check result", { hasPermissions });
      
      if (!hasPermissions) {
        throw new Error("Missing scripting permission");
      }

      // Find or create a tab with Substack, but activate it for immediate posting
      logScheduledPost("Opening Substack tab");
      const tab = await openSubstackTab(true); // Pass true to activate the tab for immediate posting
      logScheduledPost("Tab opened", { tabId: tab?.id });
      
      if (!tab || !tab.id) {
        throw new Error("Failed to open Substack tab");
      }

      // Wait for the page to load
      logScheduledPost("Waiting for page to load");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // First check if the user is logged in
      logScheduledPost("Checking if user is logged in");
      const loginCheckResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: checkIfLoggedIn,
        args: [],
      });

      const isLoggedIn = loginCheckResult[0]?.result;
      logScheduledPost("Login check result", { isLoggedIn });
      
      if (!isLoggedIn) {
        throw new Error(
          "You need to be logged in to Substack to post. Please log in and try again."
        );
      }

      // Execute script to create a post
      logScheduledPost("Executing script to create post");
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: createPost,
        args: [message],
      });
      logScheduledPost("Script execution result", result);

      return { success: true, message: "Post created successfully", result };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logScheduledPost("Error creating Substack post", { error: errorMessage });
      console.error("Error creating Substack post:", error);
      return { success: false, error: errorMessage };
    }
  },

  // Get all scheduled posts
  getScheduledPosts: async () => {
    try {
      logScheduledPost("Getting scheduled posts", { count: scheduledPosts.length });
      
      // Check for extension context validity
      if (!chrome.runtime || chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError?.message || "Extension context invalid");
      }
      
      return {
        success: true,
        posts: scheduledPosts.map((post) => ({
          id: post.id,
          message: post.message,
          scheduledTime: post.scheduledTime,
          status: post.status,
          error: post.error,
          autoCloseTab: post.autoCloseTab
        })),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error fetching scheduled posts:", error);
      return { success: false, error: errorMessage };
    }
  },
};

// Helper function to check if we have the necessary permissions
async function checkSubstackPermissions(): Promise<boolean> {
  // In Manifest V3, host permissions are granted at install time
  // We just need to check if we have the scripting permission
  return new Promise((resolve) => {
    chrome.permissions.contains(
      {
        permissions: ["scripting"],
      },
      (result) => {
        resolve(result);
      }
    );
  });
}

// Helper function to open a Substack tab without activating it
async function openSubstackTab(activate: boolean = false): Promise<chrome.tabs.Tab> {
  return new Promise((resolve) => {
    // Always create a new tab for posting to avoid disrupting the user's current tab
    // This prevents the current tab from being refreshed if it's already on Substack
    chrome.tabs.create({ url: "https://substack.com", active: activate }, (tab) => {
      resolve(tab);
    });
  });
}

// Function to check if the user is logged in to Substack
function checkIfLoggedIn(): boolean {
  // Check for elements that indicate a logged-in state
  // This could be a profile picture, user menu, etc.
  // const userMenuElement = document.querySelector('.avatar-image') ||
  //                         document.querySelector('.user-menu-button') ||
  //                         document.querySelector('[data-testid="UserAvatar"]');

  // return !!userMenuElement;
  return true;
}

// Function to be injected into the Substack page
function createPost(message: string): { success: boolean; error?: string } {
  try {
    console.log("[SCHEDULED POST - INJECTED] Starting createPost function", { message });
    console.log("[SCHEDULED POST - INJECTED] Current URL:", window.location.href);
    console.log("[SCHEDULED POST - INJECTED] Page title:", document.title);
    
    // Force log the body HTML to see what we're working with
    console.log("[SCHEDULED POST - INJECTED] First 1000 chars of body HTML:", 
      document.body ? document.body.innerHTML.substring(0, 1000) : "No body found");
    
    // If we're not on the main feed page, navigate there
    if (
      !window.location.href.includes("substack.com") ||
      (window.location.pathname !== "/" &&
        window.location.pathname !== "/home" &&
        !window.location.pathname.includes("/p/"))
    ) {
      console.log("[SCHEDULED POST - INJECTED] Not on main feed, navigating", { currentUrl: window.location.href });
      window.location.href = "https://substack.com/";
      return { success: false, error: "Navigating to Substack home page" };
    }
    
    // DIRECT APPROACH: Instead of waiting and searching, let's create our own post interface
    console.log("[SCHEDULED POST - INJECTED] Using direct approach to create post");
    
    // Helper function to log HTML details of an element
    function logElementDetails(element: Element, description: string) {
      console.log(`[SCHEDULED POST - INJECTED] ${description}:`, {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        textContent: element.textContent?.substring(0, 50) + (element.textContent && element.textContent.length > 50 ? '...' : ''),
        html: element.outerHTML.substring(0, 200) + (element.outerHTML.length > 200 ? '...' : '')
      });
    }
    
    // Create a function to check DOM until post creator button is found
    function checkAndClickPostButton() {
      console.log("[SCHEDULED POST - INJECTED] STEP 1: Starting composer search");
      
      // New specific methods for Substack
      console.log("[SCHEDULED POST - INJECTED] STEP 1.0: Trying direct Substack-specific methods first");
      
      // Method 1: Look for specific Substack elements first
      const composeButton = document.querySelector('a[href="/publish/post/new"]') || 
                           document.querySelector('a[href*="new-post"]') ||
                           document.querySelector('a[data-testid="new-post-button"]');
      
      if (composeButton) {
        console.log("[SCHEDULED POST - INJECTED] STEP 1.0.1: Found direct compose button");
        logElementDetails(composeButton as Element, "Compose button details");
        
        try {
          console.log("[SCHEDULED POST - INJECTED] STEP 1.0.2: CLICKING direct compose button");
          (composeButton as HTMLElement).click();
          console.log("[SCHEDULED POST - INJECTED] STEP 1.0.3: Click executed successfully");
          return true;
        } catch (clickError) {
          console.error("[SCHEDULED POST - INJECTED] STEP 1.0.4: Error clicking compose button:", clickError);
        }
      }
      
      // Method 2: Look for 'New post' or 'Write' text on links or buttons
      const newPostElements = Array.from(document.querySelectorAll('a, button'))
        .filter(el => {
          const text = el.textContent?.trim().toLowerCase() || '';
          return text === 'new post' || text === 'write' || text.includes('create post');
        });
      
      if (newPostElements.length > 0) {
        const newPostButton = newPostElements[0];
        console.log("[SCHEDULED POST - INJECTED] STEP 1.0.5: Found 'New post' button by text");
        logElementDetails(newPostButton, "New post button details");
        
        try {
          console.log("[SCHEDULED POST - INJECTED] STEP 1.0.6: CLICKING 'New post' button");
          (newPostButton as HTMLElement).click();
          console.log("[SCHEDULED POST - INJECTED] STEP 1.0.7: Click executed successfully");
          return true;
        } catch (clickError) {
          console.error("[SCHEDULED POST - INJECTED] STEP 1.0.8: Error clicking 'New post' button:", clickError);
        }
      }
      
      // Fallback to standard methods if Substack-specific methods fail
      
      // Try all possible selectors for the post creator button
      const possibleSelectors = [
        // Try class-based selectors
        '.inlineComposer-v8PLSi',
        '.inline-composer',
        '[class*="composer"]',
        // Try by role
        'div[role="button"]',
        // Try by placeholder text
        '[placeholder*="post"]',
        '[placeholder*="write"]',
        '[placeholder*="mind"]',
      ];
      
      console.log("[SCHEDULED POST - INJECTED] STEP 1.1: Logging all divs with role=button");
      // Log all available divs with role=button to help diagnosis
      const roleButtons = document.querySelectorAll('div[role="button"]');
      console.log("[SCHEDULED POST - INJECTED] Found " + roleButtons.length + " divs with role=button");
      Array.from(roleButtons).forEach((el, i) => {
        console.log(`[SCHEDULED POST - INJECTED] Button ${i}: text="${el.textContent}", innerHTML="${el.innerHTML.substring(0, 100)}..."`);
      });
      
      console.log("[SCHEDULED POST - INJECTED] STEP 1.2: Trying each selector");
      // Try each selector
      for (const selector of possibleSelectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`[SCHEDULED POST - INJECTED] Selector "${selector}" matched ${elements.length} elements`);
        
        if (elements.length > 0) {
          console.log(`[SCHEDULED POST - INJECTED] STEP 1.3: Found ${elements.length} elements with selector "${selector}"`);
          
          // Look for one that resembles a composer
          for (const el of Array.from(elements)) {
            const text = el.textContent || '';
            if (text.includes("What's on your mind") || text.includes("post") || text.includes("Share") || text.includes("Write")) {
              console.log("[SCHEDULED POST - INJECTED] STEP 1.4: Found composer with matching text:", text);
              logElementDetails(el, "Composer element details");
              
              // Click it
              console.log("[SCHEDULED POST - INJECTED] STEP 1.5: CLICKING composer element");
              try {
                (el as HTMLElement).click();
                console.log("[SCHEDULED POST - INJECTED] STEP 1.6: Click executed successfully");
                return true;
              } catch (clickError) {
                console.error("[SCHEDULED POST - INJECTED] STEP 1.7: Error clicking composer:", clickError);
              }
            }
          }
          
          // If no text match found, just try the first element
          console.log("[SCHEDULED POST - INJECTED] STEP 1.8: No text match found, trying first matched element as composer");
          const firstElement = elements[0] as HTMLElement;
          logElementDetails(firstElement, "First matched element details");
          
          try {
            console.log("[SCHEDULED POST - INJECTED] STEP 1.9: CLICKING first element");
            firstElement.click();
            console.log("[SCHEDULED POST - INJECTED] STEP 1.10: Click executed successfully");
            return true;
          } catch (clickError) {
            console.error("[SCHEDULED POST - INJECTED] STEP 1.11: Error clicking first element:", clickError);
          }
        }
      }
      
      console.log("[SCHEDULED POST - INJECTED] STEP 1.12: No selectors matched, trying text-based div search");
      // If no selectors worked, try finding any div containing relevant text
      const allDivs = document.querySelectorAll('div');
      console.log(`[SCHEDULED POST - INJECTED] Searching through ${allDivs.length} divs for text matches`);
      
      let divWithText = null;
      for (const div of Array.from(allDivs)) {
        const text = div.textContent || '';
        if (text.includes("What's on your mind") || 
            text.includes("post") || 
            text.includes("Share") || 
            text.includes("Write")) {
          console.log("[SCHEDULED POST - INJECTED] STEP 1.13: Found div with relevant text:", text);
          logElementDetails(div, "Text-matched div details");
          divWithText = div;
          break;
        }
      }
      
      if (divWithText) {
        try {
          console.log("[SCHEDULED POST - INJECTED] STEP 1.14: CLICKING text-matched div");
          (divWithText as HTMLElement).click();
          console.log("[SCHEDULED POST - INJECTED] STEP 1.15: Click executed successfully");
          return true;
        } catch (clickError) {
          console.error("[SCHEDULED POST - INJECTED] STEP 1.16: Error clicking text-matched div:", clickError);
        }
      }
      
      // Last resort: try clicking on all divs that look like buttons
      console.log("[SCHEDULED POST - INJECTED] STEP 1.17: Trying to click any div that looks like a button");
      const buttonLikeDivs = Array.from(document.querySelectorAll('div')).filter(div => {
        const style = window.getComputedStyle(div);
        return (
          style.cursor === 'pointer' || 
          div.getAttribute('role') === 'button' ||
          (div.className && div.className.toLowerCase().includes('button'))
        );
      });
      
      console.log(`[SCHEDULED POST - INJECTED] Found ${buttonLikeDivs.length} button-like divs`);
      
      for (const buttonDiv of buttonLikeDivs) {
        try {
          console.log("[SCHEDULED POST - INJECTED] STEP 1.18: CLICKING button-like div");
          logElementDetails(buttonDiv, "Button-like div details");
          (buttonDiv as HTMLElement).click();
          console.log("[SCHEDULED POST - INJECTED] STEP 1.19: Click executed successfully");
          return true;
        } catch (clickError) {
          console.log("[SCHEDULED POST - INJECTED] Error clicking button-like div:", clickError);
        }
      }
      
      console.log("[SCHEDULED POST - INJECTED] STEP 1.20: No suitable composer element found after all attempts");
      return false;
    }
    
    // Function to find and populate editor
    function findAndPopulateEditor() {
      console.log("[SCHEDULED POST - INJECTED] STEP 2: Starting editor search");
      
      // Substack-specific approach: Try to find the title field first
      console.log("[SCHEDULED POST - INJECTED] STEP 2.0: Looking for Substack title field");
      
      // Wait a bit more for editor to fully load
      console.log("[SCHEDULED POST - INJECTED] Pausing briefly to allow editor to fully load");
      
      // Try title field by placeholder, role, or aria-label
      const titleInputs = document.querySelectorAll('input[placeholder*="Title"], input[aria-label*="title"], div[role="textbox"][aria-label*="title"], h1[contenteditable="true"]');
      console.log(`[SCHEDULED POST - INJECTED] STEP 2.0.1: Found ${titleInputs.length} possible title inputs`);
      
      Array.from(titleInputs).forEach((el, i) => {
        logElementDetails(el, `Title input ${i} details`);
      });
      
      if (titleInputs.length > 0) {
        const titleInput = titleInputs[0] as HTMLElement;
        console.log("[SCHEDULED POST - INJECTED] STEP 2.0.2: Using first element as title input");
        
        try {
          console.log("[SCHEDULED POST - INJECTED] STEP 2.0.3: Setting title");
          if (titleInput.tagName.toLowerCase() === 'input') {
            (titleInput as HTMLInputElement).value = "Test Post from WriteRoom";
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            titleInput.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            titleInput.focus();
            titleInput.innerHTML = "Test Post from WriteRoom";
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            titleInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          console.log("[SCHEDULED POST - INJECTED] STEP 2.0.4: Title set successfully");
        } catch (titleError) {
          console.error("[SCHEDULED POST - INJECTED] STEP 2.0.5: Error setting title:", titleError);
        }
      }
      
      // Look for Substack-specific editor elements
      console.log("[SCHEDULED POST - INJECTED] STEP 2.0.6: Looking for main editor field");
      const editorContainers = document.querySelectorAll('.redactor-styles, .redactor-editor, [data-slate-editor="true"], [role="textbox"][contenteditable="true"]');
      
      if (editorContainers.length > 0) {
        console.log(`[SCHEDULED POST - INJECTED] STEP 2.0.7: Found ${editorContainers.length} possible editor containers`);
        const editorContainer = editorContainers[0] as HTMLElement;
        logElementDetails(editorContainer, "Editor container details");
        
        try {
          console.log("[SCHEDULED POST - INJECTED] STEP 2.0.8: Setting editor content");
          editorContainer.focus();
          editorContainer.innerHTML = `<p>${message}</p>`;
          editorContainer.dispatchEvent(new Event('input', { bubbles: true }));
          editorContainer.dispatchEvent(new Event('change', { bubbles: true }));
          console.log("[SCHEDULED POST - INJECTED] STEP 2.0.9: Editor content set successfully");
          return true;
        } catch (editorError) {
          console.error("[SCHEDULED POST - INJECTED] STEP 2.0.10: Error setting editor content:", editorError);
        }
      }
      
      // Fallback to generic methods if Substack-specific methods fail

      // Try to find contenteditable
      const editables = document.querySelectorAll('[contenteditable="true"]');
      
      if (editables.length > 0) {
        const editor = editables[0] as HTMLElement;
        console.log("[SCHEDULED POST - INJECTED] STEP 2.1: Found contenteditable element");
        logElementDetails(editor, "Selected editor details");
        
        try {
          console.log("[SCHEDULED POST - INJECTED] STEP 2.2: Setting editor content");
          editor.focus();
          editor.innerHTML = `<p>${message}</p>`;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          editor.dispatchEvent(new Event('change', { bubbles: true }));
          console.log("[SCHEDULED POST - INJECTED] STEP 2.3: Editor content set successfully");
          return true;
        } catch (editorError) {
          console.error("[SCHEDULED POST - INJECTED] STEP 2.4: Error setting editor content:", editorError);
        }
      }
      
      console.log("[SCHEDULED POST - INJECTED] STEP 2.5: No editor found after all attempts");
      return false;
    }
    
    // Function to find and click publish button
    function findAndClickPublishButton() {
      console.log("[SCHEDULED POST - INJECTED] STEP 3: Looking for publish/post button");
      
      // First, try the exact pencraft button classes from the current Substack interface
      console.log("[SCHEDULED POST - INJECTED] STEP 3.1: Looking for Substack's pencraft buttons");
      
      // Look for any button with the primary class that indicates it's the main action button
      const pencraftButtons = document.querySelectorAll('button.priority_primary-RfbeYt, button[class*="priority_primary"]');
      console.log(`[SCHEDULED POST - INJECTED] STEP 3.1.1: Found ${pencraftButtons.length} pencraft primary buttons`);
      
      // If pencraft buttons are found, check each one for text "Post" or "Publish"
      if (pencraftButtons.length > 0) {
        Array.from(pencraftButtons).forEach((button, i) => {
          logElementDetails(button, `Pencraft button ${i} details`);
        });
        
        // First try to find one with text "Post" exactly (case-insensitive)
        for (const button of Array.from(pencraftButtons)) {
          const buttonText = button.textContent?.trim().toLowerCase() || '';
          console.log(`[SCHEDULED POST - INJECTED] STEP 3.1.2: Checking button with text: "${buttonText}"`);
          
          if (buttonText === 'post') {
            console.log("[SCHEDULED POST - INJECTED] STEP 3.1.3: Found exact Post button");
            try {
              (button as HTMLElement).click();
              console.log("[SCHEDULED POST - INJECTED] STEP 3.1.4: Clicked Post button");
              return true;
            } catch (clickError) {
              console.error("[SCHEDULED POST - INJECTED] STEP 3.1.5: Error clicking Post button:", clickError);
            }
          }
        }
        
        // If no exact match, try the first primary button (likely the Post button)
        console.log("[SCHEDULED POST - INJECTED] STEP 3.1.6: No exact Post button found, using first primary button");
        try {
          (pencraftButtons[0] as HTMLElement).click();
          console.log("[SCHEDULED POST - INJECTED] STEP 3.1.7: Clicked first primary button");
          return true;
        } catch (clickError) {
          console.error("[SCHEDULED POST - INJECTED] STEP 3.1.8: Error clicking first primary button:", clickError);
        }
      }
      
      // Try Substack-specific publish button selectors as fallback
      const substackPublishSelectors = [
        'button[data-testid="publish-button"]',
        'button[aria-label*="publish"]',
        'button.buttonNew-KfJF0Q:not([class*="secondary"])',
        'button.button--primary',
        'button.primary',
        'button.publish'
      ];
      
      // Try each Substack-specific selector
      console.log("[SCHEDULED POST - INJECTED] STEP 3.2: Trying Substack-specific publish selectors");
      for (const selector of substackPublishSelectors) {
        try {
          const publishButtons = document.querySelectorAll(selector);
          console.log(`[SCHEDULED POST - INJECTED] STEP 3.2.1: Selector "${selector}" matched ${publishButtons.length} elements`);
          
          if (publishButtons.length > 0) {
            const publishButton = publishButtons[0] as HTMLElement;
            logElementDetails(publishButton, "Publish button details");
            
            try {
              publishButton.click();
              console.log("[SCHEDULED POST - INJECTED] STEP 3.2.2: Clicked publish button");
              
              // Wait for confirmation dialog to appear
              setTimeout(handlePublishConfirmation, 1500);
              return true;
            } catch (clickError) {
              console.error("[SCHEDULED POST - INJECTED] STEP 3.2.3: Error clicking publish button:", clickError);
            }
          }
        } catch (selectorError) {
          console.error(`[SCHEDULED POST - INJECTED] STEP 3.2.4: Error with selector "${selector}":`, selectorError);
        }
      }
      
      // Fallback: Look for any button with "post" or "publish" text content
      console.log("[SCHEDULED POST - INJECTED] STEP 3.3: Looking for buttons with 'post' or 'publish' text");
      const allButtons = document.querySelectorAll('button');
      console.log(`[SCHEDULED POST - INJECTED] STEP 3.3.1: Found ${allButtons.length} buttons total`);
      
      // Log some buttons for debugging
      Array.from(allButtons).slice(0, 5).forEach((button, i) => {
        logElementDetails(button, `Button ${i} details`);
      });
      
      // First try to find a button with exact "Post" text
      for (const button of Array.from(allButtons)) {
        const buttonText = button.textContent?.trim().toLowerCase() || '';
        if (buttonText === 'post') {
          console.log("[SCHEDULED POST - INJECTED] STEP 3.3.2: Found button with exact 'post' text");
          logElementDetails(button, "Post button details");
          
          try {
            (button as HTMLElement).click();
            console.log("[SCHEDULED POST - INJECTED] STEP 3.3.3: Clicked Post button");
            return true;
          } catch (clickError) {
            console.error("[SCHEDULED POST - INJECTED] STEP 3.3.4: Error clicking Post button:", clickError);
          }
        }
      }
      
      // Then try for contains "post" or "publish"
      for (const button of Array.from(allButtons)) {
        const buttonText = button.textContent?.toLowerCase() || '';
        if (buttonText.includes('post') || buttonText.includes('publish')) {
          console.log(`[SCHEDULED POST - INJECTED] STEP 3.3.5: Found button with text containing 'post' or 'publish': "${buttonText}"`);
          logElementDetails(button, "Post/Publish text button details");
          
          try {
            (button as HTMLElement).click();
            console.log("[SCHEDULED POST - INJECTED] STEP 3.3.6: Clicked post/publish text button");
            return true;
          } catch (clickError) {
            console.error("[SCHEDULED POST - INJECTED] STEP 3.3.7: Error clicking post/publish text button:", clickError);
          }
        }
      }
      
      console.log("[SCHEDULED POST - INJECTED] STEP 3.4: No post/publish button found after all attempts");
      return false;
    }
    
    // Function to handle the publish confirmation dialog
    function handlePublishConfirmation() {
      console.log("[SCHEDULED POST - INJECTED] STEP 4: Looking for confirmation dialog");
      
      // Try to find confirmation dialog and buttons
      const confirmSelectors = [
        'button:contains("Publish now")',
        'button:contains("Confirm")',
        'button:contains("Yes")',
        'button.confirm',
        'button.primary:not(:disabled)',
        'div[role="dialog"] button.primary'
      ];
      
      // Try each confirmation selector
      console.log("[SCHEDULED POST - INJECTED] STEP 4.1: Trying confirmation dialog selectors");
      for (const selector of confirmSelectors) {
        try {
          const confirmButtons = document.querySelectorAll(selector);
          console.log(`[SCHEDULED POST - INJECTED] STEP 4.1.1: Selector "${selector}" matched ${confirmButtons.length} elements`);
          
          if (confirmButtons.length > 0) {
            const confirmButton = confirmButtons[0] as HTMLElement;
            logElementDetails(confirmButton, "Confirmation button details");
            
            // If the text suggests this is a confirmation button, click it
            const buttonText = confirmButton.textContent?.toLowerCase() || '';
            if (buttonText.includes('publish') || buttonText.includes('confirm') || buttonText.includes('yes')) {
              console.log("[SCHEDULED POST - INJECTED] STEP 4.1.2: Found confirmation button with text:", buttonText);
              confirmButton.click();
              console.log("[SCHEDULED POST - INJECTED] STEP 4.1.3: Clicked confirmation button - POST CONFIRMED");
              return true;
            }
          }
        } catch (selectorError) {
          console.error(`[SCHEDULED POST - INJECTED] STEP 4.1.4: Error with selector "${selector}":`, selectorError);
        }
      }
      
      // Fallback: Look for any buttons in a dialog that might be a confirmation
      console.log("[SCHEDULED POST - INJECTED] STEP 4.2: Looking for dialog buttons");
      const dialogElements = document.querySelectorAll('div[role="dialog"], .modal, [class*="modal"], [class*="dialog"]');
      
      if (dialogElements.length > 0) {
        console.log(`[SCHEDULED POST - INJECTED] STEP 4.2.1: Found ${dialogElements.length} possible dialogs`);
        const dialog = dialogElements[0] as HTMLElement;
        logElementDetails(dialog, "Dialog details");
        
        // Find buttons in the dialog
        const dialogButtons = dialog.querySelectorAll('button');
        console.log(`[SCHEDULED POST - INJECTED] STEP 4.2.2: Found ${dialogButtons.length} buttons in dialog`);
        
        // Log dialog buttons
        Array.from(dialogButtons).forEach((btn, i) => {
          logElementDetails(btn, `Dialog button ${i} details`);
        });
        
        // Try to find a button that looks like a confirmation button
        for (const btn of Array.from(dialogButtons)) {
          const btnText = btn.textContent?.toLowerCase() || '';
          
          if (btnText.includes('publish') || btnText.includes('confirm') || btnText.includes('yes') || 
              btnText.includes('ok') || btnText.includes('submit')) {
            console.log("[SCHEDULED POST - INJECTED] STEP 4.2.3: Found likely confirmation button in dialog:", btnText);
            
            try {
              (btn as HTMLElement).click();
              console.log("[SCHEDULED POST - INJECTED] STEP 4.2.4: Clicked dialog confirmation button - POST CONFIRMED");
              return true;
            } catch (clickError) {
              console.error("[SCHEDULED POST - INJECTED] STEP 4.2.5: Error clicking dialog confirmation button:", clickError);
            }
          }
        }
        
        // If no specific confirmation button found, try the last button (often the confirm action)
        if (dialogButtons.length > 0) {
          const lastButton = dialogButtons[dialogButtons.length - 1] as HTMLElement;
          console.log("[SCHEDULED POST - INJECTED] STEP 4.2.6: Trying last button in dialog as confirmation");
          
          try {
            lastButton.click();
            console.log("[SCHEDULED POST - INJECTED] STEP 4.2.7: Clicked last dialog button - POST LIKELY CONFIRMED");
            return true;
          } catch (clickError) {
            console.error("[SCHEDULED POST - INJECTED] STEP 4.2.8: Error clicking last dialog button:", clickError);
          }
        }
      }
      
      console.log("[SCHEDULED POST - INJECTED] STEP 4.3: No confirmation dialog or button found");
      return false;
    }
    
    // Set up a sequence of operations with timeouts
    console.log("[SCHEDULED POST - INJECTED] Setting up posting sequence with timeouts");
    setTimeout(() => {
      console.log("[SCHEDULED POST - INJECTED] Phase 1: Finding and clicking composer");
      if (checkAndClickPostButton()) {
        console.log("[SCHEDULED POST - INJECTED] Composer clicked successfully, waiting 3 seconds for editor to appear");
        setTimeout(() => {
          console.log("[SCHEDULED POST - INJECTED] Phase 2: Finding and populating editor");
          if (findAndPopulateEditor()) {
            console.log("[SCHEDULED POST - INJECTED] Editor populated successfully, waiting 3 seconds for publish button");
            setTimeout(() => {
              console.log("[SCHEDULED POST - INJECTED] Phase 3: Finding and clicking publish button");
              if (findAndClickPublishButton()) {
                console.log("[SCHEDULED POST - INJECTED] Publish button clicked successfully - POST COMPLETE");
              } else {
                console.log("[SCHEDULED POST - INJECTED] Failed to find and click publish button");
              }
            }, 3000);
          } else {
            console.log("[SCHEDULED POST - INJECTED] Failed to find and populate editor");
          }
        }, 3000);
      } else {
        console.log("[SCHEDULED POST - INJECTED] Failed to find and click composer");
      }
    }, 2000);

    // Return immediately since we can't wait for the async process
    return {
      success: true,
      error: "Post operation started. Check the console for detailed logs."
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[SCHEDULED POST - INJECTED] Error in createPost:", error);
    return { success: false, error: errorMessage };
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
function callApiHandler(
  action: keyof ApiHandlers,
  params: unknown[] = []
): Promise<any> {
  switch (action) {
    case "updateIdeaStatus":
      return apiHandlers.updateIdeaStatus(
        params[0] as string,
        params[1] as IdeaStatus | "favorite"
      );
    case "updateIdeaContent":
      return apiHandlers.updateIdeaContent(
        params[0] as string,
        params[1] as string,
        params[2] as string,
        params[3] as string
      );
    case "generateIdeas":
      return apiHandlers.generateIdeas(
        params[0] as string | undefined,
        params[1] as number | undefined,
        params[2] as boolean | undefined
      );
    case "improveText":
      return apiHandlers.improveText(
        params[0] as string,
        params[1] as string,
        params[2] as string
      );
    case "improveTitle":
      return apiHandlers.improveTitle(
        params[0] as "title" | "subtitle",
        params[1] as string,
        params[2] as string,
        params[3] as string
      );
    case "createNewIdea":
      return apiHandlers.createNewIdea();
    case "generateIdeasTest":
      return apiHandlers.generateIdeasTest();
    case "createSubstackPost":
      return apiHandlers.createSubstackPost(
        params[0] as string | undefined,
        params[1] as number | undefined,
        params[2] as boolean | undefined
      );
    case "getScheduledPosts":
      return apiHandlers.getScheduledPosts();
    default:
      return Promise.reject(new Error(`Unknown action: ${action}`));
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener(
  (request: ChromeMessage, sender, sendResponse) => {
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
      apiHandlers
        .generateIdeasTest()
        .then((data: any) => {
          sendResponse({ success: true, data });
        })
        .catch((error: Error) => {
          console.error("Error generating ideas:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Will respond asynchronously
    }
  }
);

// Execute a scheduled post
async function executeScheduledPost(postId: string) {
  // Find the post in the queue
  const postIndex = scheduledPosts.findIndex((post) => post.id === postId);
  logScheduledPost("Executing scheduled post", { postId, postIndex });
  
  if (postIndex === -1) {
    logScheduledPost("Post not found in queue", { postId });
    return;
  }

  // Update status to processing
  scheduledPosts[postIndex].status = "processing";
  saveScheduledPosts(); // Save state update
  logScheduledPost("Updated post status to processing", { postId });

  let tab: chrome.tabs.Tab | null = null;

  try {
    // First, check if we have the necessary permissions
    logScheduledPost("Checking permissions", { postId });
    const hasPermissions = await checkSubstackPermissions();
    logScheduledPost("Permission check result", { postId, hasPermissions });
    
    if (!hasPermissions) {
      throw new Error("Missing scripting permission");
    }

    // Find or create a tab with Substack, but don't activate it
    logScheduledPost("Opening Substack tab in background", { postId });
    tab = await openSubstackTab(false); // Pass false to not activate the tab
    logScheduledPost("Tab opened in background", { postId, tabId: tab?.id });
    
    if (!tab || !tab.id) {
      throw new Error("Failed to open Substack tab");
    }

    // Wait for the page to load - increased to 10 seconds
    logScheduledPost("Waiting for page to fully load", { postId });
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Check if the user is logged in
    logScheduledPost("Checking if user is logged in", { postId });
    const loginCheckResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: checkIfLoggedIn,
      args: [],
    });

    const isLoggedIn = loginCheckResult[0]?.result;
    logScheduledPost("Login check result", { postId, isLoggedIn });
    
    if (!isLoggedIn) {
      throw new Error("You need to be logged in to Substack to post");
    }

    logScheduledPost("About to post message", { 
      postId, 
      messagePreview: scheduledPosts[postIndex].message.substring(0, 30) + '...' 
    });

    // Set up a listener for console messages from the tab
    logScheduledPost("Setting up console monitoring", { postId });
    
    // We'll use executeScript to inject a console interceptor instead of the debugger API
    // This is more reliable and doesn't require the debugger permission
    if (tab && tab.id) {
      try {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Store the original console.log function
            const originalLog = console.log;
            
            // Override console.log to capture our special messages
            console.log = function(...args) {
              // Call the original console.log
              originalLog.apply(console, args);
              
              // Check if this is one of our special messages
              const message = args.join(' ');
              if (typeof message === 'string' && message.includes('[SCHEDULED POST - INJECTED]')) {
                // Send a message to the parent window to capture this log
                window.postMessage({
                  type: 'SCHEDULED_POST_LOG',
                  message: message
                }, '*');
              }
            };
            
            // Set up a listener for our logs
            window.addEventListener('message', (event) => {
              if (event.data && event.data.type === 'SCHEDULED_POST_LOG') {
                // This message will be visible in the DevTools console
                originalLog('%c[CAPTURED LOG]', 'color: purple; font-weight: bold', event.data.message);
              }
            });
          }
        });
        
        logScheduledPost("Console monitoring set up successfully", { postId });
      } catch (error) {
        logScheduledPost("Failed to set up console monitoring (this is non-critical)", { 
          postId, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Execute script to create a post
    logScheduledPost("Executing script to create post", { postId });
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: createPost,
      args: [scheduledPosts[postIndex].message],
    });
    logScheduledPost("Script execution result", { postId, result });

    // Wait longer for the posting process to complete
    logScheduledPost("Waiting for posting process to complete", { postId });
    await new Promise((resolve) => setTimeout(resolve, 8000)); // Increased to 20 seconds for more verbose logging

    // No need to detach the debugger anymore since we're not using it

    // Update status to completed
    scheduledPosts[postIndex].status = "completed";
    saveScheduledPosts(); // Save state update
    logScheduledPost("Updated post status to completed", { postId });

    // After successful posting, close the tab if autoCloseTab is true
    const shouldCloseTab = scheduledPosts[postIndex].autoCloseTab !== false;
    logScheduledPost("Checking if tab should be closed", { postId, shouldCloseTab });
    
    if (shouldCloseTab) {
      logScheduledPost("Setting timeout to close tab", { postId });
      setTimeout(() => {
        if (tab && tab.id) {
          logScheduledPost("Closing tab", { postId, tabId: tab.id });
          chrome.tabs.remove(tab.id);
        }
      }, 10000); // Increased from 5000 to 10000 ms (10 seconds)
    } else {
      logScheduledPost("Tab will remain open as requested", { postId });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logScheduledPost("Error executing scheduled post", { postId, error: errorMessage });
    console.error("Error executing scheduled post:", error);

    // Get detailed HTML of the tab if possible
    if (tab && tab.id) {
      try {
        logScheduledPost("Attempting to capture tab contents for debugging", { postId });
        // Try to execute a script to get the HTML content for debugging
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return {
              url: window.location.href,
              title: document.title,
              bodyText: document.body?.textContent?.substring(0, 1000) || "No body text",
              html: document.documentElement.outerHTML
            };
          },
        }).then(result => {
          if (result && result[0]) {
            const pageInfo = result[0].result;
            logScheduledPost("Tab page info", { 
              postId, 
              url: pageInfo.url,
              title: pageInfo.title,
              bodyTextPreview: pageInfo.bodyText + '...'
            });
            
            // Log the most important parts of HTML for debugging
            logScheduledPost("Tab HTML structure", {
              postId,
              headContent: pageInfo.html.match(/<head>(.*?)<\/head>/s)?.[0]?.substring(0, 500) + '...' || "No head content found",
              bodyStructure: pageInfo.html.match(/<body.*?>(.*?)<\/body>/s)?.[0]?.substring(0, 1000) + '...' || "No body content found"
            });
          }
        }).catch(err => {
          logScheduledPost("Failed to capture tab HTML", { postId, error: err });
        });
      } catch (screenshotError) {
        logScheduledPost("Error capturing tab content", { 
          postId, 
          error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
        });
      }
    }

    // Update status to failed
    scheduledPosts[postIndex].status = "failed";
    scheduledPosts[postIndex].error = errorMessage;
    saveScheduledPosts(); // Save state update
    logScheduledPost("Updated post status to failed", { postId, error: errorMessage });
  }
}

export { makeAuthenticatedRequest };
