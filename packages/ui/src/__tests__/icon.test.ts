import { describe, expect, it } from "vitest";
import { Icon, availableIconNames } from "../Icon/Icon";

describe("Icon", () => {
  it("returns null for an unrecognized icon name", () => {
    expect(Icon({ name: "not-a-real-icon" })).toBeNull();
  });

  it("returns an svg element for every registered icon name", () => {
    for (const name of availableIconNames) {
      const result = Icon({ name });
      expect(result).not.toBeNull();
      expect(result?.props.width).toBe(16);
    }
  });

  it("respects a custom size", () => {
    const result = Icon({ name: availableIconNames[0]!, size: 24 });
    expect(result?.props.width).toBe(24);
    expect(result?.props.height).toBe(24);
  });
});
