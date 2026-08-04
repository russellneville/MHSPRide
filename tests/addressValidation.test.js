import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { normalizeValidationResult, validateAddress } from "@/lib/addressValidation";

describe("normalizeValidationResult", () => {
  it("confirms an exact, unmodified match", () => {
    const result = normalizeValidationResult({
      verdict: { addressComplete: true, hasUnconfirmedComponents: false, hasReplacedComponents: false },
      address: { formattedAddress: "1600 Amphitheatre Pkwy, Mountain View, CA 94043" },
      geocode: { location: { latitude: 37.422, longitude: -122.084 } },
    });
    expect(result).toEqual({
      status: "confirmed",
      formattedAddress: "1600 Amphitheatre Pkwy, Mountain View, CA 94043",
      latitude: 37.422,
      longitude: -122.084,
    });
  });

  it("flags a corrected address as needing explicit confirmation", () => {
    const result = normalizeValidationResult({
      verdict: { addressComplete: true, hasUnconfirmedComponents: false, hasReplacedComponents: true },
      address: { formattedAddress: "123 Main St, Portland, OR 97201" },
      geocode: { location: { latitude: 45.5, longitude: -122.6 } },
    });
    expect(result.status).toBe("needs-confirmation");
  });

  it("flags an inferred (auto-completed) address as needing explicit confirmation", () => {
    const result = normalizeValidationResult({
      verdict: { addressComplete: true, hasUnconfirmedComponents: false, hasInferredComponents: true },
      address: { formattedAddress: "123 Main St, Portland, OR 97201" },
      geocode: { location: { latitude: 45.5, longitude: -122.6 } },
    });
    expect(result.status).toBe("needs-confirmation");
  });

  it("marks incomplete addresses invalid", () => {
    const result = normalizeValidationResult({
      verdict: { addressComplete: false },
      address: {},
      geocode: {},
    });
    expect(result.status).toBe("invalid");
  });

  it("marks addresses with unconfirmed components invalid even if flagged complete", () => {
    const result = normalizeValidationResult({
      verdict: { addressComplete: true, hasUnconfirmedComponents: true },
    });
    expect(result.status).toBe("invalid");
  });

  it("returns null coordinates/formattedAddress rather than throwing when fields are missing", () => {
    const result = normalizeValidationResult(undefined);
    expect(result).toEqual({ status: "invalid", formattedAddress: null, latitude: null, longitude: null });
  });
});

describe("validateAddress", () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("throws when GOOGLE_MAPS_API_KEY is not set", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    await expect(validateAddress("123 Main St")).rejects.toThrow("GOOGLE_MAPS_API_KEY is not set");
  });

  it("normalizes a successful API response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: {
          verdict: { addressComplete: true, hasUnconfirmedComponents: false, hasReplacedComponents: false },
          address: { formattedAddress: "123 Main St, Portland, OR 97201" },
          geocode: { location: { latitude: 45.5, longitude: -122.6 } },
        },
      }),
    })));

    const result = await validateAddress("123 main st portland or");
    expect(result.status).toBe("confirmed");
    expect(result.latitude).toBe(45.5);
  });

  it("throws with Google's error message when the request fails (e.g. API not enabled)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: { message: "Address Validation API has not been used in project ... or is disabled." } }),
    })));

    await expect(validateAddress("123 Main St")).rejects.toThrow(/disabled/);
  });
});
