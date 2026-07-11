/**
 * DigitalOcean Function backing the Gradient "screen_calfresh" function route.
 * The Gradient agent invokes this with a HouseholdProfile; it forwards to Person B's
 * deterministic /screen (SCREEN_URL) and returns the ScreeningResult[] unchanged.
 *
 * This function does NO eligibility logic — it is a pure transport shim so the model
 * can reach the deterministic engine. All numbers come from SCREEN_URL.
 */
async function main(args) {
  const screenUrl = process.env.SCREEN_URL;
  if (!screenUrl) {
    return { statusCode: 500, body: { error: 'SCREEN_URL not configured on the function.' } };
  }

  // Gradient passes the function arguments as the profile fields (plus DO's own keys).
  const { __ow_method, __ow_headers, __ow_path, ...profile } = args || {};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(screenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(profile),
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'Non-JSON from /screen', raw: text };
    }
    return { statusCode: res.status, body: data };
  } catch (err) {
    return { statusCode: 502, body: { error: `Failed to reach /screen: ${err.message}` } };
  } finally {
    clearTimeout(timeout);
  }
}

exports.main = main;
