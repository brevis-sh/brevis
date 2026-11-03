import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Shell } from "./shell";
import HomeRoute from "./routes/home";
import ProjectsRoute from "./routes/projects";
import { lazyRoute } from "./ui/lazy-route";
import "./styles.css";

const CatalogRoute = lazyRoute(() => import("./routes/catalog"));
const EndpointsRoute = lazyRoute(() => import("./routes/endpoints"));
const EndpointRoute = lazyRoute(() => import("./routes/endpoint"));

// Data stays fresh for 5s: moving between screens does not refetch what was
// just read, and a screen that comes back shows the old data while it renews.
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter basename="/app">
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<HomeRoute />} />
            <Route path="projects" element={<ProjectsRoute />} />
            <Route path="data" element={<CatalogRoute />} />
            <Route path="data/target" element={<CatalogRoute />} />
            <Route path="data/endpoints" element={<EndpointsRoute />} />
            <Route path="data/endpoints/:api/:name" element={<EndpointRoute />} />
            <Route path="*" element={<p>Not found.</p>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
