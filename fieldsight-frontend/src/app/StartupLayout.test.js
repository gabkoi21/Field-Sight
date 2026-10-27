import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
it("renders the sidebar before the application bundle loads", () => {
  const dom = new JSDOM(html, {url: "http://localhost/projects/p1/overview", runScripts: "dangerously"});
  expect(dom.window.document.documentElement.hasAttribute("data-startup-workspace")).toBe(true);
  const sidebar = dom.window.document.querySelector(".startup-navigation");
  expect(sidebar.textContent).toContain("Projects");
  expect(sidebar.querySelector('[aria-current="page"]')?.textContent).toBe("Overview");
  expect(sidebar.querySelectorAll("a").length).toBe(9);
  expect(sidebar.querySelector(".startup-skeleton")).toBeNull();
  dom.window.close();
});
it("does not enable the workspace startup frame on public or superadmin pages", () => {
  for (const path of ["/login", "/sign-in", "/account-help", "/accept-invitation", "/superadmin/users"]) {
    const dom = new JSDOM(html, {url: "http://localhost" + path, runScripts: "dangerously"});
    expect(dom.window.document.documentElement.hasAttribute("data-startup-workspace")).toBe(false);
    dom.window.close();
  }
});
