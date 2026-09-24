# Cisco Automated v2.1.0

## Public release

This repository is now publicly available under the MIT license.

## Highlights

- CCW quote automation
- DSV generation flow
- cloud/local estimate sync
- desktop portable flow
- dark UI and dashboard improvements
- Turnstile hardening and fail-closed config
- Firebase security hardening
- public-safe credential handling

## Requirements for production deployment

- Configure Firebase environment variables
- Configure Turnstile secret in your hosting environment
- Use your own secure credentials and password salts

## Security notice

Do not commit real secrets, Firebase credentials, or API keys to the repository. Use environment variables and GitHub Actions secrets instead.

## Build

```bash
npm install
npm run build
```

## Code Signing & Distribution

Windows binaries are built via GitHub Actions CI and digitally signed:

> Free code signing provided by [SignPath.io](https://signpath.io/) on behalf of the [SignPath Foundation](https://signpath.org/).

Downloads are available under [GitHub Releases](https://github.com/abs0lu7iontr-design/cisco-cotizador-intcomex/releases).
