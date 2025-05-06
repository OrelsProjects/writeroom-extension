// src/utils/scheduleUtils.ts
import { log, logError } from "./logger";

export type ScheduleStatus = "scheduled" | "sent" | "missed" | "error";

// Schedule data interface
export interface Schedule {
  scheduleId: string;
  userId: string;
  timestamp: number;
  noteId?: string;
  substackNoteId?: string;
  isProcessing?: boolean;
  status?: ScheduleStatus;
  error?: string;
}

export interface Alarm {
  name: string;
  scheduledTime: number;
  periodInMinutes?: number | undefined;
}
// Storage key for schedules
const SCHEDULES_STORAGE_KEY = "writestack_schedules";

/**
 * Create a new schedule
 * @param scheduleId Unique identifier for the schedule
 * @param userId User identifier
 * @param timestamp Unix timestamp when the schedule should trigger
 * @returns Promise resolving to the created schedule
 */
export async function createSchedule(schedule: {
  scheduleId: string;
  noteId?: string;
  userId: string;
  timestamp: number;
}): Promise<Schedule> {
  // Validate parameters
  if (!schedule.scheduleId || !schedule.userId || !schedule.timestamp) {
    throw new Error("Invalid schedule parameters");
  }

  const { scheduleId, noteId, userId, timestamp } = schedule;

  // Get existing schedules
  const { schedules } = await getSchedules();

  // Check if schedule with same ID already exists
  const scheduleExists = schedules.some(
    (schedule) => schedule.scheduleId === scheduleId
  );
  if (scheduleExists) {
    throw new Error(`Schedule with ID ${scheduleId} already exists`);
  }

  // Create new schedule
  const newSchedule: Schedule = {
    scheduleId,
    userId,
    timestamp,
    noteId,
    status: "scheduled",
  };

  // Add schedule to storage
  const updatedSchedules = [...schedules, newSchedule];
  await saveSchedules(updatedSchedules);

  // Create an alarm for this schedule
  await createAlarmForSchedule(newSchedule);

  log(
    `Schedule created: ${scheduleId} at ${new Date(timestamp).toISOString()}`
  );

  const allAlarms = await chrome.alarms.getAll();
  log("All alarms", allAlarms);

  return newSchedule;
}

/**
 * Delete a schedule by ID
 * @param scheduleId ID of the schedule to delete
 * @returns Promise resolving to boolean indicating success
 */
export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  // Get existing schedules
  const { schedules } = await getSchedules();
  console.log("About to delete schedule", scheduleId);

  // Filter out the schedule to delete
  const updatedSchedules = schedules.filter(
    (schedule) => schedule.scheduleId !== scheduleId
  );

  // Delete the alarm for this schedule
  try {
    await chrome.alarms.clear(scheduleId);
  } catch (error) {
    logError(`Failed to clear alarm for schedule ${scheduleId}:`, error);
  }

  console.log("Updated schedules", updatedSchedules);

  // Save updated schedules
  await saveSchedules(updatedSchedules);
  log(`Schedule deleted: ${scheduleId}`);
  return true;
}

/**
 * Update a schedule
 * @param scheduleId ID of the schedule to update
 * @param schedule Schedule to update
 * @returns Promise resolving to the updated schedule
 */
export async function updateScheduleStatus(
  scheduleId: string,
  status: ScheduleStatus,
  error?: string
): Promise<Schedule | undefined> {
  const { schedules } = await getSchedules();
  const updatedSchedules = schedules.map((s) =>
    s.scheduleId === scheduleId ? { ...s, status, error } : s
  );
  await saveSchedules(updatedSchedules);
  return updatedSchedules.find((s) => s.scheduleId === scheduleId);
}

/**
 * Get all schedules
 * @returns Promise resolving to array of schedules
 */
export async function getSchedules(): Promise<{
  schedules: Schedule[];
  alarms: Alarm[];
}> {
  try {
    const result = await chrome.storage.local.get(SCHEDULES_STORAGE_KEY);
    const schedules = result[SCHEDULES_STORAGE_KEY] || [];
    const alarms = await chrome.alarms.getAll();
    return {
      schedules,
      alarms,
    };
  } catch (error) {
    logError("Failed to get schedules:", error);
    return {
      schedules: [],
      alarms: [],
    };
  }
}

/**
 * Save schedules to storage
 * @param schedules Array of schedules to save
 * @returns Promise that resolves when schedules are saved
 */
export async function saveSchedules(schedules: Schedule[]): Promise<void> {
  try {
    log("Saving schedules", schedules);
    await chrome.storage.local.set({ [SCHEDULES_STORAGE_KEY]: schedules });
  } catch (error) {
    logError("Failed to save schedules:", error);
    throw new Error("Failed to save schedules");
  }
}

/**
 * Create a Chrome alarm for a schedule
 * @param schedule Schedule to create alarm for
 */
async function createAlarmForSchedule(schedule: Schedule): Promise<void> {
  try {
    // Create alarm with schedule ID as name
    log("Creating alarm for schedule", schedule.scheduleId);
    const allAlarms = await chrome.alarms.getAll();
    if (allAlarms.find((a) => a.name === schedule.scheduleId)) {
      log("Alarm already exists for schedule", schedule.scheduleId);
      return;
    }
    chrome.alarms.create(schedule.scheduleId, {
      when: schedule.timestamp,
    });
    // await clearDuplicateAlarms();
    log(
      `Alarm created for schedule ${schedule.scheduleId} at ${new Date(
        schedule.timestamp
      ).toISOString()}`
    );
  } catch (error) {
    logError(
      `Failed to create alarm for schedule ${schedule.scheduleId}:`,
      error
    );
    throw new Error("Failed to create alarm for schedule");
  }
}
