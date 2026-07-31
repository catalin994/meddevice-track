
/**
 * Base URL of the running app, including its sub-path.
 *
 * `location.origin` alone is wrong whenever the app is not served from the
 * domain root — on GitHub Pages it lives under /meddevice-track/, so a QR code
 * built from the origin sends the phone to a 404 instead of the device.
 */
export const getAppBaseUrl = (): string => {
  const path = window.location.pathname.replace(/index\.html$/i, '');
  const withSlash = path.endsWith('/') ? path : `${path}/`;
  return `${window.location.origin}${withSlash}`;
};

/** Deep link that opens one device directly. */
export const getDeviceUrl = (deviceId: string, standalone = true): string =>
  `${getAppBaseUrl()}?view=DEVICE_DETAIL&id=${encodeURIComponent(deviceId)}${standalone ? '&standalone=true' : ''}`;
