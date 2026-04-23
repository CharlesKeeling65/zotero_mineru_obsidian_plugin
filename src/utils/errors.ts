export type AppErrorCode =
  | "plugin_bootstrap_failed"
  | "parse_failed"
  | "export_failed"
  | "zotero_selection_failed"
  | "invalid_state"
  | "unknown_error";

export interface AppErrorOptions {
  code: AppErrorCode;
  message: string;
  userMessage: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly userMessage: string;
  public readonly details?: Record<string, unknown>;
  public readonly cause?: unknown;

  public constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.userMessage = options.userMessage;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export interface ToAppErrorOptions {
  fallbackCode?: AppErrorCode;
  userMessage?: string;
  details?: Record<string, unknown>;
}

export function toAppError(
  error: unknown,
  options: ToAppErrorOptions = {}
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError({
      code: options.fallbackCode ?? "unknown_error",
      message: error.message,
      userMessage: options.userMessage ?? "An unexpected error occurred.",
      details: options.details,
      cause: error
    });
  }

  return new AppError({
    code: options.fallbackCode ?? "unknown_error",
    message: "Unknown non-Error failure.",
    userMessage: options.userMessage ?? "An unexpected error occurred.",
    details: options.details,
    cause: error
  });
}
