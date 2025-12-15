/**
 * Parses a cookie header string into a key-value object.
 * Handles cookies with multiple = signs in their value.
 */
export function parseCookies(
  cookieHeader: string | undefined
): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name) {
      cookies[name.trim()] = decodeURIComponent(value);
    }
  });

  return cookies;
}
