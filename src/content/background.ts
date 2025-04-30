// background.ts
import {
  Alarm,
  createSchedule,
  deleteSchedule,
  getSchedules,
  Schedule,
} from "../utils/scheduleUtils";
import { handleScheduleTrigger } from "../utils/scheduleTriggerService";
import { NoteDraftImage, prepareAttachmentsForNote } from "../utils/imageUtils";
import { log, logError } from "../utils/logger";

// Base URL for API requests
const API_BASE_URL = "https://www.writestack.io";

interface Response<T> {
  message: string;
  action: string;
  result: T;
}

// Image upload result interface
interface ImageUploadResult {
  url: string;
  success: boolean;
  attachmentId?: string;
}

// Enhanced logging function
function logScheduledPost(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[SCHEDULED POST ${timestamp}] ${message}`, data ? data : "");
}

// Define API handler types
type ApiHandlers = {
  createSubstackPost: (
    message?: string,
    scheduleSeconds?: number,
    autoCloseTab?: boolean
  ) => Promise<Response<any>>;
  getSubstackCookies: () => Promise<Response<string>>;
  setSubstackCookies: () => Promise<Response<any>>;
  createSchedule: (
    scheduleId: string,
    userId: string,
    timestamp: number
  ) => Promise<Response<Schedule>>;
  deleteSchedule: (scheduleId: string) => Promise<Response<boolean>>;
  getSchedules: () => Promise<
    Response<{ schedules: Schedule[]; alarms: Alarm[] }>
  >;
  uploadImagesToSubstack: (
    imageUrls: string[]
  ) => Promise<Response<ImageUploadResult[]>>;
};

// API request handlers
const apiHandlers: ApiHandlers = {
  getSubstackCookies: async (): Promise<Response<string>> => {
    return new Promise((resolve, reject) => {
      chrome.cookies.getAll({ domain: "substack.com" }, (cookies) => {
        if (chrome.runtime.lastError) {
          logError("Error fetching cookies:", chrome.runtime.lastError);
          reject(chrome.runtime.lastError.message);
          return;
        }

        if (!cookies || cookies.length === 0) {
          console.warn("No Substack cookies found.");
          resolve({
            message: "No Substack cookies found.",
            action: "SUBSTACK_COOKIES_FETCHED",
            result: "",
          });
          return;
        }

        // Only keep relevant cookies
        const relevantCookieNames = ["substack.sid", "__cf_bm", "substack.lli"];
        log("Cookies:", cookies);
        const relevantCookies = cookies.filter((c) =>
          relevantCookieNames.includes(c.name)
        );

        if (relevantCookies.length === 0) {
          console.warn("No relevant Substack auth cookies found.");
          resolve({
            message: "No relevant Substack auth cookies found.",
            action: "SUBSTACK_COOKIES_FETCHED",
            result: "",
          });
          return;
        }

        const cookieDetails = relevantCookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          expiresAt: cookie.expirationDate || null,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite || "unspecified",
        }));

        const result = JSON.stringify(cookieDetails);

        resolve({
          message: "Cookies fetched successfully",
          action: "SUBSTACK_COOKIES_FETCHED",
          result: result,
        });
      });
    });
  },

  // Create a post on Substack
  createSubstackPost: async (bodyJson: any) => {
    try {
      const body =
        typeof bodyJson === "string" ? bodyJson : JSON.stringify(bodyJson);

      const response = await fetch("https://substack.com/api/v1/comment/feed", {
        headers: {
          "content-type": "application/json",
          Referer: "https://substack.com/home",
          // Origin: "https://substack.com",
        },
        // credentials: "include", // Required to send cookies
        body,
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        log("Response:", response);
        log("Data:", data);
        return {
          message: "Failed to create post",
          action: "SUBSTACK_POST_CREATED",
          result: JSON.stringify({ error: "Failed to create post" }),
        };
      }
      log("Response:", response);
      log("Data after post sent:", data);
      return {
        message: "Post created successfully",
        action: "SUBSTACK_POST_CREATED",
        result: JSON.stringify(data),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log("Error creating Substack post", { error: errorMessage });
      logError("Error creating Substack post:", error);
      throw error;
    }
  },

  setSubstackCookies: async () => {
    const response = await apiHandlers.getSubstackCookies();
    const parsedCookies = JSON.parse(response.result);
    log("Sending to server:", JSON.stringify(parsedCookies));

    try {
      const cookiesResponse = await fetch(`${API_BASE_URL}/api/user/cookies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedCookies),
      });
      if (!cookiesResponse.ok) {
        logError("Failed to send cookies to server");
        return response;
      }
      const data = await cookiesResponse.json();
      log("Cookies sent to server successfully", data);
      return response;
    } catch (error) {
      logError("Error sending cookies to server:", error);
      return response;
    }
  },

  // Create a new schedule
  createSchedule: async (
    scheduleId: string,
    userId: string,
    timestamp: number
  ): Promise<Response<Schedule>> => {
    try {
      // Create schedule in extension storage
      log("Creating schedule", { scheduleId, userId, timestamp });
      const schedule = await createSchedule(scheduleId, userId, timestamp);
      log("Schedule created successfully", schedule);
      return {
        message: "Schedule created successfully",
        action: "SCHEDULE_CREATED",
        result: schedule,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logError("Error creating schedule:", errorMessage);
      throw error;
    }
  },

  deleteSchedule: async (scheduleId: string): Promise<Response<boolean>> => {
    try {
      // Delete schedule from extension storage
      const result = await deleteSchedule(scheduleId);
      return {
        message: result
          ? "Schedule deleted successfully"
          : "Schedule not found",
        action: "SCHEDULE_DELETED",
        result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logError("Error deleting schedule:", errorMessage);
      throw error;
    }
  },

  // Get all schedules
  getSchedules: async (): Promise<
    Response<{ schedules: Schedule[]; alarms: Alarm[] }>
  > => {
    try {
      // Get schedules from extension storage
      const { schedules, alarms } = await getSchedules();
      return {
        message: `Found ${schedules.length} schedules`,
        action: "SCHEDULES_FETCHED",
        result: { schedules, alarms },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logError("Error getting schedules:", errorMessage);
      throw error;
    }
  },

  // Upload multiple images to Substack
  uploadImagesToSubstack: async (
    imageUrls: string[]
  ): Promise<Response<ImageUploadResult[]>> => {
    log("Uploading images to Substack:", imageUrls);

    if (!imageUrls || !imageUrls.length) {
      return {
        message: "No images to upload",
        action: "IMAGES_UPLOADED",
        result: [],
      };
    }

    // Process each image URL, tracking results
    const results: ImageUploadResult[] = [];

    try {
      // Use prepareAttachmentsForNote to process all images
      const attachments = await prepareAttachmentsForNote(imageUrls);

      // Create result entries for successful uploads
      const successfulUploads = new Map<string, NoteDraftImage>();
      attachments.forEach((attachment) => {
        successfulUploads.set(attachment.url, attachment);
      });

      // Create result for each original URL
      for (const imageUrl of imageUrls) {
        const attachment = successfulUploads.get(imageUrl);

        if (attachment) {
          results.push({
            url: imageUrl,
            success: true,
            attachmentId: attachment.id,
          });
        } else {
          results.push({
            url: imageUrl,
            success: false,
          });
        }
      }

      return {
        message: `Successfully uploaded ${attachments.length} of ${imageUrls.length} images`,
        action: "IMAGES_UPLOADED",
        result: results,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logError("Error uploading images to Substack:", errorMessage);

      // For any remaining URLs not in results, add failed entries
      const processedUrls = new Set(results.map((r) => r.url));

      for (const imageUrl of imageUrls) {
        if (!processedUrls.has(imageUrl)) {
          results.push({
            url: imageUrl,
            success: false,
          });
        }
      }

      return {
        message: `Error uploading images: ${errorMessage}`,
        action: "IMAGES_UPLOADED",
        result: results,
      };
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
    case "getSubstackCookies":
      return apiHandlers.getSubstackCookies();
    case "setSubstackCookies":
      return apiHandlers.setSubstackCookies();
    case "createSubstackPost":
      return apiHandlers.createSubstackPost(
        params[0] as string | undefined,
        params[1] as number | undefined,
        params[2] as boolean | undefined
      );
    case "createSchedule":
      return apiHandlers.createSchedule(
        params[0] as string,
        params[1] as string,
        params[2] as number
      );
    case "deleteSchedule":
      return apiHandlers.deleteSchedule(params[0] as string);
    case "getSchedules":
      return apiHandlers.getSchedules();
    case "uploadImagesToSubstack":
      return apiHandlers.uploadImagesToSubstack(params[0] as string[]);
    default:
      return Promise.reject(new Error(`Unknown action: ${action}`));
  }
}

let isSending = false;

// Set up alarm listener for schedule triggers
chrome.alarms.onAlarm.addListener(async (alarm) => {
  log(`Alarm triggered: ${alarm.name}`);

  // Check if this is a schedule alarm
  const { schedules } = await getSchedules();
  const schedule = schedules.find((s) => s.scheduleId === alarm.name);

  if (schedule) {
    log(`Processing schedule: ${schedule.scheduleId}`);
    try {
      await handleScheduleTrigger(schedule);

      // Delete the schedule after processing
      await deleteSchedule(schedule.scheduleId);
    } catch (error) {
      logError(`Error handling schedule ${schedule.scheduleId}:`, error);
    }
  }
});

chrome.runtime.onMessageExternal.addListener(
  (request: ChromeMessage, sender, sendResponse) => {
    log("Background script received external message:", {
      request,
      sender: sender?.url,
      type: request?.type,
    });

    // Handle PING message - respond immediately without async
    if (request?.type === "PING") {
      log("Received external PING, responding immediately");
      const version = chrome.runtime.getManifest().version;
      log("Version:", version);
      sendResponse({
        success: true,
        timestamp: Date.now(),
        version,
        message: "Extension is active",
        source: "external",
      });
      return false; // No async response needed
    }

    // Handle API requests
    if (request?.type === "API_REQUEST") {
      const { action, params } = request;
      log("Received API request:", { action, params });
      if (action) {
        callApiHandler(action, params)
          .then((data: any) => {
            sendResponse({ success: true, data });
          })
          .catch((error: Error) => {
            logError(`Error in API request (${action}):`, error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Will respond asynchronously
      }
    }

    return false;
  }
);

chrome.runtime.onMessage.addListener(
  (request: ChromeMessage, sender, sendResponse) => {
    log("Background got internal message:", request);

    if (request?.type === "PING") {
      sendResponse({
        success: true,
        timestamp: Date.now(),
        message: "Extension is active",
        source: "internal",
      });
      return false;
    }

    if (request?.type === "API_REQUEST") {
      const { action, params } = request;
      log("API request:", { action, params });

      if (action) {
        callApiHandler(action, params)
          .then((data: any) => {
            sendResponse({ success: true, data });
          })
          .catch((error: Error) => {
            logError(`Error in API request (${action}):`, error);
            sendResponse({ success: false, error: error.message });
          });

        return true;
      }
    }

    return false;
  }
);

// Initialize the extension
async function initializeExtension() {
  log("Initializing extension...");

  // Check for any pending schedules
  const { schedules, alarms } = await getSchedules();
  if (schedules.length > 0) {
    log(`Found ${schedules.length} schedules, ${schedules} and ${alarms}`);

    // Process any schedules that should have already been triggered
    const now = Date.now();
    // const pastSchedules = schedules.filter((s) => s.timestamp <= now);

    // if (pastSchedules.length > 0) {
    //   console.log(`Processing ${pastSchedules.length} past schedules`);

    //   for (const schedule of pastSchedules) {
    //     try {
    //       await handleScheduleTrigger(schedule);
    //       await deleteSchedule(schedule.scheduleId);
    //     } catch (error) {
    //       console.error(
    //         `Error handling past schedule ${schedule.scheduleId}:`,
    //         error
    //       );
    //     }
    //   }
    // }

    // Set up alarms for future schedules
    const futureSchedules = schedules.filter((s) => s.timestamp > now);
    if (futureSchedules.length > 0) {
      log(`Setting up alarms for ${futureSchedules.length} future schedules`);

      for (const schedule of futureSchedules) {
        try {
          chrome.alarms.create(schedule.scheduleId, {
            when: schedule.timestamp,
          });
          log(
            `Alarm created for schedule ${schedule.scheduleId} at ${new Date(
              schedule.timestamp
            ).toISOString()}`
          );
        } catch (error) {
          logError(
            `Error creating alarm for schedule ${schedule.scheduleId}:`,
            error
          );
        }
      }
    }
  }
}

// Run initialization
initializeExtension().catch((error) => {
  logError("Error initializing extension:", error);
});
