import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;

export class ImportError extends Error {}

/**
 * Fetches a public web page for import. The server makes this request on the
 * user's behalf, so it refuses anything that resolves to a private or local
 * address (no poking at the database, metadata endpoints, localhost…).
 */
export async function fetchPublicPage(input: string): Promise<{ html: string; url: string }> {
  let url = normalizeUrl(input);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Many career sites return an empty shell or a 403 to unknown agents.
        "user-agent": "Mozilla/5.0 (compatible; JobbierBot/1.0; +https://jobbier.vercel.app)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === "TimeoutError") throw new ImportError("That page took too long to respond.");
      throw new ImportError("Couldn't reach that page.");
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ImportError("That page redirected somewhere unexpected.");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      throw new ImportError(
        response.status === 403 || response.status === 429
          ? "That site blocks automatic reading. Fill in the details by hand."
          : `That page answered with an error (${response.status}).`,
      );
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) throw new ImportError("That link isn't a web page.");

    return { html: await readLimited(response), url: url.toString() };
  }
  throw new ImportError("That page redirected too many times.");
}

export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new ImportError("That doesn't look like a link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ImportError("Only http and https links work.");
  if (url.username || url.password) throw new ImportError("Links with passwords in them aren't supported.");
  return url;
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new ImportError("That link points to a private address.");
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new ImportError("Couldn't find that website.");
  if (addresses.some(isPrivateAddress)) throw new ImportError("That link points to a private address.");
}

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
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
