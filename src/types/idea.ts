
export enum IdeaStatus {
  NO_OUTLINE = "noOutline",
  NEW = "new",
  USED = "used",
  ARCHIVED = "archived",
}

export enum AIUsageType {
  IDEA_GENERATION = "ideaGeneration",
  TEXT_ENHANCEMENT = "textEnhancement",
  TITLE_OR_SUBTITLE_REFINEMENT = "titleOrSubtitleRefinement",
}

export interface Idea {
  id: string;
  publicationId: string | null;
  userId: string;
  topic: string | null;

  title: string;
  subtitle: string;
  description: string;
  outline: string;
  inspiration: string;
  search: boolean;
  image: string | null;
  didUserSee: boolean;
  body: string;
  bodyHistory: string[];
  status: string;
  isFavorite: boolean;
  modelUsedForIdeas: string;
  modelUsedForOutline: string;
  createdAt: Date;
  updatedAt: Date;
}
