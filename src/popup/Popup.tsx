import React, { useEffect, useState } from "react";
import "../styles/popup.css";
import { Note } from "@/types/note";
import { fetchNotesByScheduleIds } from "@/utils/scheduleApiService";
import { getSchedules, Schedule, deleteSchedule } from "@/utils/scheduleUtils";
import NoteCard from "./components/NoteCard";
import DayDivider from "./components/DayDivider";
import { RefreshCcw, Calendar } from "lucide-react";
import { notifyScheduleTrigger } from "@/utils/scheduleTriggerService";

// Helper to format dates consistently for grouping
const formatDateKey = (date: Date): string => {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
};

const Popup: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grouped data structure
  const [groupedData, setGroupedData] = useState<{
    days: Date[];
    groupedNotes: Record<string, Note[]>;
  }>({
    days: [],
    groupedNotes: {},
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      // Get schedules from storage
      const { schedules } = await getSchedules();
      console.log("Retrieved schedules:", schedules);
      setSchedules(schedules);

      // Fetch notes for these schedules
      const fetchedNotes = await fetchNotesByScheduleIds();
      console.log("Fetched notes:", fetchedNotes);
      setNotes(fetchedNotes);
    } catch (err) {
      console.error("Error fetching notes:", err);
      setError("Failed to load scheduled notes");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);

  // Process and group notes by day whenever notes or schedules change
  useEffect(() => {
    if (notes.length === 0) {
      setGroupedData({
        days: [],
        groupedNotes: {},
      });
      return;
    }

    // Prepare enhanced notes with schedule information
    const enhancedNotes = notes
      .map((note) => {
        const schedule = schedules.find((s) => s.scheduleId === note.id);

        if (!schedule) {
          console.log(`No schedule found for note: ${note.id}`);
          return note;
        }

        // If note doesn't have scheduledTo, use schedule timestamp
        if (!note.scheduledTo && schedule.timestamp) {
          return {
            ...note,
            scheduleId: schedule.scheduleId,
            scheduledTo: new Date(schedule.timestamp),
          };
        }

        return {
          ...note,
          scheduleId: schedule.scheduleId,
        };
      })
      .filter((note) => note.scheduledTo); // Keep only notes with a scheduled date

    console.log("Enhanced notes:", enhancedNotes.length);

    // Group notes by day
    const notesByDay: Record<string, Note[]> = {};
    const daySet = new Set<string>();

    enhancedNotes.forEach((note) => {
      if (note.scheduledTo) {
        const date = new Date(note.scheduledTo);
        const dateKey = formatDateKey(date);

        if (!notesByDay[dateKey]) {
          notesByDay[dateKey] = [];
          daySet.add(dateKey);
        }

        notesByDay[dateKey].push(note);
      }
    });

    // Sort notes within each day
    Object.keys(notesByDay).forEach((dateKey) => {
      notesByDay[dateKey].sort((a, b) => {
        if (a.scheduledTo && b.scheduledTo) {
          return (
            new Date(a.scheduledTo).getTime() -
            new Date(b.scheduledTo).getTime()
          );
        }
        return 0;
      });
    });

    // Get array of dates sorted chronologically
    const sortedDays = Array.from(daySet)
      .sort()
      .map((dateKey) => new Date(dateKey));

    console.log("Grouped days:", sortedDays.length);
    console.log("Notes by day:", notesByDay);

    setGroupedData({
      days: sortedDays,
      groupedNotes: notesByDay,
    });
  }, [notes, schedules]);

  // Handle dismissing a note
  const handleDismissNote = async (scheduleId: string) => {
    try {
      await deleteSchedule(scheduleId);
      console.log("Deleted schedule:", scheduleId);
      // Update the schedules list
      const { schedules: updatedSchedules } = await getSchedules();
      setSchedules(updatedSchedules);
      // Remove the note from the list
      setNotes((prev) => prev.filter((note) => note.id !== scheduleId));
    } catch (err) {
      console.error("Error dismissing note:", err);
      throw err;
    }
  };

  // Check if a note is missed (scheduled time is in the past)
  const isNoteMissed = (note: Note): boolean => {
    if (!note.scheduledTo) return false;

    const now = new Date();
    const scheduledDate = new Date(note.scheduledTo);

    // Consider a note missed if its scheduled time is in the past
    return scheduledDate < now;
  };

  const handleCreateNew = () => {
    // Open the create new scheduled note tab
    chrome.tabs.create({ url: "https://www.writestack.io/queue" });
  };

  const handleClearSchedule = async (schedule: Schedule) => {
    try {
      await handleDismissNote(schedule.scheduleId);
      // Notify backend
      await notifyScheduleTrigger(
        schedule,
        true,
        undefined,
        undefined,
        "draft"
      );
    } catch (err) {
      console.error("Error clearing schedule:", err);
      throw err;
    }
  };

  const getSchedule = (note: Note): Schedule | undefined => {
    return schedules.find((s) => s.scheduleId === note.scheduleId);
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1 className="popup-title">
          <Calendar
            size={20}
            style={{ marginRight: "8px", color: "hsl(20 100% 55%)" }}
          />
          Scheduled Notes
        </h1>
        <button className="refresh-button" onClick={fetchData}>
          <RefreshCcw size={16} className="icon-button" />
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : groupedData.days.length === 0 ? (
        <div className="empty-message">
          <div>No scheduled notes found</div>
        </div>
      ) : (
        <div className="notes-container">
          {groupedData.days.map((day) => {
            const dateKey = formatDateKey(day);
            const notesForDay = groupedData.groupedNotes[dateKey] || [];

            return (
              <React.Fragment key={dateKey}>
                <DayDivider date={day} />
                {notesForDay.map((note) => {
                  const schedule = getSchedule(note);
                  if (!schedule) {
                    console.log(`No schedule found for note: ${note.id}`);
                    return null;
                  }
                  return (
                    <NoteCard
                      key={note.id}
                      note={note}
                      schedule={schedule}
                      isMissed={isNoteMissed(note)}
                      onClose={() => handleDismissNote(schedule.scheduleId)}
                      onClearSchedule={handleClearSchedule}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div className="create-new-button-container">
        <button onClick={handleCreateNew} className="create-new-button">
          <Calendar size={20} />
          Create New Scheduled Note
        </button>
      </div>
    </div>
  );
};

export default Popup;
