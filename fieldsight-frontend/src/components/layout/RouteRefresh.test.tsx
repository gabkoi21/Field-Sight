// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RouteContent } from "./RouteContent";
afterEach(cleanup);
it.each([false, true])("handles refresh skeletons with background polling set to %s", async backgroundRefresh => {
  let finish!: (value: string) => void;
  function Page() {
    const query = useQuery({ queryKey: ["refresh-test"], initialData: "Saved data", staleTime: Infinity, meta: { backgroundRefresh }, queryFn: () => new Promise<string>(resolve => { finish = resolve; }) });
    return <><p>{query.data}</p><button onClick={() => void query.refetch()}>Refresh</button></>;
  }
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><MemoryRouter><Routes><Route element={<RouteContent />}><Route path="/" element={<Page />} /></Route></Routes></MemoryRouter></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(client.isFetching()).toBe(1));
  if (!backgroundRefresh) expect(await screen.findByText("Refreshing page data…")).toBeTruthy();
  else expect(screen.queryByText("Refreshing page data…")).toBeNull();
  expect(screen.getByText("Saved data")).toBeTruthy();
  await act(async () => { finish("Updated data"); });
  expect(await screen.findByText("Updated data")).toBeTruthy();
  await waitFor(() => expect(screen.queryByText("Refreshing page data…")).toBeNull());
  client.clear();
});
