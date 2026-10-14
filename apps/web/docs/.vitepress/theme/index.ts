import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import Fig from "./components/Fig.vue";
import "../figures/figures.css";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Fig", Fig);
  },
} satisfies Theme;
