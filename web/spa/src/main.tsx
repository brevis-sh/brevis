import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Shell } from "./shell";
import ProjectsRoute from "./routes/projects";
import "./styles.css";

// Screens load on their own, so the first paint pays for the shell alone.
const OverviewRoute = lazy(() => import("./routes/overview"));
const RunsRoute = lazy(() => import("./routes/runs"));

// Data stays fresh for 5s: moving between screens does not refetch what was
// just read, and a screen that comes back shows the old data while it renews.
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter basename="/app">
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Suspense><OverviewRoute /></Suspense>} />
            <Route path="runs" element={<Suspense><RunsRoute /></Suspense>} />
            <Route path="projects" element={<ProjectsRoute />} />
            <Route path="*" element={<p>Not found.</p>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
