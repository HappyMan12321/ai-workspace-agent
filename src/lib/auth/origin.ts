import "server-only";

// Never build email redirects from a caller-controlled Host or Origin header.
export function appOrigin() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is required for authentication emails.");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("APP_URL must be an HTTPS origin, or an HTTP localhost origin.");
  }
  return url.origin;
}
