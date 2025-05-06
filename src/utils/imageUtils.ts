// src/utils/imageUtils.ts
import { log, logError } from "./logger";

// Interface for Substack image returned from API
export interface NoteDraftImage {
  id: string;
  url: string;
}

// Interface for Substack image response
interface SubstackImageResponse {
  id: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  explicit: boolean;
}

/**
 * Download an image from a URL and return it as Uint8Array
 * @param url URL of the image to download
 * @returns Promise resolving to Uint8Array of image data or null if failed
 */
export async function downloadImage(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const responseText = await response.text();
      logError(
        `Failed to fetch image from ${url}, got status: ${response.status}, response: ${responseText}`
      );
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    logError(`Error downloading image from ${url}:`, error);
    return null;
  }
}

/**
 * Upload an image to Substack
 * @param image Image data as Uint8Array
 * @param userId User ID
 * @param noteId Note ID
 * @returns Promise resolving to the uploaded image data
 */
export async function uploadImageSubstack(
  image: Uint8Array
): Promise<NoteDraftImage> {
  if (!image) {
    throw new Error("Invalid image data");
  }

  try {
    // Convert image to base64
    const base64 = arrayBufferToBase64(image);
    const dataUri = `data:image/png;base64,${base64}`;

    log("Uploading image to Substack", dataUri);

    // Upload image to Substack
    const uploadImageResponse = await fetch(
      "https://substack.com/api/v1/image",
      {
        headers: {
          "Content-Type": "application/json",
          Referer: "https://substack.com/home",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: JSON.stringify({ image: dataUri }),
        method: "POST",
      }
    );

    if (!uploadImageResponse.ok) {
      const responseText = await uploadImageResponse.text();
      logError(`Failed to upload image to Substack: ${responseText}`);
      throw new Error("Failed to upload image to Substack");
    }

    const data = await uploadImageResponse.json();

    // Get image attachment from Substack
    const getImageResponse = await fetch(
      "https://substack.com/api/v1/comment/attachment",
      {
        headers: {
          "Content-Type": "application/json",
          Referer: "https://substack.com/home",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        method: "POST",
        body: JSON.stringify({ type: "image", url: data.url }),
      }
    );

    const responseText = await getImageResponse.text();
    if (!getImageResponse.ok) {
      logError(`Failed to get image from Substack: ${responseText}`);
      throw new Error("Failed to get image from Substack");
    } else {
      log("Got image from Substack, response:", responseText);
    }

    const imageData: SubstackImageResponse = JSON.parse(responseText);

    // Store the image info
    const noteDraftImage: NoteDraftImage = {
      id: imageData.id,
      url: imageData.imageUrl,
    };

    log(`Image uploaded to Substack: ${noteDraftImage.id}`);
    return noteDraftImage;
  } catch (error) {
    logError("Error uploading image to Substack:", error);
    throw new Error("Failed to upload image to Substack");
  }
}

/**
 * Convert Uint8Array to base64 string
 * @param buffer Uint8Array to convert
 * @returns Base64 string
 */
function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Prepare multiple attachments for a note
 * @param urls Array of image URLs to upload
 * @param userId User ID
 * @param noteId Note ID
 * @returns Promise resolving to array of uploaded images
 */
export async function prepareAttachmentsForNote(
  urls: string[]
): Promise<NoteDraftImage[]> {
  if (!urls || urls.length === 0) {
    return [];
  }

  const maxAttachments = 4;
  const attachmentsToUpload = urls.slice(0, maxAttachments);
  const attachments: NoteDraftImage[] = [];

  log("Uploading attachments", attachmentsToUpload);

  for (const url of attachmentsToUpload) {
    try {
      // Download the image
      const buffer = await downloadImage(url);
      if (!buffer) {
        logError(`Failed to download image from ${url}`);
        continue;
      }

      log("Got buffer! with length", buffer.length);

      // Upload to Substack
      const substackImage = await uploadImageSubstack(buffer);
      attachments.push(substackImage);
    } catch (error) {
      logError(`Error processing attachment from ${url}:`, error);
    }
  }

  return attachments;
}
