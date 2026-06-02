const baseUrl = process.env.LHCI_BASE_URL ?? process.env.CYPRESS_BASE_URL ?? "http://localhost:3000";
const productId = process.env.LHCI_PRODUCT_ID ?? "20000000-0000-4000-8000-000000000001";

function makeUrl(path) {
  return new URL(path, baseUrl).toString();
}

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      url: [makeUrl("/"), makeUrl(`/product/${productId}`)],
      settings: {
        chromeFlags: "--headless=new --no-sandbox --disable-dev-shm-usage",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
