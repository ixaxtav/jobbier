import "server-only";
import { lookup, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import { Agent, fetch } from "undici";
import { isPrivateAddress } from "./ip";

export { isPrivateAddress };

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;

export class ImportError extends Error {}

/**
 * Every connection this agent opens is checked at connect time: the addresses
 * DNS actually returned are validated right before the socket uses them, so a
 * hostname can't pass a check and then re-resolve to something private.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, "", 0);
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
      return callback(new ImportError("That link points to a private address."), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

const agent = new Agent({ connect: { lookup: guardedLookup, timeout: TIMEOUT_MS } });

/**
 * Fetches a public web page for import. The server makes this request on the
 * user's behalf, so it refuses anything that resolves to a private or local
 * address (no poking at the database, metadata endpoints, localhost…).
 */
export async function fetchPublicPage(input: string): Promise<{ html: string; url: string }> {
  let url = normalizeUrl(input);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowedUrl(url);
    const response = await fetch(url, {
      dispatcher: agent,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Many career sites return an empty shell or a 403 to unknown agents.
        "user-agent": "Mozilla/5.0 (compatible; JobbierBot/1.0; +https://jobbier.vercel.app)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    }).catch((error: unknown) => {
      const cause = error instanceof Error ? (error.cause ?? error) : error;
      if (cause instanceof ImportError) throw cause;
      if (error instanceof Error && error.name === "TimeoutError") throw new ImportError("That page took too long to respond.");
      if ((cause as NodeJS.ErrnoException)?.code === "ENOTFOUND") throw new ImportError("Couldn’t find that website.");
      throw new ImportError("Couldn’t reach that page.");
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new ImportError("That page redirected somewhere unexpected.");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new ImportError(
        response.status === 403 || response.status === 429
          ? "That site blocks automatic reading. Fill in the details by hand."
          : `That page answered with an error (${response.status}).`,
      );
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) {
      await response.body?.cancel();
      throw new ImportError("That link isn’t a web page.");
    }

    return { html: await readLimited(response.body as ReadableStream<Uint8Array> | null), url: url.toString() };
  }
  throw new ImportError("That page redirected too many times.");
}

export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new ImportError("That doesn’t look like a link.");
  }
  assertAllowedUrl(url);
  return url;
}

/** Checked for the first URL and again after every redirect. */
function assertAllowedUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ImportError("Only http and https links work.");
  if (url.username || url.password) throw new ImportError("Links with passwords in them aren’t supported.");
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) throw new ImportError("That link uses an unusual port.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || /\.(localhost|internal|local|lan|home|corp)$/i.test(host)) {
    throw new ImportError("That link points to a private address.");
  }
  // IP literals skip DNS (and so skip the connect-time check): validate them here.
  if (isIP(host) && isPrivateAddress(host)) throw new ImportError("That link points to a private address.");
}

async function readLimited(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break; // JSON-LD and meta tags live near the top; a truncated page is still useful.
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
