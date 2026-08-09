import type { Logger as PinoLogger } from "pino";
import { PinoLoggerAdapter } from "./pino-logger.adapter";

function createMockPino() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  } as unknown as PinoLogger;
}

describe("PinoLoggerAdapter", () => {
  it("routes Nest log levels onto the equivalent pino methods", () => {
    const pino = createMockPino();
    const adapter = new PinoLoggerAdapter(pino);

    adapter.log("hello", "MyContext");
    adapter.error("boom", "MyContext");
    adapter.warn("careful", "MyContext");
    adapter.debug("details", "MyContext");
    adapter.verbose("chatty", "MyContext");

    expect(pino.info).toHaveBeenCalledWith({ context: "MyContext" }, "hello");
    expect(pino.error).toHaveBeenCalledWith({ context: "MyContext" }, "boom");
    expect(pino.warn).toHaveBeenCalledWith({ context: "MyContext" }, "careful");
    expect(pino.debug).toHaveBeenCalledWith({ context: "MyContext" }, "details");
    expect(pino.trace).toHaveBeenCalledWith({ context: "MyContext" }, "chatty");
  });
});
