import { makeAuthenticatedRequest } from "@/utils/request";
import { NoteDraftImage, prepareAttachmentsForNote } from "./imageUtils";
import { Schedule } from "./scheduleUtils";

// API endpoint for schedule triggers
const getScheduleTriggerAPI = (scheduleId: string) =>
  `api/v1/extension/schedule/${scheduleId}/triggered`;
const getScheduleAPI = (scheduleId: string) =>
  `api/v1/extension/schedule/${scheduleId}`;
// const getScheduleTriggerAPI = (scheduleId: string) =>
//   `https://www.writestack.io/api/v1/extension/schedule/${scheduleId}/triggered`;
// const getScheduleAPI = (scheduleId: string) =>
//   `https://www.writestack.io/api/v1/extension/schedule/${scheduleId}`;
// TODO: Make sure that if writestack.io is open, open a new Substack tab to send the post.

// Response from the API when a schedule is triggered
interface ScheduleTriggerResponse {
  jsonBody: any;
  attachmentUrls: string[];
}

// Result of posting to Substack
interface PostToSubstackResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Handle a triggered schedule
 * @param schedule The schedule that was triggered
 * @returns Promise that resolves when the schedule has been handled
 */
export async function handleScheduleTrigger(schedule: Schedule): Promise<void> {
  console.log(`Handling triggered schedule: ${schedule.scheduleId}`);

  try {
    // Notify the API that a schedule has been triggered
    const response = await getSchedule(schedule.scheduleId);
    console.log("getSchedule response", response);
    // If the jsonBody is empty, notify the API of the error
    if (!response || !response.jsonBody) {
      console.error(`Empty body received for schedule: ${schedule.scheduleId}`);
      await notifyScheduleTrigger(schedule, false, "EMPTY_BODY");
      return;
    }

    // Process attachments if any
    let attachments: NoteDraftImage[] = [];
    if (response.attachmentUrls && response.attachmentUrls.length > 0) {
      try {
        console.log("Preparing attachments", response.attachmentUrls);
        attachments = await prepareAttachmentsForNote(response.attachmentUrls);
      } catch (error) {
        console.error(
          `Failed to prepare attachments for schedule ${schedule.scheduleId}:`,
          error
        );
        await notifyScheduleTrigger(
          schedule,
          false,
          "FAILED_TO_PREPARE_ATTACHMENTS",
          String(error)
        );
        return;
      }
    }

    // Post to Substack
    try {
      console.log("Posting to Substack", response.jsonBody);
      const postResult = await postToSubstack({
        jsonBody: response.jsonBody,
        attachmentIds: attachments.map((a) => a.id),
      });
      console.log("Post result", postResult);
      if (postResult.success) {
        await notifyScheduleTrigger(
          { ...schedule, substackNoteId: postResult.data?.id },
          true
        );
        console.log(
          `Successfully posted to Substack for schedule: ${schedule.scheduleId}`
        );
      } else {
        await notifyScheduleTrigger(
          schedule,
          false,
          "FAILED_TO_POST_TO_SUBSTACK",
          postResult.error
        );
        console.error(
          `Failed to post to Substack for schedule ${schedule.scheduleId}:`,
          postResult.error
        );
      }
    } catch (error) {
      console.error(
        `Error posting to Substack for schedule ${schedule.scheduleId}:`,
        error
      );
      await notifyScheduleTrigger(
        schedule,
        false,
        "FAILED_TO_CREATE_NOTE",
        String(error)
      );
    }
  } catch (error) {
    console.error(
      `Error handling schedule trigger for ${schedule.scheduleId}:`,
      error
    );
    await notifyScheduleTrigger(
      schedule,
      false,
      "GENERAL_ERROR",
      String(error)
    );
  }
}

/**
 * Notify the API that a schedule has been triggered
 * @param schedule The schedule that was triggered
 * @returns Promise resolving to the API response
 */
async function getSchedule(
  scheduleId: string
): Promise<ScheduleTriggerResponse | null> {
  try {
    console.log("Getting schedule", scheduleId);
    const schedule = await makeAuthenticatedRequest(
      getScheduleAPI(scheduleId),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      "http://localhost:3000"
    );

    if (!schedule || !schedule.success) {
      console.error(`Error getting schedule ${scheduleId}: ${schedule?.error}`);
      return null;
    }

    return schedule.data;
  } catch (error) {
    console.error(`Error getting schedule ${scheduleId}:`, error);
    throw error;
  }
}

/**
 * Notify the API about the result of a schedule trigger
 * @param schedule The schedule that was triggered
 * @param ok Whether the schedule was successfully handled
 * @param error Error message if not successful
 * @param text Additional error details
 * @returns Promise that resolves when the API has been notified
 */
async function notifyScheduleTrigger(
  schedule: Schedule,
  ok: boolean,
  error?: string,
  text?: string
): Promise<void> {
  try {
    const body: any = {
      ok,
      substackNoteId: schedule.substackNoteId,
    };

    if (!ok && error) {
      body.error = error;
      if (text) {
        body.text = text;
      }
    }

    const response = await makeAuthenticatedRequest(
      getScheduleTriggerAPI(schedule.scheduleId),
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      "http://localhost:3000"
    );

    if (!response || !response.success) {
      console.error(
        `Error notifying API about schedule result: ${response.status} ${response.error}`
      );
    }
  } catch (error) {
    console.error(`Error notifying API about schedule result:`, error);
  }
}

/**
 * Post content to Substack
 * @param body JSON body to post
 * @returns Promise resolving to the result of the post
 */
async function postToSubstack(body: {
  jsonBody: any;
  attachmentIds: string[];
}): Promise<PostToSubstackResult> {
  try {
    // Convert body to string if it's an object
    const requestBody: any = {
      bodyJson: body.jsonBody,
    };
    if (body.attachmentIds.length > 0) {
      requestBody.attachmentIds = body.attachmentIds;
    }
    const bodyContent = JSON.stringify(requestBody);

    const response = await fetch("https://substack.com/api/v1/comment/feed", {
      headers: {
        "content-type": "application/json",
        Referer: "https://substack.com/home",
      },
      body: bodyContent,
      method: "POST",
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.log("Error posting to Substack, response:", responseText);
      return {
        success: false,
        error: `API returned error: ${response.status} ${responseText}`,
      };
    }

    console.log("Posting to Substack, response:", response);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}
