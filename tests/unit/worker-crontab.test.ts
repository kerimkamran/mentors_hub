import { describe, expect, it } from "vitest";
import { parseCrontab } from "graphile-worker";
import { crontab, taskList } from "../../worker/index";

describe("worker · recurring jobs", () => {
  it("the crontab parses and every scheduled task is registered", () => {
    const items = parseCrontab(crontab);
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const i of items) expect(Object.keys(taskList)).toContain(i.task);
  });
});
