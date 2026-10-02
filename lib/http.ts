/** Build an absolute same-origin URL from the browser-facing request host. */
export function requestUrl(request: Request, path: string) {
  // APP_URL is server-only and read at runtime. It keeps redirects stable
  // behind Nginx and allows the public IP/domain to change without rebuilding.
  const configuredAppUrl = process.env.APP_URL?.trim();
  if (configuredAppUrl) {
    return new URL(path, configuredAppUrl);
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestProtocol = new URL(request.url).protocol.replace(":", "");
  const protocol = forwardedProto || requestProtocol;

  return new URL(path, host ? `${protocol}://${host}` : request.url);
}
