// src/utils/scheduleUtils.ts

// Schedule data interface
export interface Schedule {
  scheduleId: string;
  userId: string;
  timestamp: number;
  substackNoteId?: string;
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
export async function createSchedule(
  scheduleId: string,
  userId: string,
  timestamp: number
): Promise<Schedule> {
  // Validate parameters
  if (!scheduleId || !userId || !timestamp) {
    throw new Error("Invalid schedule parameters");
  }

  // Get existing schedules
  const existingSchedules = await getSchedules();

  // Check if schedule with same ID already exists
  const scheduleExists = existingSchedules.some(
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
  };

  // Add schedule to storage
  const updatedSchedules = [...existingSchedules, newSchedule];
  await saveSchedules(updatedSchedules);

  // Create an alarm for this schedule
  await createAlarmForSchedule(newSchedule);

  console.log(
    `Schedule created: ${scheduleId} at ${new Date(timestamp).toISOString()}`
  );
  return newSchedule;
}

/**
 * Delete a schedule by ID
 * @param scheduleId ID of the schedule to delete
 * @returns Promise resolving to boolean indicating success
 */
export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  // Get existing schedules
  const existingSchedules = await getSchedules();

  // Filter out the schedule to delete
  const updatedSchedules = existingSchedules.filter(
    (schedule) => schedule.scheduleId !== scheduleId
  );

  // If no schedule was removed, return true
  if (updatedSchedules.length === existingSchedules.length) {
    return true;
  }

  // Delete the alarm for this schedule
  try {
    await chrome.alarms.clear(scheduleId);
    // delete from storage
  } catch (error) {
    console.error(`Failed to clear alarm for schedule ${scheduleId}:`, error);
  }

  // Save updated schedules
  await saveSchedules(updatedSchedules);
  console.log(`Schedule deleted: ${scheduleId}`);
  return true;
}

/**
 * Get all schedules
 * @returns Promise resolving to array of schedules
 */
export async function getSchedules(): Promise<Schedule[]> {
  try {
    const result = await chrome.storage.local.get(SCHEDULES_STORAGE_KEY);
    return result[SCHEDULES_STORAGE_KEY] || [];
  } catch (error) {
    console.error("Failed to get schedules:", error);
    return [];
  }
}

/**
 * Save schedules to storage
 * @param schedules Array of schedules to save
 * @returns Promise that resolves when schedules are saved
 */
async function saveSchedules(schedules: Schedule[]): Promise<void> {
  try {
    console.log("Saving schedules", schedules);
    await chrome.storage.local.set({ [SCHEDULES_STORAGE_KEY]: schedules });
  } catch (error) {
    console.error("Failed to save schedules:", error);
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
    chrome.alarms.create(schedule.scheduleId, {
      when: schedule.timestamp,
    });
    console.log(
      `Alarm created for schedule ${schedule.scheduleId} at ${new Date(
        schedule.timestamp
      ).toISOString()}`
    );
  } catch (error) {
    console.error(
      `Failed to create alarm for schedule ${schedule.scheduleId}:`,
      error
    );
    throw new Error("Failed to create alarm for schedule");
  }
}
