export class AppError extends Error {
    code;
    userMessage;
    details;
    cause;
    constructor(options) {
        super(options.message);
        this.name = "AppError";
        this.code = options.code;
        this.userMessage = options.userMessage;
        this.details = options.details;
        this.cause = options.cause;
    }
}
export function toAppError(error, options = {}) {
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
