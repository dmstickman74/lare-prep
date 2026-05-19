/**
 * Impexium API client — vanilla-Node port of the canonical TS client at
 * ~/dev/member_survey_app/src/lib/auth/impexium-client.ts.
 * Keeps the same caching semantics (23h app token cache), retry/backoff,
 * and access-level rules.
 */

const PUBLIC_ENDPOINT = 'https://public.remembers-ams.com/Api/v1/WebApiUrl';
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;
const APP_TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

const ADMIN_MEMBERSHIP_TYPE = 'Staff: ASLA';
const ADMIN_SECURITY_ROLES = new Set(['administrators', 'administrator', 'admin']);

export class ImpexiumApiError extends Error {
  constructor(message, statusCode, body) {
    super(message);
    this.name = 'ImpexiumApiError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

export class ImpexiumAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImpexiumAuthError';
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isMembershipActive(m) {
  const dateStr = m.graceExpireDate || m.expireDate;
  if (!dateStr) return true;
  const expire = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expire >= today;
}

function determineAccessLevel(profile) {
  const roleNames = (profile.securityRoles || [])
    .map((r) => (r.name || '').toLowerCase())
    .filter(Boolean);
  const hasAdminRole = roleNames.some((n) => ADMIN_SECURITY_ROLES.has(n));
  const hasAdminMembership = (profile.memberships || []).some(
    (m) => m.membershipType === ADMIN_MEMBERSHIP_TYPE
  );
  if (hasAdminRole || hasAdminMembership) return 'admin';
  const hasActive = (profile.memberships || []).some(isMembershipActive);
  return hasActive ? 'member' : 'public';
}

function transformToSessionUser(profile) {
  const primary = (profile.memberships || [])[0];
  /* impexiumSsoToken intentionally NOT included — we don't make Impexium
     writes from this app, and JWTs are base64 (not encrypted), so anyone
     who can read the cookie value would see a live Impexium SSO token. */
  return {
    customerId: profile.id,
    recordNumber: profile.recordNumber,
    email: profile.email || profile.user?.loginEmail || '',
    firstName: profile.firstName,
    lastName: profile.lastName,
    accessLevel: determineAccessLevel(profile),
    membershipType: primary?.membershipType,
  };
}

class ImpexiumClient {
  constructor() {
    this.cachedAppToken = null; // { token, userToken, apiBaseUrl, expiresAt }
  }

  get config() {
    return {
      appName: process.env.IMPEXIUM_APP_NAME,
      appKey: process.env.IMPEXIUM_APP_KEY,
      appId: process.env.IMPEXIUM_APP_ID,
      appPassword: process.env.IMPEXIUM_APP_PASSWORD,
      appUserEmail: process.env.IMPEXIUM_APP_USER_EMAIL,
      appUserPassword: process.env.IMPEXIUM_APP_USER_PASSWORD,
      clientUrl: process.env.IMPEXIUM_CLIENT_URL,
    };
  }

  validateConfig() {
    const cfg = this.config;
    const required = ['appName', 'appKey', 'appId', 'appPassword', 'clientUrl'];
    const missing = required.filter((k) => !cfg[k]);
    if (missing.length) {
      throw new Error('missing Impexium config: ' + missing.join(', '));
    }
  }

  async handleResponse(response, context) {
    if (!response.ok) {
      const body = await response.text();
      console.error(`[impexium] ${context} ${response.status}:`, body.slice(0, 500));
      if (response.status === 401 || response.status === 403) {
        throw new ImpexiumAuthError('unauthorized');
      }
      throw new ImpexiumApiError('api error', response.status, body);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  }

  async fetchWithRetry(url, options, context) {
    let lastErr = null;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const res = await fetch(url, options);
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_BASE_DELAY * 2 ** i;
          await sleep(delay);
          continue;
        }
        return await this.handleResponse(res, context);
      } catch (err) {
        lastErr = err;
        if (err instanceof ImpexiumAuthError) throw err;
        if (err instanceof ImpexiumApiError && (err.statusCode === 400 || err.statusCode === 404)) throw err;
        if (i < MAX_RETRIES - 1) await sleep(RETRY_BASE_DELAY * 2 ** i);
      }
    }
    throw lastErr || new ImpexiumApiError('retries exhausted');
  }

  async getWebApiUrl() {
    this.validateConfig();
    const cfg = this.config;
    const res = await fetch(PUBLIC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify({ AppName: cfg.appName, AppKey: cfg.appKey }),
    });
    return this.handleResponse(res, 'getWebApiUrl');
  }

  async authenticate(apiEndpoint, accessToken) {
    const cfg = this.config;
    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'AccessToken': accessToken },
      body: JSON.stringify({
        AppId: cfg.appId,
        AppPassword: cfg.appPassword,
        AppUserEmail: cfg.appUserEmail,
        AppUserPassword: cfg.appUserPassword,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) throw new ImpexiumAuthError('invalid credentials');
      throw new ImpexiumApiError('auth failed', res.status, text);
    }
    return res.json();
  }

  async getAppToken() {
    if (this.cachedAppToken && Date.now() < this.cachedAppToken.expiresAt) {
      return this.cachedAppToken;
    }
    const webApi = await this.getWebApiUrl();
    const auth = await this.authenticate(webApi.uri, webApi.accessToken);
    const apiBaseUrl = webApi.uri.replace(/\/api\/v1\/.*$/i, '');
    this.cachedAppToken = {
      token: auth.appToken,
      userToken: auth.userToken || auth.ssoToken || '',
      apiBaseUrl,
      expiresAt: Date.now() + APP_TOKEN_TTL_MS,
    };
    return this.cachedAppToken;
  }

  async findBySsoToken(ssoToken) {
    const { token, apiBaseUrl } = await this.getAppToken();
    const url = `${apiBaseUrl}/api/v1/Individuals/FindBySsoToken/${encodeURIComponent(ssoToken)}?updateTokenUsage=false&includeDetails=true`;
    const result = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: { 'AppToken': token, 'UserToken': ssoToken },
    }, 'findBySsoToken');
    const profile = result?.dataList?.[0];
    if (!profile) throw new ImpexiumAuthError('SSO token invalid or expired');
    return profile;
  }

  /**
   * Validate a callback from Impexium. Returns a session-shaped user object,
   * or throws ImpexiumAuthError if the token is invalid, the userId doesn't
   * match the resolved profile, the account isn't approved, or the user has
   * no active membership.
   */
  async validateSsoCallback(userId, ssoToken) {
    const profile = await this.findBySsoToken(ssoToken);
    if (profile.id !== userId) throw new ImpexiumAuthError('user id mismatch');
    if (!profile.user?.isApproved) throw new ImpexiumAuthError('account not approved');
    const sessionUser = transformToSessionUser(profile);
    if (sessionUser.accessLevel === 'public') {
      throw new ImpexiumAuthError('no active membership');
    }
    return sessionUser;
  }

  getRedirectLoginUrl(callbackUrl) {
    this.validateConfig();
    const base = this.config.clientUrl.replace(/\/+$/, '');
    return `${base}/account/login.aspx?RedirectUrl=${encodeURIComponent(callbackUrl)}`;
  }
}

export const impexiumClient = new ImpexiumClient();
