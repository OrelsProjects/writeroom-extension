import { API_BASE_URL } from "@/utils/api";
import { log, logError } from "./logger";


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
        // "ngrok-skip-browser-warning": "69420",
        ...options.headers,
      },
    });

    log("response of makeAuthenticatedRequest", response);

    if (!response.ok) {
      const text = await response.text();
      log("Request failed", { status: response.status, response: text });
      return {
        success: false,
        error: text,
        status: response.status,
      };
    }

    const text = await response.text();
    log("Response text", text);

    const json = JSON.parse(text);
    log("Response json", json);

    return {
      success: true,
      data: json,
      status: response.status,
    };
  } catch (error: any) {
    console.log("error of makeAuthenticatedRequest", error);
    logError("Request failed", error);
    return {
      success: false,
      error: error.message,
      status: 500,
    };
  }
}
