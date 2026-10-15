// security.txt (RFC 9116): where to report a security problem. "Expires" is
// always a year ahead, so the file never goes stale.
export function GET() {
  const expires = new Date(Date.now() + 365 * 86400000).toISOString();
  const body = ["Contact: mailto:parzhasarak@gmail.com", `Expires: ${expires}`, "Preferred-Languages: hy, en, ru", ""].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
