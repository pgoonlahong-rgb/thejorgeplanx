import { describe, expect, it } from "vitest";

const expectedTitle = "ระบบสืบค้นข้อมูลแผนพัฒนาท้องถิ่น 2566-2570 และที่เพิ่มเติม";

describe("site title configuration", () => {
  it("exposes the configured title in the lightweight HTML endpoint", async () => {
    expect(process.env.VITE_APP_TITLE).toBe(expectedTitle);
    const response = await fetch("http://127.0.0.1:3000/");
    expect(response.ok).toBe(true);
    const html = await response.text();
    expect(html).toContain(`<title>${expectedTitle}</title>`);
  });
});
