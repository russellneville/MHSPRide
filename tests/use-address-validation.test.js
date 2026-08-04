import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("@/lib/firebaseClient", () => ({
  auth: { currentUser: { getIdToken: async () => "test-token" } },
}));

async function loadHook() {
  const { useAddressValidation } = await import("@/hooks/use-address-validation");
  return renderHook(() => useAddressValidation());
}

describe("useAddressValidation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts idle and stays idle when validating an empty string", async () => {
    const { result } = await loadHook();
    expect(result.current.status).toBe("idle");
    await act(async () => { await result.current.validate(""); });
    expect(result.current.status).toBe("idle");
  });

  it("transitions checking -> confirmed on a successful exact-match response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "confirmed", formattedAddress: "123 Main St", latitude: 1, longitude: 2 }),
    })));
    const { result } = await loadHook();
    await act(async () => { await result.current.validate("123 Main St"); });
    await waitFor(() => expect(result.current.status).toBe("confirmed"));
    expect(result.current.result.formattedAddress).toBe("123 Main St");
  });

  it("surfaces a server error as the error state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "Address validation request failed" }),
    })));
    const { result } = await loadHook();
    await act(async () => { await result.current.validate("garbage"); });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Address validation request failed");
  });

  it("ignores a stale response superseded by a newer validate() call", async () => {
    let resolveFirst;
    const first = new Promise(resolve => { resolveFirst = resolve; });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ status: "invalid", formattedAddress: null, latitude: null, longitude: null }),
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = await loadHook();
    let firstCall;
    act(() => { firstCall = result.current.validate("first address"); });
    await act(async () => { await result.current.validate("second address"); });
    await waitFor(() => expect(result.current.status).toBe("invalid"));

    // Resolve the stale first request after the second has already settled —
    // it must not clobber the newer 'invalid' status with 'confirmed'.
    resolveFirst({ ok: true, json: async () => ({ status: "confirmed", formattedAddress: "stale", latitude: 0, longitude: 0 }) });
    await act(async () => { await firstCall; });
    expect(result.current.status).toBe("invalid");
  });

  it("reset() returns to idle and invalidates any in-flight request", async () => {
    let resolveFetch;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { resolveFetch = resolve; })));
    const { result } = await loadHook();

    let pending;
    act(() => { pending = result.current.validate("123 Main St"); });
    await waitFor(() => expect(result.current.status).toBe("checking"));

    act(() => { result.current.reset(); });
    expect(result.current.status).toBe("idle");

    resolveFetch({ ok: true, json: async () => ({ status: "confirmed", formattedAddress: "x", latitude: 1, longitude: 1 }) });
    await act(async () => { await pending; });
    expect(result.current.status).toBe("idle");
  });
});
