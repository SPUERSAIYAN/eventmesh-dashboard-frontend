import { createApp } from "vue";
import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import TDesign from "tdesign-vue-next";
import "tdesign-vue-next/es/style/index.css";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/geist-mono";
import App from "./App.vue";
import router from "./router";
import "./styles/vue-app.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15_000, refetchInterval: 10_000, refetchOnWindowFocus: false }, mutations: { retry: false } } });
createApp(App).use(createPinia()).use(VueQueryPlugin, { queryClient }).use(router).use(TDesign).mount("#app");
