export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: Record<string, unknown>;
  timestamp: string;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

export interface CreateLoggerOptions {
  level?: LogLevel;
  sink?: (entry: LogEntry) => void;
  context?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function createLogMethod(
  level: LogLevel,
  minimumLevel: LogLevel,
  context: Record<string, unknown>,
  sink: (entry: LogEntry) => void
): (message: string, extraContext?: Record<string, unknown>) => void {
  return (message, extraContext = {}) => {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minimumLevel]) {
      return;
    }

    sink({
      level,
      message,
      context: { ...context, ...extraContext },
      timestamp: new Date().toISOString()
    });
  };
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const minimumLevel = options.level ?? "info";
  const sink = options.sink ?? ((entry: LogEntry) => console.log(entry));
  const context = options.context ?? {};

  return {
    debug: createLogMethod("debug", minimumLevel, context, sink),
    info: createLogMethod("info", minimumLevel, context, sink),
    warn: createLogMethod("warn", minimumLevel, context, sink),
    error: createLogMethod("error", minimumLevel, context, sink),
    child(extraContext: Record<string, unknown>): Logger {
      return createLogger({
        level: minimumLevel,
        sink,
        context: { ...context, ...extraContext }
      });
    }
  };
}

/**
 * 默认 logger 实例，方便各模块直接使用。
 *
 * 中文：所有模块可以直接导入 `defaultLogger` 记录日志，
 * 也可以使用 `createLogger` 创建自定义 logger。
 *
 * English: All modules can import `defaultLogger` directly for logging,
 * or use `createLogger` to create custom loggers.
 */
export const defaultLogger: Logger = createLogger({ level: "debug" });
