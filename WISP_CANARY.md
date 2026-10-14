# Optional WISP canary (not enabled by default)

This change adds a self-hosted WISP backend behind environment settings. Without these settings, both Render services keep their existing relay behavior. It is an experiment, not a guaranteed CloudMoon fix: the CloudMoon API relay still goes through the original Truffled site and may return HTTP 429. Render networking and the provider's stream rules have not been tested after CloudMoon sign-in.

## Try on the OLD service only

Publish these changes to a **separate `wisp-canary-old-site` GitHub branch**, not `main`. In Render, point only the existing **davids-web** web service to this branch; leave **google-classroomm** on `main`. Then, on the old service only, add these environment variables:

```
WISP_MODE=local
WISP_TEST_HOST=davids-web.onrender.com
```

Save and redeploy the old service. In a regular browser tab, try one proxied non-login page such as Wikipedia, then CloudMoon Brawl Stars via **https://davids-web.onrender.com/g**. Do not share a password, network HAR, or session tokens in screenshots. Use a low-stakes account if you decide to test authenticated streaming through a third-party proxy.

The new google-classroomm service stays on `main` and must NOT have `WISP_MODE=local`. The canary rejects WISP upgrades with the wrong hostname/origin, caps simultaneous connections, and blocks private/loopback destinations, but it is still a public experimental proxy. Run it briefly and switch it off after testing.

## Roll back immediately

On the old **davids-web** service, remove `WISP_MODE` and `WISP_TEST_HOST` (or set `WISP_MODE=relay`) and redeploy. This restores the previous Truffled WISP forwarding path. For a full rollback, point only that service back at GitHub `main` and redeploy. Never enable `allow_loopback_ips` or `allow_private_ips` on a public service.

## Local checks completed

- Default relay mode loaded Wikipedia and passed the health check.
- Local WISP mode loaded Wikipedia and CloudMoon's Brawl Stars landing page.
- Wrong-origin WISP requests were rejected and loopback destinations blocked.
- An isolated localhost-only UDP WISP echo test returned a packet successfully.

These checks did not test CloudMoon sign-in, WebRTC game streaming, or Render's outbound UDP connectivity. The old site should be treated as a temporary canary only.
