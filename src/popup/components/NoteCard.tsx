import React, { useEffect, useState } from "react";
import { Note } from "@/types/note";
import { sendNoteNow, openRescheduleTab } from "@/utils/scheduleApiService";
import "../../styles/popup.css";
import Tooltip from "./Tooltip";
import { PencilIcon, RefreshCcw, SendIcon, Clock } from "lucide-react";
interface NoteCardProps {
  note: Note;
  scheduleId: string;
  isMissed: boolean;
  onClose: () => void;
  status?: "scheduled" | "sent" | "missed" | "error";
  onNoteSent: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({
  note,
  scheduleId,
  isMissed,
  onClose,
  onNoteSent,
  status = "scheduled",
}) => {
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [alarmExists, setAlarmExists] = useState<boolean | null>(null);
  const [isCheckingAlarm, setIsCheckingAlarm] = useState(true);

  // Determine status if not provided
  const computedStatus = status === "scheduled" && isMissed ? "missed" : status;

  // Check if the alarm exists
  useEffect(() => {
    const checkAlarm = async () => {
      try {
        setIsCheckingAlarm(true);
        // Get all alarms
        const alarms = await chrome.alarms.getAll();
        // Check if there's an alarm with this scheduleId
        const alarm = alarms.find((alarm) => alarm.name === scheduleId);
        setAlarmExists(!!alarm);
      } catch (error) {
        console.error("Error checking alarm:", error);
        setAlarmExists(false);
      } finally {
        setIsCheckingAlarm(false);
      }
    };

    checkAlarm();
  }, [scheduleId]);

  const handleSendNow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSending(true);
    setSendError(null);
    try {
      const success = await sendNoteNow(scheduleId);
      if (!success) {
        setSendError("Failed to send note. Please try again.");
      } else {
        onClose();
      }
    } catch (error) {
      setSendError("An error occurred while sending the note.");
      console.error(error);
    } finally {
      setIsSending(false);
      onNoteSent();
    }
  };

  const handleReschedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    openRescheduleTab(note.id);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Format the time (HH:MM)
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Get the thumbnail or first attachment image
  const getImageUrl = () => {
    if (
      note.attachments &&
      note.attachments.length > 0 &&
      note.attachments[0].url
    ) {
      return note.attachments[0].url;
    }

    return null;
  };

  const imageUrl = getImageUrl();

  // Parse the scheduled time
  const scheduledTime = note.scheduledTo ? new Date(note.scheduledTo) : null;

  // Get status badge tooltip content
  const getStatusTooltip = (status: string) => {
    switch (status) {
      case "scheduled":
        return "This note is scheduled to be sent automatically";
      case "sent":
        return "This note has been sent successfully";
      case "missed":
        return "This note was not sent at its scheduled time";
      case "error":
        return "There was an error with this note";
      default:
        return "";
    }
  };

  return (
    <div className="note-card">
      <div className="note-time">
        <Clock size={18} className="note-time-icon" />
        <span>{formatTime(scheduledTime || new Date())}</span>
        {isMissed && <span className="missed-label">MISSED</span>}
      </div>

      <div className="note-card-row">
        <div className="note-content">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Note thumbnail"
              className="note-image-container"
              onError={handleImageError}
            />
          )}
          <div className="note-body">{note.body || "No content"}</div>
        </div>

        <div className="actions-container">
          {isMissed ? (
            <>
              <button
                onClick={handleSendNow}
                disabled={isSending}
                className="action-button primary"
                title="Send now"
              >
                {isSending ? (
                  <RefreshCcw
                    size={16}
                    className="icon-button icon-button-loading"
                  />
                ) : (
                  <SendIcon size={16} className="icon-button" />
                )}
                Send now
              </button>
              <button
                onClick={handleReschedule}
                className="action-button secondary"
                title="Reschedule"
              >
                <PencilIcon size={16} className="mr-2" /> Edit
              </button>
            </>
          ) : (
            <button
              onClick={handleReschedule}
              className="action-button secondary"
              title="Reschedule"
            >
              <PencilIcon size={16} className="mr-2" /> Edit
            </button>
          )}

          {/* Show additional warning if alarm doesn't exist */}
          {alarmExists === false && !isCheckingAlarm && !isMissed && (
            <Tooltip
              content="This note needs to be rescheduled due to a missing alarm."
              position="bottom"
            >
              <button
                onClick={handleReschedule}
                className="action-button danger"
                title="Reschedule (Missing Alarm)"
              >
                ⚠️ Fix Schedule
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {sendError && <p className="error-text">{sendError}</p>}
    </div>
  );
};

export default NoteCard;
