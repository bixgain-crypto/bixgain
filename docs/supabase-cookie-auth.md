# Supabase Cookie-based Auth (short guide)

Why use cookie-based auth
- HttpOnly cookies cannot be read by JavaScript, reducing risk from XSS.
- Server can manage refresh tokens and rotate them securely.

High-level steps
1. Configure your auth flow to create sessions server-side after sign-in/signup.
2. Set `Set-Cookie` with `HttpOnly; Secure; SameSite=Strict` for access/refresh cookies.
3. On the client, avoid storing tokens in `localStorage` and disable auto refresh.
4. For requests that require auth, ensure cookies are sent (CORS must allow credentials).

Example (edge function / server) — set cookie after verifying credentials

```ts
// pseudo-code
const { data: signInData } = await supabaseAdmin.auth.admin.createUser({ email, password });
// create session tokens (server-side) and set HttpOnly cookie
const session = /* create session token */;
return new Response('ok', {
  status: 200,
  headers: {
    'Set-Cookie': `sb-access-token=${session.access_token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`,
    'Content-Type': 'application/json'
  }
});
```

Client-side
- Do not persist session tokens in `localStorage`.
- Use `VITE_USE_COOKIE_AUTH=true` and follow server implementation above.
- Ensure your edge functions/CORS set `Access-Control-Allow-Credentials: true` and use a specific origin (not `*`).

Supabase docs
- https://supabase.com/docs/guides/auth/auth-helpers

Notes
- Cookie auth requires careful server-side handling (refresh, rotation, logout).
- If you need help wiring a concrete implementation for your hosting (Netlify, Vercel, Supabase Edge), tell me which one and I can add a sample.
