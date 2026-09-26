import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const handlerSource = readFileSync(path.join(here, "draw_rewrite.js"), "utf8");
const handler = vm.runInNewContext(`${handlerSource}\nhandler`, {});
const redirects = readFileSync(
  path.join(repo, "tests/fixtures/retired-korean-article-redirects.csv"),
  "utf8",
)
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [oldPath, englishPath] = line.split(",");
    return { oldPath, englishPath };
  });

function request(uri, rawQueryString) {
  return {
    uri,
    rawQueryString: () => rawQueryString,
  };
}

test("every retired Korean article redirects to its existing English source", () => {
  assert.equal(redirects.length, 76);
  for (const { oldPath, englishPath } of redirects) {
    const slug = path.basename(englishPath, ".html");
    assert.ok(existsSync(path.join(repo, "content/blog", `${slug}.en.md`)));
    const response = handler({ request: request(oldPath, undefined) });
    assert.equal(response.statusCode, 301, oldPath);
    assert.equal(response.statusDescription, "Moved Permanently", oldPath);
    assert.equal(
      response.headers.location.value,
      `https://www.yopa.page${englishPath}`,
      oldPath,
    );
  }
});

test("redirect preserves the raw query string including duplicates and encoding", () => {
  const query = "source=retirement-check&tag=a&tag=b&next=%2Fko%2Fabout.html";
  const response = handler({
    request: request("/ko/blog/2026-09-23-tokenomics-on-aws-attribution-decisions.html", query),
  });
  assert.equal(response.statusCode, 301);
  assert.equal(
    response.headers.location.value,
    `https://www.yopa.page/blog/2026-09-23-tokenomics-on-aws-attribution-decisions.html?${query}`,
  );
});

test("blog section paths redirect to the English article index", () => {
  assert.ok(existsSync(path.join(repo, "content/articles.md")));
  for (const oldPath of ["/ko/blog", "/ko/blog/"]) {
    const response = handler({ request: request(oldPath, undefined) });
    assert.equal(response.statusCode, 301);
    assert.equal(
      response.headers.location.value,
      "https://www.yopa.page/articles.html",
    );
  }
});

test("retired Korean taxonomy, pagination, and archive routes redirect to English", () => {
  for (const [oldPath, englishPath] of [
    ["/ko/articles.html", "/articles.html"],
    ["/ko/explore", "/explore/"],
    ["/ko/explore/", "/explore/"],
    ["/ko/tags", "/tags/index.html"],
    ["/ko/tags/", "/tags/index.html"],
    ["/ko/tags/index.html", "/tags/index.html"],
    ["/ko/tags/aws.html", "/tags/aws.html"],
    ["/ko/tags/security/page/2/", "/tags/security/page/2/"],
    ["/ko/tags/page/3/index.html", "/tags/page/3/index.html"],
    ["/ko/categories", "/categories/index.html"],
    ["/ko/categories/", "/categories/index.html"],
    ["/ko/categories/aws.html", "/categories/aws.html"],
    ["/ko/categories/aws/page/2/index.html", "/categories/aws/page/2/index.html"],
    ["/ko/page", "/articles.html"],
    ["/ko/page/2/", "/articles.html"],
    ["/ko/page/10/index.html", "/articles.html"],
  ]) {
    const response = handler({ request: request(oldPath, undefined) });
    assert.equal(response.statusCode, 301, oldPath);
    assert.equal(
      response.headers.location.value,
      `https://www.yopa.page${englishPath}`,
      oldPath,
    );
  }
});

test("unrelated Korean routes pass through unchanged", () => {
  for (const uri of [
    "/ko/",
    "/ko/index.html",
    "/ko/index.xml",
    "/ko/about.html",
    "/ko/expeditions/safe-agent-operations.html",
    "/ko/dispatch/confirmed.html",
    "/ko/blogger/example.html",
    "/ko/tagsmith.html",
    "/ko/pages/example.html",
    "/tags/aws.html",
  ]) {
    const incoming = request(uri, undefined);
    assert.equal(handler({ request: incoming }), incoming);
  }
});

test("draw and explore still rewrite to their app indexes", () => {
  for (const [uri, expected] of [
    ["/draw", "/draw/index.html"],
    ["/draw/", "/draw/index.html"],
    ["/explore", "/explore/index.html"],
    ["/explore/", "/explore/index.html"],
  ]) {
    const incoming = request(uri, undefined);
    assert.equal(handler({ request: incoming }), incoming);
    assert.equal(incoming.uri, expected);
  }
});
