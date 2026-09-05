import { describe, expect, it } from "vitest";
import { configFromEnv, isAllowed, roleFor } from "../src/allowlist.js";

describe("allowlist", () => {
  const config = configFromEnv({
    ADMIN_TELEGRAM_IDS: "111",
    PARENT_TELEGRAM_IDS: "111, 222",
    HELPER_TELEGRAM_IDS: "333",
  });

  it("parses ids and treats admin as parent", () => {
    expect(config.adminIds).toEqual([111]);
    expect(config.parentIds).toEqual([111, 222]);
    expect(config.helperIds).toEqual([333]);
  });

  it("allows only listed family members", () => {
    expect(isAllowed(config, 111)).toBe(true);
    expect(isAllowed(config, 333)).toBe(true);
    expect(isAllowed(config, 999)).toBe(false);
  });

  it("resolves roles", () => {
    expect(roleFor(config, 111)).toBe("admin");
    expect(roleFor(config, 222)).toBe("parent");
    expect(roleFor(config, 333)).toBe("helper");
    expect(roleFor(config, 999)).toBeNull();
  });

  it("allows everyone as admin when no ids are configured yet", () => {
    const open = configFromEnv({});
    expect(isAllowed(open, 424242)).toBe(true);
    expect(roleFor(open, 424242)).toBe("admin");
  });
});
