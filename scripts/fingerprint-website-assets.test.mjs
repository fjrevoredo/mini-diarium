import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  ASSETS,
  readNormalized,
  rewriteAssetReferences,
  shortHash,
} from "./fingerprint-website-assets.mjs";

const HASHES = { style: "0123abcd", main: "89ef4567" };

const CSS_LF = "body {\n  color: red;\n}\n";
const CSS_CRLF = CSS_LF.replace(/\n/g, "\r\n");

function makeTempRoot(name) {
  const root = join(
    tmpdir(),
    `fingerprint-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(root, { recursive: true });
  return root;
}

function htmlWith(cssRef, jsRef) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    `    <link rel="stylesheet" href="${cssRef}" />`,
    "  </head>",
    "  <body>",
    `    <script src="${jsRef}"></script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

test("shortHash ignores line-ending differences", () => {
  assert.equal(shortHash(Buffer.from(CSS_CRLF, "utf8")), shortHash(Buffer.from(CSS_LF, "utf8")));
});

test("shortHash still distinguishes real content changes", () => {
  assert.notEqual(shortHash(CSS_LF), shortHash(`${CSS_LF}/* trailing */\n`));
});

test("readNormalized of a CRLF file equals readNormalized of its LF equivalent", () => {
  const root = makeTempRoot("normalize");

  try {
    const crlfPath = join(root, "crlf.css");
    const lfPath = join(root, "lf.css");
    writeFileSync(crlfPath, CSS_CRLF);
    writeFileSync(lfPath, CSS_LF);

    assert.deepEqual(readNormalized(crlfPath), readNormalized(lfPath));
    assert.equal(readNormalized(crlfPath).toString("utf8"), CSS_LF);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rewriteAssetReferences fingerprints both the css and the js reference", () => {
  const output = rewriteAssetReferences(htmlWith("/css/style.css", "/js/main.js"), HASHES);

  assert.equal(output, htmlWith("/css/style.0123abcd.css", "/js/main.89ef4567.js"));
});

test("rewriteAssetReferences is idempotent on already-fingerprinted HTML", () => {
  const once = rewriteAssetReferences(htmlWith("/css/style.css", "/js/main.js"), HASHES);
  const twice = rewriteAssetReferences(once, HASHES);

  assert.equal(twice, once);
});

test("rewriteAssetReferences replaces a stale fingerprint with the current one", () => {
  const stale = htmlWith("/css/style.deadbeef.css", "/js/main.deadbeef.js");

  assert.equal(
    rewriteAssetReferences(stale, HASHES),
    htmlWith("/css/style.0123abcd.css", "/js/main.89ef4567.js"),
  );
});

test("rewriteAssetReferences rewrites every occurrence, not just the first", () => {
  const doubled = `${htmlWith("/css/style.css", "/js/main.js")}${htmlWith("/css/style.css", "/js/main.js")}`;
  const output = rewriteAssetReferences(doubled, HASHES);

  assert.equal(output.match(/style\.0123abcd\.css/g).length, 2);
  assert.equal(output.match(/main\.89ef4567\.js/g).length, 2);
  assert.equal(output.includes("/css/style.css"), false);
  assert.equal(output.includes("/js/main.js"), false);
});

test("rewriteAssetReferences throws when a reference is missing", () => {
  assert.throws(
    () => rewriteAssetReferences("<!doctype html><html><body></body></html>", HASHES),
    /Could not find expected pattern/,
  );
});

test("rewriteAssetReferences throws when a fingerprint was not computed", () => {
  assert.throws(
    () => rewriteAssetReferences(htmlWith("/css/style.css", "/js/main.js"), { style: "0123abcd" }),
    /Missing fingerprint for asset: main/,
  );
});

test("ASSETS patterns are stateless across repeated existence checks", () => {
  const html = htmlWith("/css/style.css", "/js/main.js");

  for (const asset of ASSETS) {
    const pattern = new RegExp(asset.htmlPattern.source);
    assert.equal(pattern.test(html), true);
    assert.equal(pattern.test(html), true);
  }
});
