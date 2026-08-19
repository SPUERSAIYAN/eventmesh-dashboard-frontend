import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/geist-mono";
import { App } from "./App.tsx";
import { I18nProvider } from "./i18n.tsx";
import "./styles.css";
import "./topology.css";
import "./cluster-reference.css";
import "./topology-experience.css";
import "./alicloud-theme.css";
import "./mock-cluster-experience.css";
import "./storage-cluster-console.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 15_000,
      refetchInterval: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider><App /></I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
