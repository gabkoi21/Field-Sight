// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./LoginPage";
const { login } = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ login }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it.each([["organization_member", "/dashboard"], ["super_admin", "/superadmin"]])("opens the correct dashboard after %s login", async (role, destination) => {
  login.mockResolvedValue({ platform_role: role });
  render(<MemoryRouter initialEntries={["/login"]}><Routes><Route path="/login" element={<LoginPage />} /><Route path={destination} element={<h1>Dashboard destination</h1>} /></Routes></MemoryRouter>);
  fireEvent.focus(screen.getByLabelText("Email or username"));
  fireEvent.change(screen.getByLabelText("Email or username"), { target: { value: "test-user" } });
  fireEvent.focus(screen.getByLabelText("Password"));
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("heading", { name: "Dashboard destination" })).toBeTruthy();
});

it("shows and hides the password without submitting the login form", () => {
  render(<MemoryRouter><LoginPage /></MemoryRouter>);
  const input = screen.getByLabelText("Password") as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "test-password" } });
  expect(input.type).toBe("password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(input.type).toBe("text");
  expect(input.value).toBe("test-password");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(input.type).toBe("password");
  expect(login).not.toHaveBeenCalled();
});
