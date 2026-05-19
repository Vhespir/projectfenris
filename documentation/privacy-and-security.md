# Project Fenris -- Privacy and Security

## Philosophy
Digital privacy is not a feature. It is a responsibility. Project Fenris is built for people who understand that information security and personal privacy are core to preparedness. We extend that same care to our users without breaking features or convenience.

---

## What We Do Right (Already Implemented)

- **httpOnly cookies** for JWT -- protects against XSS token theft. More secure than localStorage which most platforms use.
- **Self-hosted infrastructure** -- no Google, Amazon, or Facebook touching user data. Ever.
- **No ads** -- no ad tracking, no behavioral profiling, no third party ad pixels.
- **No third party analytics** -- no Google Analytics, no Mixpanel, no tracking scripts watching every page view.
- **PostgreSQL on our own server** -- we control the data. Nobody else has access.
- **Rate limiting** on auth routes -- protects against brute force attacks.
- **2FA support** (TOTP) -- users can enable two-factor authentication on their accounts.

---

## Privacy Improvements to Implement

### Message Auto-Deletion [TODO]
Let users set their DMs to auto-delete after 30, 60, or 90 days.
- Simple cron job in the worker service
- User preference stored in users.preferences JSONB
- Reduces data retention without breaking the messaging feature
- Default: messages kept indefinitely unless user opts in to auto-deletion

### Minimal Data Collection Policy [TODO]
Only collect what is actually needed:
- Do not store IP addresses in logs longer than 24 hours
- Do not log search queries
- Do not track which posts users viewed -- only interactions (votes, comments, posts)
- Do not store device fingerprints or user agent strings beyond what Nginx logs by default

### Account Deletion That Actually Works [TODO]
When a user deletes their account:
- Delete or anonymize all their posts (replace username with [deleted], keep content for community value or delete entirely -- user's choice)
- Delete all their messages
- Delete their profile, avatar, showcase
- Delete their location data (user_lat, user_lon)
- Remove their votes (or keep anonymized for score integrity)
- Confirmation email via Resend
- 30 day grace period with reactivation option before permanent deletion
- GDPR requirement regardless of user location

### Optional Location Precision [TODO]
Location is used for Near Me feed filtering. Give users control:
- Full coordinates (most precise, current default)
- County level only
- State level only
- None (disables Near Me feature)
Don't require more location precision than the feature needs.

### No External Scripts Policy [IMPLEMENT]
Never load scripts from external domains:
- Host fonts locally (no Google Fonts CDN)
- No Facebook Pixel
- No Google Analytics
- No third party chat widgets
- No external image embeds that could leak referrer data
Every external script is a potential privacy leak and a performance hit.

### Secure Nginx Headers [TODO -- add to nginx.conf]
```nginx
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

Prevents: clickjacking, MIME sniffing, referrer leaking, unauthorized feature access, XSS. Takes 30 minutes and meaningfully improves security posture.

### Content Security Policy [TODO]
Add CSP header to Nginx config. Prevents unauthorized script execution and data exfiltration. Start permissive and tighten over time:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss:;";
```

---

## Security Improvements to Implement

### Fail2ban [TODO -- high priority]
Monitors log files and bans IPs showing malicious behavior.
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```
Configure jails for:
- SSH brute force (already a default jail)
- Nginx auth endpoint brute force
- Nginx 404 flood

### Automatic Security Updates [TODO]
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```
Security patches applied automatically. Reduces window of exposure from known vulnerabilities.

### SSH Hardening [TODO]
Disable password authentication, key only:
```bash
# /etc/ssh/sshd_config
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
```

### API Rate Limiting [PARTIAL -- auth routes done, all routes TODO]
All API endpoints should have rate limits, not just auth:
- Auth routes: 5 requests per minute (already implemented)
- General API: 100 requests per minute
- Post creation: 10 per hour
- Message sending: 30 per minute (already implemented)

### Database Security [TODO]
- PostgreSQL not exposed outside Docker network (already correct -- internal only)
- Regular vacuum and analyze scheduled
- Connection pooling limits set (prevent connection exhaustion)
- Audit log for sensitive operations (admin actions, account deletions)

### Dependency Auditing [ONGOING]
```bash
# run weekly
cd api && npm audit
cd worker && npm audit
cd frontend && npm audit
```
Fix critical and high severity findings immediately. Accept low severity with documented reasoning.

### Backup Encryption [TODO -- with B2 backups]
Restic encrypts backups by default. Keep the encryption password somewhere safe and separate from the server. If Sentinel is compromised the backup data is still protected.

---

## What We Store

| Data | Stored | Retention | Notes |
|---|---|---|---|
| Email address | Yes | Until account deleted | Used for auth and notifications only |
| Password | Hashed (bcrypt) | Until account deleted | Never stored in plain text |
| Username | Yes | Until account deleted | Public |
| Region (text) | Yes | Until account deleted | User provided, used for display |
| Location coordinates | Yes | Until account deleted | Geocoded from region, used for Near Me filter |
| Threat profile | Yes | Until account deleted | User provided JSONB |
| Posts and comments | Yes | Until deleted by user or moderator | Public content |
| Direct messages | Yes | Until deleted or auto-deletion timer | Private, visible only to participants |
| Guide votes | Yes | Until account deleted | Anonymous aggregate counts shown publicly |
| Post votes | Yes | Until account deleted | Anonymous aggregate counts shown publicly |
| IP addresses | Nginx logs only | 24 hours max | Not stored in application database |
| Session tokens | httpOnly cookie | Until logout or expiry | Never in localStorage |
| Avatar images | Yes | Until removed | Stored on Sentinel |

## What We Do Not Store

- Browsing history or page view tracking
- Device fingerprints
- Third party tracking identifiers
- Payment information (handled by Stripe/Ko-fi directly)
- Search queries
- Real-time location (only geocoded region saved when user sets it)

---

## Privacy Policy Copy (Plain Language)

**What we collect:**
We collect your email address, username, and the profile information you choose to provide. If you set your region we geocode it to coordinates for location-based features. We collect your posts, comments, and votes because that is the community content you create.

**What we don't collect:**
We don't run ads. We don't use third party tracking scripts. We don't sell your data. We don't store your IP address beyond short-term server logs. We don't track which pages you view -- only what you actively do (post, vote, comment).

**Who can see your data:**
Your posts, guides, and field reports are public. Your direct messages are private and visible only to you and the recipient. Your email address is never shown publicly. Your location coordinates are used only to filter content -- they are never displayed or shared.

**How to delete your data:**
You can delete your account from Settings. When you delete your account we remove your personal information, location data, and messages. Your public posts can be anonymized or deleted -- your choice.

**Who has access to your data:**
Project Fenris is self-hosted. Only the platform operator (vhespir) has access to the database. No third parties, no data brokers, no advertisers.

**Changes to this policy:**
If we make significant changes we will notify users via email and post in the platform announcements.

The wolf watches. Your data stays with us.

---

## The Privacy Pitch (Marketing Copy)

Project Fenris is self-hosted on infrastructure we control. We don't run ads. We don't sell your data. We don't use third party tracking. Your location data stays on our servers and is only used to filter content relevant to your region. You can delete your account and your data at any time.

No Google. No Facebook. No Amazon. No algorithms. Just signal.

---

## Differentiator

This is a genuine marketing advantage with the prep, homelab, and privacy communities. Verifiable in the browser network tab -- no Google Analytics requests, no ad network calls, no Facebook Pixel. The network tab doesn't lie.

Target communities who care about this:
- r/privacy
- r/selfhosted
- r/homelab
- r/preppers
- Ham radio operators
- Security professionals

---

## Future Considerations

- **Matrix/Element integration** for end-to-end encrypted messaging if community demands it. Do not build E2E encryption from scratch -- integrate with a proven implementation.
- **Tor hidden service** for users who need anonymity -- advanced, low priority, but on brand for the platform philosophy.
- **Zero-knowledge proof of location** -- prove you are in a region without revealing exact coordinates. Research topic, very long term.
- **Self-destructing messages** -- messages that delete after being read. Meaningful for opsec minded users.