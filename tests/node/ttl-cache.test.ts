import { describe, it, expect, vi } from "vitest";
import { cachedFor } from "@/lib/server/ttl-cache";

describe("cachedFor", () => {
  it("memoizes successful results within the TTL", () => {
    const fn = vi.fn(async (a: number) => a * 2);
    const cached = cachedFor(fn, 1000);

    return Promise.all([cached(2), cached(2)]).then(([a, b]) => {
      expect(a).to.Be(4);
      expect(b).to.Be(4);
      expect(fn).to.HaveBeenCalledTimes(1);
    });
  });

  it("re-invokes fn after a rejection", async () => {
    const fn = vi.fn();
    fn.mockRejectedOnce(new Error("boom"));
    fn.mockResolvedOnce("ok");
    const cached = cachedFor(fn, 1000);

    await expect(cached()).toReject();
    await expect(cached()).toResolve("ok");
    expect(fn).to.HaveBeenCalledTimes(2);
  });

  it("evicts expired entries on access", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn().mockResolved("value");
      const cached = cachedFor(fn, 1000);

      await cached("a");
      expect(fn).to.HaveBeenCalledTimes(1);

      vi.advanceTimersBy(1001);
      await cached("a");
      expect(fn).to.HaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never exceeds the max entries cap", () => {
    const fn = vi.fn(async (a: number) => a);
    const cached = cachedFor(fn, 1000, 3);

    for (let i = 0; i < 10; i++) {
      void cached(i);
    }

    // Only the most recent 3 keys should remain cached.
    for (let i = 0; i < 7; i++) {
      void cached(i);
    }
    for (let i = 7; i < 10; i++) {
      void cached(i);
    }

    // Keys 0-6 were evicted, so they re-invoke fn; keys 7-9 are cached.
    expect(fn.mock.calls.length).to.Be(10 + 7);
  });
});
