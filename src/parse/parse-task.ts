export type ParseTaskStatus = "idle" | "running" | "succeeded" | "failed";

export interface ParseTaskState {
  docId: string;
  status: ParseTaskStatus;
  errorMessage?: string;
}
