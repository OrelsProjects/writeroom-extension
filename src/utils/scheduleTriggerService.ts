import { makeAuthenticatedRequest } from "@/utils/request";
import { NoteDraftImage, prepareAttachmentsForNote } from "./imageUtils";
import {
  getSchedules,
  saveSchedules,
  Schedule,
  ScheduleStatus,
} from "./scheduleUtils";
import { log, logError } from "./logger";

// API endpoint for schedule triggers
const getScheduleTriggerAPI = (scheduleId: string) =>
  `api/v1/extension/schedule/${scheduleId}/triggered`;
const getScheduleAPI = (scheduleId: string) =>
  `api/v1/extension/schedule/${scheduleId}`;
const canPostScheduledNoteAPI = (scheduleId: string) =>
  `api/v1/extension/schedule/${scheduleId}/can-post`;

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
export async function handleScheduleTrigger(
  schedule: Schedule,
  options: {
    skipCanPostCheck?: boolean;
  } = {}
): Promise<{
  success: boolean;
  status: ScheduleStatus | "processing";
  error?: string;
}> {
  log(`Handling triggered schedule: ${schedule.scheduleId}`);

  const { schedules } = await getSchedules();
  const freshSchedule = schedules.find(
    (s) => s.scheduleId === schedule.scheduleId
  );
  if (!freshSchedule || freshSchedule.isProcessing) {
    log(`Skipping already processing schedule ${schedule.scheduleId}`);
    return {
      success: true,
      status: "processing",
    };
  }
  try {
    // update the schedule as processing
    freshSchedule.isProcessing = true;
    await saveSchedules([
      ...schedules.filter((s) => s.scheduleId !== schedule.scheduleId),
      freshSchedule,
    ]);

    // Notify the API that a schedule has been triggered
    const response = await getSchedule(schedule.scheduleId);
    log("getSchedule response", response);
    // If the jsonBody is empty, notify the API of the error
    if (!response || !response.jsonBody) {
      logError(`Empty body received for schedule: ${schedule.scheduleId}`);
      await notifyScheduleTrigger(schedule, false, "EMPTY_BODY");
      return {
        success: false,
        status: "error",
        error: "The body of the note is empty",
      };
    }

    const canPostResponse =
      options.skipCanPostCheck
        ? {
            success: true,
            data: { canPost: true },
            error: null,
          }
        : await makeAuthenticatedRequest(
            canPostScheduledNoteAPI(schedule.scheduleId),
            {
              method: "POST",
            }
          );
    if (
      !canPostResponse ||
      !canPostResponse.success ||
      !canPostResponse.data.canPost
    ) {
      logError(
        `Error checking if can post scheduled note: ${canPostResponse?.error}`
      );
      await notifyScheduleTrigger(schedule, false, "CANT_POST_ERROR");
      return {
        success: false,
        status: "error",
        error: canPostResponse?.error || "Unknown error",
      };
    }

    // Process attachments if any
    let attachments: NoteDraftImage[] = [];
    if (response.attachmentUrls && response.attachmentUrls.length > 0) {
      try {
        log("Preparing attachments", response.attachmentUrls);
        attachments = await prepareAttachmentsForNote(response.attachmentUrls);
      } catch (error) {
        logError(
          `Failed to prepare attachments for schedule ${schedule.scheduleId}:`,
          error
        );
        await notifyScheduleTrigger(
          schedule,
          false,
          "FAILED_TO_PREPARE_ATTACHMENTS",
          String(error)
        );
        return {
          success: false,
          status: "error",
          error: "Failed to upload attachments",
        };
      }
    }

    // Post to Substack
    try {
      log("Posting to Substack", response.jsonBody);
      const postResult = await postToSubstack({
        jsonBody: response.jsonBody,
        attachmentIds: attachments.map((a) => a.id),
      });
      log("Post result", postResult);
      if (postResult.success) {
        await notifyScheduleTrigger(
          { ...schedule, substackNoteId: postResult.data?.id },
          true
        );
        log(
          `Successfully posted to Substack for schedule: ${schedule.scheduleId}`
        );
        return {
          success: true,
          status: "sent",
        };
      } else {
        await notifyScheduleTrigger(
          schedule,
          false,
          "FAILED_TO_POST_TO_SUBSTACK",
          postResult.error
        );
        logError(
          `Failed to post to Substack for schedule ${schedule.scheduleId}:`,
          postResult.error
        );
        return {
          success: false,
          status: "error",
          error: "Failed to post note to Substack",
        };
      }
    } catch (error) {
      logError(
        `Error posting to Substack for schedule ${schedule.scheduleId}:`,
        error
      );
      await notifyScheduleTrigger(
        schedule,
        false,
        "FAILED_TO_CREATE_NOTE",
        String(error)
      );
      return {
        success: false,
        status: "error",
        error: "Failed to post note to Substack",
      };
    }
  } catch (error) {
    logError(
      `Error handling schedule trigger for ${schedule.scheduleId}:`,
      error
    );
    await notifyScheduleTrigger(
      schedule,
      false,
      "GENERAL_ERROR",
      String(error)
    );
    return {
      success: false,
      status: "error",
      error: "Unknown error",
    };
  } finally {
    // update the schedule as not processing
    freshSchedule.isProcessing = false;
    await saveSchedules([
      ...schedules.filter((s) => s.scheduleId !== schedule.scheduleId),
      freshSchedule,
    ]);
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
    log("Getting schedule", scheduleId);
    const schedule = await makeAuthenticatedRequest(
      getScheduleAPI(scheduleId),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!schedule || !schedule.success) {
      logError(`Error getting schedule ${scheduleId}: ${schedule?.error}`);
      return null;
    }

    return schedule.data;
  } catch (error) {
    logError(`Error getting schedule ${scheduleId}:`, error);
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
      }
    );

    if (!response || !response.success) {
      logError(
        `Error notifying API about schedule result: ${response.status} ${response.error}`
      );
    }
  } catch (error) {
    logError(`Error notifying API about schedule result:`, error);
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
        Origin: "https://substack.com",
      },
      credentials: "include", // Required to send cookies
      body: bodyContent,
      method: "POST",
    });

    if (!response.ok) {
      const responseText = await response.text();
      log("Error posting to Substack, response:", responseText);
      return {
        success: false,
        error: `API returned error: ${response.status} ${responseText}`,
      };
    }

    log("Posting to Substack, response:", response);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}
