// background.ts
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

// Enhanced logging function
function logScheduledPost(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[SCHEDULED POST ${timestamp}] ${message}`, data ? data : "");
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
  createSubstackPost: async (bodyJson: any) => {
    try {
      // if bodyjson is not a string, stringify it
      const body =
        typeof bodyJson === "string" ? bodyJson : JSON.stringify(bodyJson);

      const response = await fetch("https://substack.com/api/v1/comment/feed", {
        headers: {
          "content-type": "application/json",
          Referer: "https://substack.com/home",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body,
        method: "POST",
      });
      const data = await response.json();
      return {
        message: "Post created successfully",
        action: "SUBSTACK_POST_CREATED",
        result: JSON.stringify(data),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logScheduledPost("Error creating Substack post", { error: errorMessage });
      console.error("Error creating Substack post:", error);
      throw error;
    }
  },
};

// Define message types
interface ApiRequestMessage {
  type: "API_REQUEST" | "PING";
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
    default:
      return Promise.reject(new Error(`Unknown action: ${action}`));
  }
}

chrome.runtime.onMessageExternal.addListener(
  (request: ChromeMessage, sender, sendResponse) => {
    console.log(
      "Background script received external message:",
      request,
      "from:",
      sender.url,
      "Type: ",
      request.type
    );

    // Handle PING message - respond immediately without async
    if (request.type === "PING") {
      console.log("Received external PING, responding immediately");
      sendResponse({
        success: true,
        timestamp: Date.now(),
        message: "Extension is active",
        source: "external",
      });
      return false; // No async response needed
    }

    // Handle API requests
    if (request.type === "API_REQUEST") {
      const { action, params } = request;
      console.log("Received API request:", action, params);
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

    return false;
  }
);

export { makeAuthenticatedRequest };
