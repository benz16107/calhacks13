---
layout: ../layouts/Landing.astro
title: Privacy policy
description: What gurtos.com and app.gurtos.com collect (nothing of their own), what their host sees, and every place a GurtOS box sends data.
---

## gurtos.com

gurtos.com, its docs and calhacks.gurtos.com are static sites. They have no accounts, forms or comments, and they run
no analytics or tracking code. They collect nothing from you. The one thing they remember is your light or dark
choice, if you use the theme switch: it is saved as `light` or `dark` in your browser's local storage and in a cookie
named `gurtos-theme` for `.gurtos.com`, so the sites agree. The sites set no other cookie.

Vercel hosts the sites. Like any web host, it receives each request (your IP address, your browser's user agent and
the page you asked for) and may keep ordinary server logs. Vercel's own privacy notice governs that. We do not read or
export those logs for anything but keeping the sites running.

- **Search** runs in your browser, on an index the site serves. What you type is not sent anywhere.
- **Fonts and images** come from gurtos.com itself.
- **Videos** are on YouTube. The home page shows a still image from gurtos.com and contacts YouTube only when you
  follow the link. calhacks.gurtos.com embeds its videos from YouTube's privacy-enhanced mode
  (`youtube-nocookie.com`) and one page embeds two Figma prototypes, so those pages load YouTube's or Figma's player,
  under Google's or Figma's privacy notice.
- **The receipt checker** at [gurtos.com/verify](/verify/) checks a receipt in your browser and uploads nothing. If you
  paste a receipt's https address, your browser fetches it from that address. If the receipt is anchored on Solana's
  devnet test network, your browser looks the transaction up at `api.devnet.solana.com`.

## Downloads

The install images and apps come from GitHub Releases. GitHub sees the
download request, with your IP address, and has its own privacy notice.

## app.gurtos.com

app.gurtos.com is the GurtOS web app, served as static files by Vercel, with the same server logs as above. It has
no accounts and no analytics. When you pair it with a box, it keeps that box's address and device token in your
browser's storage, and it talks to that box directly at the box's https address. To turn on push notifications it
asks the relay for its public key. Nothing about you is sent to us.

## A GurtOS box

GurtOS runs on your own computer, and the box sends nothing to us. Here is everything it connects to, and when.

Always:

- **Your model provider**, Anthropic or Factory, with the key you give the box. An agent's prompt, its steps and
  anything it reads from your files or the web go to that provider as part of its model calls. Their terms and privacy
  notice cover that data. When you save an Anthropic key, the box checks it with one free call to Anthropic.
- **Factory's download server**, once, on the first start, to download Factory's Droid CLI.
- **The hosts each task allows.** A task's network reaches only the box's proxy, and the proxy lets through only the
  hosts that task lists. The [network policy](/docs/concepts/network-policy/) says how.
- **The Ubuntu base**, as on any Ubuntu 24.04 computer: time sync with Ubuntu's time servers. GurtOS Personal also
  gets Ubuntu's security updates and firmware update checks, refreshes GNOME Software's app catalog (Flathub), and
  downloads its speech model from the Python Package Index and Hugging Face once.

Only when you turn them on:

- **Apps.** Every app but the model app is off on a new box. An app you turn on calls its own service with the keys
  you give it, and the App Center lists those services before you turn it on.
- **Remote access.** The box opens a tunnel to the relay you choose, and sends push notifications through that
  relay's push gateway to your phone's push service (Apple, Google, Mozilla or Microsoft). The box encrypts each push
  for your phone first, so neither the relay nor the push service can read it. The relay sees names, connection
  times, caller addresses and byte counts. See [what the relay can and cannot see](/docs/security/model/#12-remote-access-through-the-relay).
  A hosted relay at `box.gurtos.com` is not running during the preview; when it runs, we are that relay's operator.
- **The fleet view**, off on a new box. When the owner turns it on, the box reports its id, name, edition and
  version, task counts, what it spent today and whether it is online to the `gurtos-fleet` database on SpacetimeDB
  Maincloud, which the GurtOS project runs. Never a prompt, a file, a request's text or a key. `BOX_FLEET_DB` and
  `BOX_FLEET_URL` point it at a database of your own. Turning it off, while the box is online, makes Maincloud forget
  the box.
- **Work-account sign-in** on GurtOS Business, which talks to the identity provider you set up, such as Microsoft
  Entra ID.

The [security model](/docs/security/model/) says what a box stores and where.

## Contact

To ask about this page, open an issue in the project's [GitHub repository](https://github.com/benz16107/gurtos/issues).

Last updated Oct 29, 2026. See also the [Terms of use](/terms/).
