import { describe, it, expect } from "vitest";
import { MasterDataSchema, TargetEventSchema, ReceiptSchema, CreateInputSchema, LinkInputSchema, contractMessage } from "@/lib/kundivent-contract";

describe("kundivent contract fixtures", () => {
  it("parses master data", () => {
    expect(MasterDataSchema.parse({ contract_version: "v1", categories: [{ id: "c1", name: "Bankett", is_active: true }], planning_areas: [{ id: "p1", name: "Saal", is_active: true }] }).categories).toHaveLength(1);
  });
  it("parses a target event", () => {
    expect(TargetEventSchema.parse({ id: "e1", title: "Beer & Dine", status: "provisional", start_date: "2026-10-01", updated_at: "2026-09-01T10:00:00Z" }).status).toBe("provisional");
  });
  it("parses a receipt", () => {
    const r = ReceiptSchema.parse({ contract_version: "v1", handover_id: "h1", source_event_id: "s1", target_event_id: "e1", target_url: "https://example.ch/events/e1", operation: "create", outcome: "created", completed_at: "2026-09-01T10:00:00Z", target_event_deleted: false });
    expect(r.outcome).toBe("created");
  });
  it("rejects incomplete create input", () => {
    expect(CreateInputSchema.safeParse({ title: "", category_id: "", planning_area_ids: [], start_date: "", all_day: true }).success).toBe(false);
  });
  it("requires times when not all day", () => {
    expect(CreateInputSchema.safeParse({ title: "X", category_id: "c1", planning_area_ids: ["p1"], start_date: "2026-10-01", all_day: false, start_time: null, end_time: null }).success).toBe(false);
  });
  it("validates link input", () => {
    expect(LinkInputSchema.safeParse({ target_event_id: "e1", expected_updated_at: "2026-09-01T10:00:00Z" }).success).toBe(true);
  });
  it("maps error codes to German text", () => {
    expect(contractMessage("cancelled_target")).toMatch(/[A-Za-zÄÖÜäöü]/);
    expect(contractMessage("unknown_code")).toMatch(/fehlgeschlagen/);
  });
});
