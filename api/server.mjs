// Vercel Node.js Function wrapping the TanStack Start SSR fetch handler.
// The SSR build is emitted at dist/server/server.js by `npm run build`.
// We use the Node.js (req, res) signature because Vercel's Web-standard
// Request occasionally has a path-only URL, which breaks h3/srvx URL parsing.
import server from "../dist/server/server.js";

export const config = {
  runtime: "nodejs",
};

function buildRequest(req) {
  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.socket && req.socket.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = new URL(req.url || "/", `${proto}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (value != null) {
      headers.set(key, String(value));
    }
  }

  const method = req.method || "GET";
  const init = { method, headers };

  if (method !== "GET" && method !== "HEAD") {
    init.body = req;
    init.duplex = "half";
  }

  return new Request(url.toString(), init);
}

export default async function handler(req, res) {
  try {
    const request = buildRequest(req);
    const response = await server.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!response.body) {
      res.end();
      return;
    }

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error("[api/server] handler error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
}
