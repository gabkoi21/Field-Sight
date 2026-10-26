// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const key = "fieldsight_access_token";
const token = (id = "one", exp = Date.now() / 1000 + 900) => `header.${btoa(JSON.stringify({ exp, sub: id }))}.signature`;
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
let fetcher: ReturnType<typeof vi.fn>;
let listeners: Array<[string, EventListenerOrEventListenerObject]>;
let buses: FakeChannel[];
class FakeChannel {
  listener?: (event: { data: unknown }) => void;
  constructor() { buses.push(this); }
  addEventListener(_type: string, fn: (event: { data: unknown }) => void) { this.listener = fn; }
  postMessage(data: unknown) { for (const bus of buses) if (bus !== this) bus.listener?.({ data }); }
}
let queue: Promise<unknown>;
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear();
  listeners = []; buses = []; queue = Promise.resolve();
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation((type, fn, options) => { listeners.push([type, fn]); add(type, fn, options); });
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: (_name: string, _options: unknown, fn: () => unknown) => {
    const result = queue.then(fn); queue = result.catch(() => {}); return result;
  } } });
  fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  for (const [type, fn] of listeners) window.removeEventListener(type, fn);
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function client() { return (await import("./apiClient")).apiClient; }

it("restores cookie-only authentication with one refresh for concurrent calls", async () => {
  const access = token(); fetcher.mockResolvedValueOnce(json({ access_token: access, remember: false })).mockImplementation(() => Promise.resolve(json({ id: "one" })));
  const api = await client();
  await Promise.all([api.restore(), api.restore(), api.restore()]);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  expect(sessionStorage.getItem(key)).toBe(access); expect(localStorage.getItem(key)).toBeNull();
});
it.each([503, 429, "network", "timeout"])("keeps credentials through %s and recovers", async failure => {
  const old = token("old", 0); sessionStorage.setItem(key, old);
  fetcher.mockImplementationOnce(() => {
    if (failure === "network") return Promise.reject(new TypeError("offline"));
    if (failure === "timeout") return Promise.reject(new DOMException("timeout", "AbortError"));
    return Promise.resolve(json({}, failure as number, { "Retry-After": "2" }));
  }).mockResolvedValueOnce(json({ access_token: token(), remember: false })).mockImplementation(() => Promise.resolve(json({ id: "one" })));
  const api = await client();
  const restored = api.restore();
  await vi.advanceTimersByTimeAsync(10);
  expect(sessionStorage.getItem(key)).toBe(old);
  expect(localStorage.getItem("fieldsight_signed_out")).toBeNull();
  await vi.advanceTimersByTimeAsync(3000);
  expect((await restored)?.id).toBe("one");
});
it("bounds retries during a sustained outage and honors long Retry-After", async () => {
  sessionStorage.setItem(key, token("old", 0));
  fetcher.mockResolvedValue(json({}, 429, { "Retry-After": "120" }));
  const api = await client();
  await expect(api.restore()).rejects.toMatchObject({ status: 503 });
  await expect(api.restore()).rejects.toMatchObject({ status: 503 });
  expect(fetcher).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(key)).not.toBeNull();
});
it("invalid refresh clears credentials, while authorization denial preserves them", async () => {
  sessionStorage.setItem(key, token("old", 0)); fetcher.mockResolvedValueOnce(json({}, 403));
  const api = await client(); await expect(api.restore()).rejects.toMatchObject({ status: 403 });
  expect(sessionStorage.getItem(key)).not.toBeNull();
  fetcher.mockResolvedValueOnce(json({}, 401)); expect(await api.restore()).toBeNull();
  expect(sessionStorage.getItem(key)).toBeNull();
});
it("scheduled renewal preserves remembered storage", async () => {
  localStorage.setItem(key, token()); fetcher.mockImplementation(() => Promise.resolve(json({ access_token: token("renewed"), remember: true })));
  await client(); await vi.advanceTimersByTimeAsync(840_001);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  expect(localStorage.getItem(key)).not.toBeNull(); expect(sessionStorage.getItem(key)).toBeNull();
});
it("logout defeats an in-flight refresh and propagates to another tab", async () => {
  sessionStorage.setItem(key, token("old", 0));
  let finish!: (response: Response) => void;
  fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; })).mockResolvedValue(new Response(null, { status: 204 }));
  const first = await client(); vi.resetModules(); const second = await client();
  const restoring = first.restore(); await vi.advanceTimersByTimeAsync(1);
  const logout = second.logout();
  finish(json({ access_token: token(), remember: false })); await restoring; await logout;
  expect(first.hasStoredAccessToken()).toBe(false); expect(second.hasStoredAccessToken()).toBe(false);
  expect(await first.restore()).toBeNull();
});
it("coordinates renewal between two tabs and propagates session-only tokens", async () => {
  sessionStorage.setItem(key, token("old", 0));
  fetcher.mockResolvedValueOnce(json({ access_token: token(), remember: false })).mockImplementation(() => Promise.resolve(json({ id: "one" })));
  const first = await client(); vi.resetModules(); const second = await client();
  await Promise.all([first.restore(), second.restore()]);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  expect(first.hasStoredAccessToken() && second.hasStoredAccessToken()).toBe(true);
  expect(localStorage.getItem(key)).toBeNull();
});
it("never automatically replays a rejected mutation", async () => {
  sessionStorage.setItem(key, token());
  fetcher.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ access_token: token("new"), remember: false }));
  const api = await client();
  await expect(api.queueSync("synthetic")).rejects.toMatchObject({ status: 409 });
  expect(fetcher.mock.calls.filter(([url]) => url.includes("sync-jobs"))).toHaveLength(1);
});
it("rechecks expired sessions after sleep/wake", async () => {
  sessionStorage.setItem(key, token()); fetcher.mockResolvedValue(json({ access_token: token("awake"), remember: false }));
  await client(); vi.setSystemTime(Date.now() + 901_000); window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(1);
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(true);
});

it("aborts a hung refresh at the request timeout and recovers without logout", async () => {
  sessionStorage.setItem(key, token("old", 0));
  fetcher.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  })).mockResolvedValueOnce(json({ access_token: token(), remember: false })).mockImplementation(() => Promise.resolve(json({ id: "one" })));
  const api = await client(); const restored = api.restore();
  await vi.advanceTimersByTimeAsync(12_001);
  expect(sessionStorage.getItem(key)).not.toBeNull(); expect(localStorage.getItem("fieldsight_signed_out")).toBeNull();
  await vi.advanceTimersByTimeAsync(1500); expect((await restored)?.id).toBe("one");
});
it("allows public invitation and health routes without a refresh session", async () => {
  fetcher.mockImplementation(() => Promise.resolve(json({ status: "ok" })));
  const api = await client(); await api.live(); await api.acceptInvitation({ token: "synthetic", full_name: "Synthetic", password: "synthetic" });
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false);
});

it("retries offline server logout before a new sign-in", async () => {
  sessionStorage.setItem(key, token());
  fetcher.mockRejectedValueOnce(new TypeError("offline"));
  const api = await client(); await expect(api.logout()).rejects.toThrow("offline");
  expect(api.hasStoredAccessToken()).toBe(false);
  expect(localStorage.getItem("fieldsight_logout_pending")).toBe("true");
  fetcher.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ access_token: token("new") }));
  await api.login("synthetic", "synthetic", false);
  expect(fetcher.mock.calls.slice(-2).map(([url]) => url)).toEqual(["/api/auth/logout", "/api/auth/login"]);
  expect(localStorage.getItem("fieldsight_logout_pending")).toBeNull();
});
