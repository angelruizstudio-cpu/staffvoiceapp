function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getOriginFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function getPublicOrigin(req) {
  const configuredPublicUrl = trimTrailingSlash(process.env.STAFFVOICE_PUBLIC_URL);
  if (configuredPublicUrl) return getOriginFromUrl(configuredPublicUrl) || configuredPublicUrl;

  const configuredAdminUrl = trimTrailingSlash(process.env.STAFFVOICE_ADMIN_URL);
  const adminOrigin = getOriginFromUrl(configuredAdminUrl);
  if (adminOrigin) return adminOrigin;

  const forwardedHost = req?.headers?.["x-forwarded-host"];
  const host = forwardedHost || req?.headers?.host || "staffvoice.kingdomtechgroup.org";
  if (String(host).includes(".azurewebsites.net")) {
    return "https://staffvoice.kingdomtechgroup.org";
  }

  const proto = req?.headers?.["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

module.exports = {
  getPublicOrigin
};
