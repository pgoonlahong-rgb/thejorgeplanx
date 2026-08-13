import { describe, expect, it } from "vitest";
import { visibleEquipment, visibleProject } from "./routers";

describe("detail response visibility", () => {
  it("keeps planBook available for project details", () => {
    const row = { id: 1, projectName: "โครงการตัวอย่าง", planBook: "เล่มที่ 4" };
    expect(visibleProject(row)).toMatchObject({ id: 1, planBook: "เล่มที่ 4" });
  });

  it("keeps planBook available for equipment details", () => {
    const row = { id: 2, equipmentName: "ครุภัณฑ์ตัวอย่าง", planBook: "เล่มที่ 2" };
    expect(visibleEquipment(row)).toMatchObject({ id: 2, planBook: "เล่มที่ 2" });
  });
});
