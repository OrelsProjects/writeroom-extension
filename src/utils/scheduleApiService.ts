import { makeAuthenticatedRequest } from "@/utils/request";
import { Note } from "@/types/note";
import { log, logError } from "./logger";
import { getSchedules } from "./scheduleUtils";
import { handleScheduleTrigger } from "./scheduleTriggerService";
import { PostSubstackNoteResposne } from "@/types/substack-note";

// API endpoint for fetching schedules
const getSchedulesAPI = "api/v1/extension/schedules";

/**
 * Fetch notes by schedule IDs
 * @param scheduleIds Array of schedule IDs to fetch
 * @returns Promise resolving to array of notes
 */
export async function fetchNotesByScheduleIds(): Promise<Note[]> {
  try {
    const { schedules } = await getSchedules();

    // No schedules, return empty array
    if (schedules.length === 0) {
      return [];
    }

    const scheduleIds = schedules.map((schedule) => schedule.scheduleId);

    const response = await makeAuthenticatedRequest(getSchedulesAPI, {
      method: "POST",
      body: JSON.stringify({ scheduleIds }),
    });

    if (!response || !response.success) {
      logError(`Error fetching notes: ${response?.error}`);
      return [];
    }
    return response.data as Note[];
  } catch (error) {
    logError("Error fetching notes:", error);
    return [];
  }
}

/**
 * Send a scheduled note now
 * @param scheduleId ID of the schedule to trigger
 * @returns Promise resolving to boolean indicating success
 */
export async function sendNoteNow(
  scheduleId: string
): Promise<PostSubstackNoteResposne | null> {
  try {
    log(`Sending note now: ${scheduleId}`);
    const { schedules } = await getSchedules();
    const schedule = schedules.find((s) => s.scheduleId === scheduleId);

    if (!schedule) {
      logError(`Schedule not found: ${scheduleId}`);
      return null;
    }

    // Use the schedule trigger service to post to Substack
    const result = await handleScheduleTrigger(schedule, {
      skipCanPostCheck: true,
    });
    if (!result.success) {
      logError(`Error sending note now: ${result.error}`);
      return null;
    }
    return result.data || null;
  } catch (error) {
    logError(`Error sending note now: ${error}`);
    return null;
  }
}

/**
 * Open WriteStack for rescheduling
 * @param noteId ID of the note to reschedule
 */
export function openRescheduleTab(noteId: string): void {
  //   const url = `https://writestack.io/queue/?noteId=${noteId}`;
  // TODO: For local development, use the local host
  const url = `http://localhost:3000/queue/?noteId=${noteId}`;
  chrome.tabs.create({ url });
}
