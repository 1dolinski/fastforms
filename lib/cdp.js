import WebSocket from "ws";

const DEFAULT_TIMEOUT = 30_000;
const SETTLE_MS = 1000;

// ---------------------------------------------------------------------------
// CDP session — thin wrapper around a single WebSocket to a Chrome target
// ---------------------------------------------------------------------------

class CDPSession {
  constructor(ws) {
    this._ws = ws;
    this._nextId = 0;
    this._pending = new Map();
    this._listeners = new Map();

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if ("id" in msg) {
        const cb = this._pending.get(msg.id);
        if (cb) {
          this._pending.delete(msg.id);
          msg.error ? cb.reject(new Error(msg.error.message)) : cb.resolve(msg.result);
        }
      } else if (msg.method) {
        const fns = this._listeners.get(msg.method);
        if (fns) for (const fn of fns) fn(msg.params);
      }
    });

    ws.on("close", () => {
      for (const { reject } of this._pending.values()) reject(new Error("WebSocket closed"));
      this._pending.clear();
    });
  }

  send(method, params = {}) {
    const id = ++this._nextId;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(fn);
  }

  off(event, fn) {
    const fns = this._listeners.get(event);
    if (!fns) return;
    const idx = fns.indexOf(fn);
    if (idx !== -1) fns.splice(idx, 1);
  }

  close() {
    this._ws.close();
  }
}

async function openSession(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return new CDPSession(ws);
}

// ---------------------------------------------------------------------------
// Page — mirrors the subset of puppeteer's Page API we actually use
// ---------------------------------------------------------------------------

class Page {
  constructor(info, port) {
    this._info = info;
    this._port = port;
    this._session = null;
  }

  url() {
    return this._info.url;
  }

  async _ensureSession() {
    if (!this._session) {
      this._session = await openSession(this._info.webSocketDebuggerUrl);
    }
    return this._session;
  }

  /**
   * Evaluate a function in the page context.
   * Works the same as puppeteer's page.evaluate — pass a function + args,
   * they get serialized and executed in the browser, result comes back.
   */
  async evaluate(fn, ...args) {
    const session = await this._ensureSession();
    const expression = `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(",")})`;
    const { result, exceptionDetails } = await session.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      throw new Error(
        exceptionDetails.text ||
        exceptionDetails.exception?.description ||
        "evaluate failed"
      );
    }
    return result?.value;
  }

  async goto(url, opts = {}) {
    const session = await this._ensureSession();
    await session.send("Page.enable");

    const loaded = new Promise((resolve) => {
      const timer = setTimeout(resolve, opts.timeout || DEFAULT_TIMEOUT);
      const handler = () => {
        clearTimeout(timer);
        session.off("Page.loadEventFired", handler);
        setTimeout(resolve, SETTLE_MS);
      };
      session.on("Page.loadEventFired", handler);
    });

    await session.send("Page.navigate", { url });
    await loaded;
    this._info.url = url;
  }

  async bringToFront() {
    const session = await this._ensureSession();
    await session.send("Page.bringToFront");
  }

  async close() {
    this._dispose();
    try {
      await fetch(`http://127.0.0.1:${this._port}/json/close/${this._info.id}`, { method: "PUT" });
    } catch { /* best effort */ }
  }

  _dispose() {
    if (this._session) {
      this._session.close();
      this._session = null;
    }
  }
}

// ---------------------------------------------------------------------------
// connectChrome — returns a browser-like object
// ---------------------------------------------------------------------------

export async function connectChrome(port = 9222) {
  const base = `http://127.0.0.1:${port}`;

  const res = await fetch(`${base}/json/version`);
  if (!res.ok) throw new Error(`Chrome not responding on port ${port}`);

  const sessions = [];

  return {
    async pages() {
      const res = await fetch(`${base}/json/list`);
      const targets = await res.json();
      return targets
        .filter((t) => t.type === "page")
        .map((t) => {
          const p = new Page(t, port);
          sessions.push(p);
          return p;
        });
    },

    async newPage() {
      const res = await fetch(`${base}/json/new`, { method: "PUT" });
      const target = await res.json();
      const p = new Page(target, port);
      sessions.push(p);
      return p;
    },

    disconnect() {
      for (const p of sessions) p._dispose();
      sessions.length = 0;
    },
  };
}
