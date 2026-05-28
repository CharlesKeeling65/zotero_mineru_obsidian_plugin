const LOG_LEVEL_PRIORITY = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
};
function createLogMethod(level, minimumLevel, context, sink) {
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
export function createLogger(options = {}) {
    const minimumLevel = options.level ?? "info";
    const sink = options.sink ?? ((entry) => console.log(entry));
    const context = options.context ?? {};
    return {
        debug: createLogMethod("debug", minimumLevel, context, sink),
        info: createLogMethod("info", minimumLevel, context, sink),
        warn: createLogMethod("warn", minimumLevel, context, sink),
        error: createLogMethod("error", minimumLevel, context, sink),
        child(extraContext) {
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
export const defaultLogger = createLogger({ level: "debug" });
