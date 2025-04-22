const API_BASE_URL = "https://www.writestack.io";

export async function makeAuthenticatedRequest(
  endpoint: string,
  options: RequestInit = {},
  baseUrl?: string
) {
  try {
    let url = `${baseUrl || API_BASE_URL}/${endpoint}`;
    // replace accidental double \\ with single \
    url = url.replace("\\\\", "\\");
    console.log("Making request", url, options);
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
      console.log("Request failed", response.status, text);
      return {
        success: false,
        error: text,
        status: response.status,
      };
    }

    const json = await response.json();
    console.log("Response json", json);

    return {
      success: true,
      data: json,
      status: response.status,
    };
  } catch (error: any) {
    console.error("Request failed", error);
    return {
      success: false,
      error: error.message,
      status: 500,
    };
  }
}
