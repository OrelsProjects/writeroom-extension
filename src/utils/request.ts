import { log, logError } from "./logger";

// const API_BASE_URL = "https://9107-109-186-108-120.ngrok-free.app";
const API_BASE_URL = "https://www.writestack.io";
// const API_BASE_URL = "http://localhost:3000";

export async function makeAuthenticatedRequest(
  endpoint: string,
  options: RequestInit = {},
  baseUrl?: string
) {
  try {
    let url = `${baseUrl || API_BASE_URL}/${endpoint}`;
    // replace accidental double \\ with single \
    url = url.replace("\\\\", "\\");
    log("Making request", { url, options });
    const response = await fetch(url, {
      ...options,
      credentials: "include", // Include cookies automatically
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      log("Request failed", { status: response.status, response: text });
      return {
        success: false,
        error: text,
        status: response.status,
      };
    }

    const json = await response.json();
    log("Response json", json);

    return {
      success: true,
      data: json,
      status: response.status,
    };
  } catch (error: any) {
    logError("Request failed", error);
    return {
      success: false,
      error: error.message,
      status: 500,
    };
  }
}
