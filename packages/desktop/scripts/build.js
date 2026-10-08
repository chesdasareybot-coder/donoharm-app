#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const LOCAL_URL = process.env.LOCAL_URL || "http://localhost:3000";
const CLOUD_URL =
  process.env.CLOUD_URL ||
  (process.env.APP_URL && !process.env.APP_URL.includes("localhost")
    ? process.env.APP_URL
    : "https://chesdasareybot-coder-donoharm-app.vercel.app");

const srcPath = path.join(__dirname, "../src/index.html");

let content = fs.readFileSync(srcPath, "utf-8");
content = content.replace(
  /const LOCAL_URL = ".*";/,
  `const LOCAL_URL = "${LOCAL_URL}";`,
);
content = content.replace(
  /const CLOUD_URL = ".*";/,
  `const CLOUD_URL = "${CLOUD_URL}";`,
);

fs.writeFileSync(srcPath, content);
console.log(
  `Built index.html with LOCAL_URL=${LOCAL_URL}, CLOUD_URL=${CLOUD_URL}`,
);
