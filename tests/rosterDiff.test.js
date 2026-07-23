import { describe, expect, it } from "vitest";
import { computeDiff } from "@/lib/rosterDiff";

function member(overrides) {
  return {
    id: "1000",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    status: "Active",
    classifications: ["Hill Patroller 2020-01-01"],
    address: "123 Main St",
    latitude: 45,
    longitude: -122,
    active: true,
    claimed: false,
    claimedBy: null,
    ...overrides,
  };
}

function csvRow(overrides) {
  return {
    mhspNumber: "1000",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    status: "Active",
    classifications: ["Hill Patroller 2020-01-01"],
    address: "123 Main St",
    ...overrides,
  };
}

describe("computeDiff", () => {
  it("treats an unchanged member as neither new, updated, nor removed", () => {
    const diff = computeDiff([csvRow()], [member()]);
    expect(diff.newMembers).toEqual([]);
    expect(diff.updated).toEqual([]);
    expect(diff.deactivated).toEqual([]);
    expect(diff.renames).toEqual([]);
  });

  it("detects a field-level update for a member whose MHSP# is unchanged", () => {
    const diff = computeDiff(
      [csvRow({ status: "Not Finished" })],
      [member({ status: "Active" })]
    );
    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0].changes.status).toEqual({ old: "Active", new: "Not Finished" });
  });

  it("treats a row with a genuinely new MHSP# and no identity match as a new member", () => {
    const diff = computeDiff(
      [csvRow({ mhspNumber: "2000", email: "brand.new@example.com" })],
      []
    );
    expect(diff.newMembers).toHaveLength(1);
    expect(diff.newMembers[0].id).toBe("2000");
    expect(diff.renames).toEqual([]);
  });

  it("deactivates an active member missing from the CSV with no identity match", () => {
    const diff = computeDiff([], [member()]);
    expect(diff.deactivated).toHaveLength(1);
    expect(diff.deactivated[0].id).toBe("1000");
    expect(diff.renames).toEqual([]);
  });

  it("matches a same-import MHSP# change by last name + email, not name alone", () => {
    // Old number disappears from the CSV, new number appears, in the same import —
    // the case the original name-only heuristic already handled.
    const diff = computeDiff(
      [csvRow({ mhspNumber: "9000", classifications: ["Hill Patroller 2026-01-01"] })],
      [member({ id: "1000" })]
    );
    expect(diff.renames).toHaveLength(1);
    expect(diff.renames[0]).toMatchObject({ oldId: "1000", newId: "9000" });
    expect(diff.newMembers).toEqual([]);
    expect(diff.deactivated).toEqual([]);
  });

  it("matches an MHSP# change across import runs via an already-inactive doc", () => {
    // This is the actual production bug: the old doc was already orphaned
    // (active: false) by an earlier, separate import before the new number ever
    // showed up. The candidate pool must still find it.
    const oldDoc = member({ id: "1000", active: false, claimed: true, claimedBy: "uid-1" });
    const diff = computeDiff(
      [csvRow({ mhspNumber: "9000" })],
      [oldDoc] // no active docs at all — old is already inactive from a prior run
    );
    expect(diff.renames).toHaveLength(1);
    expect(diff.renames[0]).toMatchObject({
      oldId: "1000",
      newId: "9000",
      hasClaim: true,
      claimedBy: "uid-1",
    });
  });

  it("does not match rows with a blank email", () => {
    const diff = computeDiff(
      [csvRow({ mhspNumber: "9000", email: "" })],
      [member({ id: "1000", email: "" })]
    );
    expect(diff.renames).toEqual([]);
    expect(diff.newMembers).toHaveLength(1);
    expect(diff.deactivated).toHaveLength(1);
  });

  it("does not match across different last names even with the same email", () => {
    const diff = computeDiff(
      [csvRow({ mhspNumber: "9000", lastName: "Smith" })],
      [member({ id: "1000", lastName: "Doe" })]
    );
    expect(diff.renames).toEqual([]);
    expect(diff.newMembers).toHaveLength(1);
    expect(diff.deactivated).toHaveLength(1);
  });

  it("flags ambiguous when multiple existing records share the same identity", () => {
    const diff = computeDiff(
      [csvRow({ mhspNumber: "9000" })],
      [
        member({ id: "1000" }),
        member({ id: "1001" }),
      ]
    );
    expect(diff.ambiguous).toHaveLength(1);
    expect(diff.ambiguous[0].candidates.map(c => c.id).sort()).toEqual(["1000", "1001"]);
    expect(diff.renames).toEqual([]);
    // Neither the new row nor either old candidate is "claimed" by the ambiguous
    // match (nothing is committed automatically), so — same as the pre-existing
    // ambiguous behavior this preserves — they still surface in their respective
    // new/deactivated buckets too. The review UI blocks "Confirm Import" whenever
    // any ambiguous entries exist, regardless of what else is in those buckets.
    expect(diff.newMembers.map(m => m.id)).toEqual(["9000"]);
    expect(diff.deactivated.map(d => d.id).sort()).toEqual(["1000", "1001"]);
  });

  it("never treats a dual-listed row (present in both old and new CSV) as a rename source", () => {
    // Old ID is still present in the CSV (unchanged) *and* a coincidentally
    // identity-matching new row also appears — the old doc must stay on its own
    // direct-match path, not get consumed as a rename source for the other row.
    const diff = computeDiff(
      [csvRow({ mhspNumber: "1000" }), csvRow({ mhspNumber: "9000" })],
      [member({ id: "1000" })]
    );
    expect(diff.renames).toEqual([]);
    expect(diff.newMembers).toHaveLength(1);
    expect(diff.newMembers[0].id).toBe("9000");
    expect(diff.updated).toEqual([]);
  });
});
