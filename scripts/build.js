// scripts/build.js
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const isProd = args.includes("--env") && args.includes("production");

const manifestPath = path.resolve("public/manifest.json");
const outputProdManifestPath = path.resolve("public/manifest-production.json");
const apiPath = path.resolve("src/utils/api.ts");
let apiContent = fs.readFileSync(apiPath, "utf-8");

const raw = fs.readFileSync(manifestPath, "utf-8");
const manifest = JSON.parse(raw);

// Only generate cleaned version in prod mode
if (isProd) {
  if (manifest.name.endsWith("-dev")) {
    manifest.name = manifest.name.replace("-dev", "");
  }
  

  manifest.host_permissions = [
    "https://*.substack.com/*",
    "https://*.writeroom.co/*",
    "https://*.writestack.io/*",
    "https://writeroom-app-dev.s3.us-east-1.amazonaws.com/*",
  ];

  manifest.externally_connectable = {
    matches: [
      "https://*.writeroom.co/*",
      "https://*.writestack.io/*",
      "https://*.substack.com/*",
    ],
  };
  apiContent = apiContent.replace(
    /(export const API_BASE_URL = "http:\/\/localhost:3000";)/g,
    "// $1"
  );

  // Uncomment the writestack line
  apiContent = apiContent.replace(
    /\/\/\s*export const API_BASE_URL = "https:\/\/www\.writestack\.io";/g,
    'export const API_BASE_URL = "https://www.writestack.io";'
  );

  fs.writeFileSync(apiPath, apiContent);
  fs.writeFileSync(outputProdManifestPath, JSON.stringify(manifest, null, 2));
  console.log("✅ Created manifest-production.json");
}
