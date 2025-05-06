import { API_BASE_URL } from "@/utils/api";

const LOG_ENDPOINT = "api/v1/extension/log";

/**
 * Enhanced logging function that logs to console and sends to server
 * @param message Message to log
 * @param data Optional data to include with the log
 */
export async function log(message: string, data?: any): Promise<void> {
  // Always log to console first
  if (data !== undefined) {
    console.log(message, data);
  } else {
    console.log(message);
  }

  try {
    // Prepare the log payload
    const payload = {
      message,
      data: data !== undefined ? JSON.stringify(data) : undefined,
      timestamp: new Date().toISOString(),
      source: "extension",
      level: "info",
    };

    if (API_BASE_URL.includes("localhost")) {
      console.log("Skipping log to server for localhost");
      return;
    }

    // Send to server endpoint
    await fetch(`${API_BASE_URL}/${LOG_ENDPOINT}`, {
      method: "POST",
      body: JSON.stringify(payload),
      credentials: "include", // Include cookies automatically
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // If logging to server fails, just log to console but don't throw
    console.error("Failed to send log to server:", error);
  }
}

/**
 * Enhanced error logging function that logs to console and sends to server
 * @param message Error message to log
 * @param data Optional error data to include with the log
 */
export async function logError(message: string, data?: any): Promise<void> {
  // Always log to console first
  if (data !== undefined) {
    console.log(`[ERROR] ${message}`, data);
  } else {
    console.log(`[ERROR] ${message}`);
  }

  try {
    // Prepare the log payload
    const payload = {
      message,
      data: data !== undefined ? JSON.stringify(data) : undefined,
      timestamp: new Date().toISOString(),
      source: "extension",
      level: "error",
    };

    // Send to server endpoint
    await fetch(`${API_BASE_URL}/${LOG_ENDPOINT}`, {
      method: "POST",
      body: JSON.stringify(payload),
      credentials: "include", // Include cookies automatically
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // If logging to server fails, just log to console but don't throw
    console.error("Failed to send error log to server:", error);
  }
}
