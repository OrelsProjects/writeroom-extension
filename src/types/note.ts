type NoteId = string;
export type NoteStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "published"
  | "failed";

export interface NoteDraftImage {
  id: string;
  url: string;
}

export interface Note {
  id: NoteId;
  scheduleId: string;
  thumbnail?: string;
  body: string;
  jsonBody?: any[];
  createdAt: Date;
  authorId: number | null;
  name?: string;
  handle?: string;
  status: NoteStatus | "inspiration";
  feedbackComment?: string;
  authorName: string;
  isArchived?: boolean;
  scheduledTo?: Date | null;
  wasSentViaSchedule: boolean;
  attachments?: NoteDraftImage[] | null;
}
