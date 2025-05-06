// scripts/post-build.js
const fs = require("fs");
const path = require("path");

const apiPath = path.resolve("src/utils/api.ts");
let content = fs.readFileSync(apiPath, "utf-8");

// Revert writestack line to commented
content = content.replace(
  /export const API_BASE_URL = "https:\/\/www\.writestack\.io";/,
  '// export const API_BASE_URL = "https://www.writestack.io";'
);

// Uncomment the localhost one
content = content.replace(
  /\/\/\s*export const API_BASE_URL = "http:\/\/localhost:3000";/,
  'export const API_BASE_URL = "http://localhost:3000";'
);

fs.writeFileSync(apiPath, content);
console.log("🔁 Restored API_BASE_URL to localhost:3000");
