import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the definition test introduction", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>행위 정의 판별 테스트<\/title>/i);
  assert.match(html, /이 상황을 가장 잘 표현하는/);
  assert.match(html, /빠른 체험 시작/);
  assert.match(html, /표준 테스트 시작/);
  assert.match(html, /정밀 테스트 시작/);
  assert.match(html, /확정판 · v1\.0\.0/);
  assert.match(html, />54</);
  assert.match(html, />216</);
  assert.doesNotMatch(html, /공개 초안|codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
