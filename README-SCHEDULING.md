# WriteStack Scheduling API

This document explains how to use the WriteStack scheduling API to schedule Substack posts from your web application.

## Overview

The WriteStack extension provides a scheduling API that allows you to schedule posts to be published on Substack at a future time. The extension handles storage, timing, and execution of these schedules even when your web app is not running.

## Requirements

1. The WriteStack extension must be installed in the user's Chrome browser
2. Your domain must be listed in the extension's `externally_connectable` manifest field
3. The user must be logged into Substack

## How to Use the API

You can communicate with the extension from your web app using Chrome's messaging system. Here's how to do it:

### Checking if the Extension is Available

First, check if the extension is available and active:

```typescript
/**
 * Check if the WriteStack extension is available
 * @returns Promise<boolean> True if the extension is available
 */
export async function checkExtensionAvailability(): Promise<boolean> {
  try {
    // Extension ID - update this with your actual extension ID
    const EXTENSION_ID = "bmkhkeelhgcnpmemdmlfjfndcolhhkaj";
    
    // Send a ping message to the extension
    const response = await new Promise<any>((resolve) => {
      // Set a timeout in case the extension doesn't respond
      const timeout = setTimeout(() => resolve(null), 1000);
      
      try {
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          { type: "PING" },
          (response) => {
            clearTimeout(timeout);
            resolve(response);
          }
        );
      } catch (error) {
        clearTimeout(timeout);
        resolve(null);
      }
    });
    
    return Boolean(response && response.success);
  } catch (error) {
    console.error("Error checking extension availability:", error);
    return false;
  }
}
```

### Creating a Schedule

To create a new schedule:

```typescript
/**
 * Create a schedule for a post
 * @param scheduleId Unique identifier for the schedule
 * @param userId User ID
 * @param timestamp Timestamp when the post should be published
 * @returns Promise with the result
 */
export async function createSchedule(
  scheduleId: string,
  userId: string,
  timestamp: number
): Promise<any> {
  const EXTENSION_ID = "bmkhkeelhgcnpmemdmlfjfndcolhhkaj";
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "API_REQUEST",
        action: "createSchedule",
        params: [scheduleId, userId, timestamp]
      },
      (response) => {
        if (!response || chrome.runtime.lastError) {
          reject(chrome.runtime.lastError || new Error("Failed to create schedule"));
          return;
        }
        
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || "Unknown error"));
        }
      }
    );
  });
}
```

### Deleting a Schedule

To delete an existing schedule:

```typescript
/**
 * Delete a schedule
 * @param scheduleId ID of the schedule to delete
 * @returns Promise<boolean> True if successful
 */
export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  const EXTENSION_ID = "bmkhkeelhgcnpmemdmlfjfndcolhhkaj";
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "API_REQUEST",
        action: "deleteSchedule",
        params: [scheduleId]
      },
      (response) => {
        if (!response || chrome.runtime.lastError) {
          reject(chrome.runtime.lastError || new Error("Failed to delete schedule"));
          return;
        }
        
        if (response.success) {
          resolve(response.data.result);
        } else {
          reject(new Error(response.error || "Unknown error"));
        }
      }
    );
  });
}
```

### Getting All Schedules

To retrieve all existing schedules:

```typescript
/**
 * Get all schedules
 * @returns Promise with array of schedules
 */
export async function getSchedules(): Promise<any[]> {
  const EXTENSION_ID = "bmkhkeelhgcnpmemdmlfjfndcolhhkaj";
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "API_REQUEST",
        action: "getSchedules",
        params: []
      },
      (response) => {
        if (!response || chrome.runtime.lastError) {
          reject(chrome.runtime.lastError || new Error("Failed to get schedules"));
          return;
        }
        
        if (response.success) {
          resolve(response.data.result);
        } else {
          reject(new Error(response.error || "Unknown error"));
        }
      }
    );
  });
}
```

### Uploading Images to Substack

To upload images to Substack for use in posts:

```typescript
/**
 * Upload images to Substack
 * @param imageUrls Array of image URLs to upload
 * @param userId User ID
 * @returns Promise with upload results for each image
 */
export async function uploadImagesToSubstack(
  imageUrls: string[],
  userId: string
): Promise<any> {
  const EXTENSION_ID = "bmkhkeelhgcnpmemdmlfjfndcolhhkaj";
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "API_REQUEST",
        action: "uploadImagesToSubstack",
        params: [imageUrls, userId]
      },
      (response) => {
        if (!response || chrome.runtime.lastError) {
          reject(chrome.runtime.lastError || new Error("Failed to upload images"));
          return;
        }
        
        if (response.success) {
          resolve(response.data.result);
        } else {
          reject(new Error(response.error || "Unknown error"));
        }
      }
    );
  });
}
```

The result will be an array of objects with the following structure:

```typescript
interface ImageUploadResult {
  url: string;       // Original URL of the image
  success: boolean;  // Whether the upload was successful
  attachmentId?: string; // Substack attachment ID if successful
}
```

You can use the `attachmentId` values in your post content when creating Substack posts.

## Schedule Trigger Process

When a schedule is triggered:

1. The extension sends a POST request to `https://www.writestack.io/api/v1/schedule/triggered` with the scheduleId and timestamp.
2. Your API should respond with a JSON body and optional attachment URLs.
3. The extension processes any attachments and posts to Substack.
4. The extension notifies your API of the result.

## API Response Format

Your API at `https://www.writestack.io/api/v1/schedule/triggered` should respond with:

```json
{
  "jsonBody": {
    // The JSON body to post to Substack
    // This will be sent directly to Substack's API
  },
  "attachmentUrls": [
    // Optional array of image URLs to attach to the post
    // The extension will download and upload these to Substack
  ]
}
```

## Error Handling

The extension will notify your API of any errors during the process. Here are the possible error codes:

- `EMPTY_BODY`: The JSON body was empty or invalid
- `FAILED_TO_PREPARE_ATTACHMENTS`: Failed to download or upload the attachments
- `FAILED_TO_CREATE_NOTE`: Failed to create the post on Substack
- `GENERAL_ERROR`: Any other error during the process

## Example Usage

Here's a complete example of how to use the scheduling API in a React component:

```tsx
import { useState, useEffect } from 'react';

function ScheduleManager() {
  const [isExtensionAvailable, setIsExtensionAvailable] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);

  const EXTENSION_ID = "bmkhkeelhgcnpmemdmlfjfndcolhhkaj"; // Update with your extension ID

  useEffect(() => {
    checkExtension();
    loadSchedules();
  }, []);

  async function checkExtension() {
    try {
      const available = await checkExtensionAvailability();
      setIsExtensionAvailable(available);
    } catch (error) {
      console.error("Error checking extension:", error);
      setIsExtensionAvailable(false);
    }
  }

  async function loadSchedules() {
    if (!isExtensionAvailable) return;
    
    setLoading(true);
    try {
      const result = await getSchedules();
      setSchedules(result);
      setError(null);
    } catch (error) {
      console.error("Error loading schedules:", error);
      setError("Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSchedule() {
    // Generate a unique ID for the schedule
    const scheduleId = `schedule_${Date.now()}`;
    // Schedule the post for tomorrow
    const timestamp = Date.now() + (24 * 60 * 60 * 1000);
    // Get the user ID (this is just an example)
    const userId = "example_user_id";
    
    try {
      await createSchedule(scheduleId, userId, timestamp);
      // Reload schedules after creating a new one
      loadSchedules();
    } catch (error) {
      console.error("Error creating schedule:", error);
      setError("Failed to create schedule");
    }
  }

  async function handleDeleteSchedule(scheduleId) {
    try {
      await deleteSchedule(scheduleId);
      // Reload schedules after deleting one
      loadSchedules();
    } catch (error) {
      console.error("Error deleting schedule:", error);
      setError("Failed to delete schedule");
    }
  }
  
  async function handleUploadImages() {
    // Example of uploading images
    const imageUrls = [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ];
    const userId = "example_user_id";
    
    try {
      setLoading(true);
      const results = await uploadImagesToSubstack(imageUrls, userId);
      setUploadedImages(results);
      setError(null);
    } catch (error) {
      console.error("Error uploading images:", error);
      setError("Failed to upload images");
    } finally {
      setLoading(false);
    }
  }

  // Function implementations (same as above)
  async function checkExtensionAvailability() { /* ... */ }
  async function getSchedules() { /* ... */ }
  async function createSchedule(scheduleId, userId, timestamp) { /* ... */ }
  async function deleteSchedule(scheduleId) { /* ... */ }
  async function uploadImagesToSubstack(imageUrls, userId) { /* ... */ }

  if (!isExtensionAvailable) {
    return <div>WriteStack extension is not available. Please install it.</div>;
  }

  return (
    <div>
      <h1>WriteStack Manager</h1>
      
      {error && <div className="error">{error}</div>}
      
      <div>
        <h2>Schedule Post</h2>
        <button onClick={handleCreateSchedule} disabled={loading}>
          Schedule Post for Tomorrow
        </button>
      </div>
      
      <div>
        <h2>Upload Images</h2>
        <button onClick={handleUploadImages} disabled={loading}>
          Upload Sample Images
        </button>
        
        {uploadedImages.length > 0 && (
          <div>
            <h3>Uploaded Images:</h3>
            <ul>
              {uploadedImages.map((img, index) => (
                <li key={index}>
                  {img.url}: {img.success ? `Success (ID: ${img.attachmentId})` : 'Failed'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <div>
        <h2>Existing Schedules</h2>
        
        {loading ? (
          <div>Loading schedules...</div>
        ) : (
          <ul>
            {schedules.map(schedule => (
              <li key={schedule.scheduleId}>
                {new Date(schedule.timestamp).toLocaleString()} - 
                <button onClick={() => handleDeleteSchedule(schedule.scheduleId)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

## Troubleshooting

- **Extension not found**: Make sure the extension is installed and enabled in Chrome.
- **Permission denied**: Ensure your domain is listed in the extension's `externally_connectable` manifest field.
- **API errors**: Check that your API is returning the expected response format.

## Security Considerations

- The extension will only accept messages from domains listed in the `externally_connectable` field.
- The extension does not expose any sensitive user data to your web app.
- All communication between your web app and the extension is protected by Chrome's messaging system.

## Additional Information

- The extension uses Chrome's alarms API for scheduling, which is reliable even if Chrome is minimized.
- Schedules are stored locally in the extension's storage and will persist even if the browser is restarted.
- The extension can handle up to 4 image attachments per post. 