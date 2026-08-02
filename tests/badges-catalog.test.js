import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BADGES, BADGE_IDS, badgeById, badgeImagePath } from "@/lib/badges/catalog";

const BADGE_IMAGE_DIR = join(process.cwd(), "public", "assets", "badges");
const REQUIRED_FIELDS = [
  "id",
  "name",
  "description",
  "earnedDescription",
  "image",
  "category",
  "awardMode",
  "hidden",
  "version",
];
const VALID_AWARD_MODES = ["event", "lazy", "manual"];

describe("badge catalog", () => {
  it("has no duplicate ids", () => {
    expect(new Set(BADGE_IDS).size).toBe(BADGE_IDS.length);
  });

  it("has no duplicate image filenames outside the documented rider/driver shares", () => {
    // picking-favorites-rider, favorited-rider, and everybodys-favorite-rider
    // intentionally reuse their driver-favorite counterpart's art indefinitely
    // (issue #167 scoped custom illustration to High-5 Rider only).
    const KNOWN_SHARED_IMAGES = new Set([
      "picking-favorites-badge.png",
      "favorited-badge.png",
      "everybodys-favorite-badge.png",
    ]);
    const images = BADGES.map((b) => b.image).filter((image) => !KNOWN_SHARED_IMAGES.has(image));
    expect(new Set(images).size).toBe(images.length);
  });

  it.each(BADGES)("$id has every required field", (badge) => {
    for (const field of REQUIRED_FIELDS) {
      expect(badge, `missing "${field}"`).toHaveProperty(field);
    }
  });

  it.each(BADGES)("$id has a valid awardMode", (badge) => {
    expect(VALID_AWARD_MODES).toContain(badge.awardMode);
  });

  it.each(BADGES)("$id's image file exists in public/assets/badges", (badge) => {
    const path = join(BADGE_IMAGE_DIR, badge.image);
    expect(existsSync(path), `missing file: ${path}`).toBe(true);
  });

  it("badgeById finds a badge by id", () => {
    expect(badgeById("registered")?.name).toBe("Registered");
    expect(badgeById("does-not-exist")).toBeUndefined();
  });

  it("badgeImagePath returns the public URL for a badge", () => {
    const badge = badgeById("registered");
    expect(badgeImagePath(badge)).toBe("/assets/badges/registered-badge.png");
  });
});
