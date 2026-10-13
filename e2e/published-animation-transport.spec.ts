import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  fetchPublishedAnimationJson,
  PublishedAnimationTransportError,
} from "../components/character/published-animation-transport";

// VM-created async Promises must be normalized to this realm before Playwright rejects matchers.
type Loaded = { info: { releaseVersion: number; sourceAssetIds: string[] } };
type ProductionLoader = {
  loadPublishedDanceRelease(forceRefresh?: boolean, frozenReleaseVersion?: number): Promise<Loaded | null>;
};

function productionLoaderWith(fetchImpl: typeof fetch): ProductionLoader {
  const path = resolve(process.cwd(), "components/character/published-animation-library.ts");
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const loadBundle = (data: unknown) => {
    const version = Number((data as { releaseVersion: number }).releaseVersion);
    return {
      manifest: {
        status: "published",
        releaseVersion: version,
        normalIds: ["normal-1"],
        finalIds: [],
        idleIds: [],
      },
      clipsByAssetId: new Map([["normal-1", { name: "Dance" }]]),
    };
  };
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    require(id: string) {
      if (id === "three") return {};
      if (id === "./runtime-animation-bundle") return { loadRuntimeAnimationBundle: loadBundle };
      if (id === "../../lib/persistent-asset-cache") {
        return {
          fetchPersistentAsset: (url: string, opts: { request: RequestInit }) =>
            fetchImpl(url, opts.request),
        };
      }
      if (id === "./published-animation-transport") {
        return { fetchPublishedAnimationJson };
      }
      throw new Error("Unexpected loader dependency: " + id);
    },
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { info() {}, warn() {} },
  }, { filename: path });
  return module.exports as unknown as ProductionLoader;
}

function bundleResponse(releaseVersion: number) {
  return new Response(JSON.stringify({ releaseVersion }), {
    headers: { "Content-Type": "application/json" },
  });
}

test("each timed-out request gets a fresh AbortSignal and can retry", async () => {
  const signals: AbortSignal[] = [];
  const result = await fetchPublishedAnimationJson((signal, attempt) => {
    signals.push(signal);
    if (attempt === 0) {
      return new Promise<Response>((_, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    }
    return Promise.resolve(bundleResponse(4));
  }, "release v4", 15);
  expect((result as { releaseVersion: number }).releaseVersion).toBe(4);
  expect(signals).toHaveLength(2);
  expect(signals[0]).not.toBe(signals[1]);
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
});

test("a frozen match fetches its exact release without latest-manifest lookup", async () => {
  const requests: string[] = [];
  const loader = productionLoaderWith(async url => {
    requests.push(String(url));
    return bundleResponse(4);
  });
  const release = await loader.loadPublishedDanceRelease(false, 4);
  expect(release?.info.releaseVersion).toBe(4);
  expect(requests).toEqual([
    expect.stringContaining("?release=4"),
  ]);
  expect(requests[0]).not.toContain("manifest=1");
});

test("an aborted versioned release retries with a new signal and never invents version 0", async () => {
  const signals: AbortSignal[] = [];
  const loader = productionLoaderWith(async (_url, options) => {
    const signal = options?.signal as AbortSignal;
    signals.push(signal);
    if (signals.length === 1) throw new Error("AbortError");
    return bundleResponse(4);
  });
  const release = await loader.loadPublishedDanceRelease(false, 4);
  expect(release?.info.releaseVersion).toBe(4);
  expect(signals).toHaveLength(2);
  expect(signals[0]).not.toBe(signals[1]);
});

test("unavailable frozen release propagates transport error instead of returning null", async () => {
  let calls = 0;
  const loader = productionLoaderWith(async () => {
    calls += 1;
    throw new Error("network aborted");
  });
  await expect(Promise.resolve(loader.loadPublishedDanceRelease(false, 4)))
    .rejects.toThrow(PublishedAnimationTransportError);
  expect(calls).toBe(2);
});

test("wrong pinned release is rejected even if HTTP and JSON succeed", async () => {
  let requests = 0;
  const loader = productionLoaderWith(async () => {
    requests += 1;
    return bundleResponse(5);
  });
  await expect(Promise.resolve(loader.loadPublishedDanceRelease(false, 4)))
    .rejects.toThrow("published animation release mismatch");
  expect(requests).toBe(1);
});

test("optional presentation legacy fallback uses a new signal after manifest errors", async () => {
  const records: { url: string; signal: AbortSignal }[] = [];
  const loader = productionLoaderWith(async (url, options) => {
    const address = String(url);
    records.push({ url: address, signal: options?.signal as AbortSignal });
    if (address.includes("manifest=1")) throw new Error("manifest unavailable");
    return bundleResponse(4);
  });
  const release = await loader.loadPublishedDanceRelease();
  expect(release?.info.releaseVersion).toBe(4);
  expect(records).toHaveLength(3); // two bounded manifest tries + one fresh legacy GET
  expect(records[0].url).toContain("manifest=1");
  expect(records[2].url).not.toContain("manifest=1");
  expect(records[2].signal).not.toBe(records[1].signal);
});

test("pinned release bypasses cached release of another version", async () => {
  const versions: number[] = [];
  const loader = productionLoaderWith(async url => {
    versions.push(Number(new URL(String(url)).searchParams.get("release")));
    return bundleResponse(versions[versions.length - 1]);
  });
  expect((await loader.loadPublishedDanceRelease(false, 5))?.info.releaseVersion).toBe(5);
  expect((await loader.loadPublishedDanceRelease(false, 4))?.info.releaseVersion).toBe(4);
  expect(versions).toEqual([5, 4]);
});

test("permanent 404 for frozen release fails without legacy fallback or retry", async () => {
  let calls = 0;
  const loader = productionLoaderWith(async () => {
    calls += 1;
    return new Response("missing", { status: 404 });
  });
  await expect(Promise.resolve(loader.loadPublishedDanceRelease(false, 4)))
    .rejects.toThrow("HTTP 404");
  expect(calls).toBe(1);
});
