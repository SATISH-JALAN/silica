import { defineConfig } from "vitepress";

const REPO = "https://github.com/SATISH-JALAN/silica";

export default defineConfig({
  title: "Silica",
  description: "Deliverable, bond-backed GPU-hour forwards on Monad. Documentation.",
  lang: "en-US",
  // served by the Next app at /docs: built into apps/web/public/docs before next build
  base: "/docs/",
  outDir: "../public/docs",
  appearance: "force-dark",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: "/docs/emblem.webp" }],
    ["meta", { name: "theme-color", content: "#060504" }],
    ["meta", { property: "og:title", content: "Silica Docs" }],
    ["meta", { property: "og:description", content: "Deliverable, bond-backed GPU-hour forwards on Monad." }],
    ["meta", { property: "og:image", content: "/docs/horizon.webp" }],
  ],
  markdown: { lineNumbers: false, theme: { light: "github-light", dark: "vitesse-dark" } },
  themeConfig: {
    logo: "/emblem.webp",
    siteTitle: "Silica",
    search: { provider: "local" },
    nav: [
      { text: "Guide", link: "/guide/introduction" },
      { text: "Concepts", link: "/concepts/gpu-hour-token" },
      { text: "Architecture", link: "/architecture/overview" },
      { text: "Contracts", link: "/contracts/overview" },
      { text: "Integrations", link: "/integrations/chainlink-cre" },
      { text: "Open app", link: "https://silica-monard.vercel.app", target: "_self" },
    ],
    sidebar: [
      {
        text: "Getting started",
        items: [
          { text: "Introduction", link: "/guide/introduction" },
          { text: "Why Silica", link: "/guide/why-silica" },
          { text: "Quickstart", link: "/guide/quickstart" },
        ],
      },
      {
        text: "Core concepts",
        items: [
          { text: "The GPU-hour token", link: "/concepts/gpu-hour-token" },
          { text: "Series and delivery weeks", link: "/concepts/series" },
          { text: "Bonds and minting", link: "/concepts/bonds-and-minting" },
          { text: "The order book", link: "/concepts/order-book" },
          { text: "Redemption and tickets", link: "/concepts/redemption" },
          { text: "Delivery verification", link: "/concepts/verification" },
          { text: "Slashing and disputes", link: "/concepts/slashing-and-disputes" },
          { text: "Mark and margin", link: "/concepts/mark-and-margin" },
          { text: "Reputation and bond ratios", link: "/concepts/reputation" },
        ],
      },
      {
        text: "Architecture",
        items: [
          { text: "System overview", link: "/architecture/overview" },
          { text: "Lifecycle of an hour", link: "/architecture/lifecycle" },
          { text: "Data flow", link: "/architecture/data-flow" },
          { text: "Trust and security model", link: "/architecture/trust-model" },
        ],
      },
      {
        text: "Smart contracts",
        collapsed: false,
        items: [
          { text: "Overview and addresses", link: "/contracts/overview" },
          { text: "SeriesRegistry", link: "/contracts/series-registry" },
          { text: "BondVault", link: "/contracts/bond-vault" },
          { text: "RedemptionManager", link: "/contracts/redemption-manager" },
          { text: "DeliveryOracle", link: "/contracts/delivery-oracle" },
          { text: "SilicaBook", link: "/contracts/silica-book" },
          { text: "Tokens and faucet", link: "/contracts/tokens" },
          { text: "SilicaMarkFeed (Kuru)", link: "/contracts/mark-feed" },
        ],
      },
      {
        text: "Integrations",
        items: [
          { text: "Chainlink CRE", link: "/integrations/chainlink-cre" },
          { text: "Envio HyperIndex", link: "/integrations/envio" },
          { text: "Kuru Spot V2", link: "/integrations/kuru" },
        ],
      },
      {
        text: "Services",
        collapsed: true,
        items: [
          { text: "Provider agent", link: "/services/provider-agent" },
          { text: "Buyer probe", link: "/services/buyer-probe" },
          { text: "Market maker", link: "/services/market-maker" },
          { text: "CRE relay", link: "/services/cre-relay" },
        ],
      },
      {
        text: "Using Silica",
        collapsed: true,
        items: [
          { text: "The web app", link: "/app/web-app" },
          { text: "For buyers", link: "/app/buyers" },
          { text: "For providers", link: "/app/providers" },
        ],
      },
      {
        text: "Economics",
        collapsed: true,
        items: [
          { text: "Formulas and worked examples", link: "/economics/formulas" },
          { text: "Liquidity and market formation", link: "/economics/liquidity" },
        ],
      },
      {
        text: "Operations",
        collapsed: true,
        items: [
          { text: "Run it locally", link: "/operations/local" },
          { text: "Deploy to Monad Testnet", link: "/operations/testnet" },
          { text: "Hosting", link: "/operations/hosting" },
          { text: "Configuration reference", link: "/operations/configuration" },
        ],
      },
      {
        text: "Reference",
        collapsed: true,
        items: [
          { text: "Testnet proof", link: "/reference/proof" },
          { text: "Limitations", link: "/reference/limitations" },
          { text: "Roadmap", link: "/reference/roadmap" },
          { text: "FAQ", link: "/reference/faq" },
          { text: "Glossary", link: "/reference/glossary" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: REPO }],
    editLink: { pattern: `${REPO}/edit/main/apps/web/docs/:path`, text: "Edit this page on GitHub" },
    outline: { level: [2, 3], label: "On this page" },
    footer: {
      message: "Testnet only. Simulated parts are labelled. MIT licensed.",
      copyright: "Silica · Real compute. Real possibilities.",
    },
  },
});
