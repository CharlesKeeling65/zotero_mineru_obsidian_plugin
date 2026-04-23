import { describe, expect, it, vi } from "vitest";

import {
  AppError,
  type AppErrorCode,
  toAppError
} from "../../src/utils/errors.js";
import { createLogger } from "../../src/utils/logger.js";

describe("errors", () => {
  it("preserves explicit typed errors", () => {
    const error = new AppError({
      code: "parse_failed",
      message: "Parse failed.",
      userMessage: "Unable to parse this PDF."
    });

    expect(toAppError(error)).toBe(error);
  });

  it("maps unknown failures into typed internal errors", () => {
    const error = toAppError(new Error("boom"), {
      fallbackCode: "plugin_bootstrap_failed"
    });

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("plugin_bootstrap_failed" satisfies AppErrorCode);
    expect(error.userMessage).toBe("An unexpected error occurred.");
    expect(error.cause).toBeInstanceOf(Error);
  });
});

describe("logger", () => {
  it("filters below-threshold logs and preserves structured context", () => {
    const sink = vi.fn();
    const logger = createLogger({ level: "info", sink, context: { layer: "ui" } });

    logger.debug("hidden");
    logger.info("visible", { event: "panel_open" });
    logger.child({ component: "outline" }).warn("warned");

    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        level: "info",
        message: "visible",
        context: { layer: "ui", event: "panel_open" }
      })
    );
    expect(sink).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        level: "warn",
        message: "warned",
        context: { layer: "ui", component: "outline" }
      })
    );
  });
});
