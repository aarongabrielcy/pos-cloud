import { RandomUuidGenerator } from "./id-generator";

describe("RandomUuidGenerator", () => {
  it("generates a well-formed UUID", () => {
    const id = new RandomUuidGenerator().next();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("generates unique IDs across calls", () => {
    const generator = new RandomUuidGenerator();

    expect(generator.next()).not.toBe(generator.next());
  });
});
