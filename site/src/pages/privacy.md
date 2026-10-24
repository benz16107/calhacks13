---
layout: ../layouts/Landing.astro
title: Privacy policy
description: What gurtos.com collects (nothing of its own), what the host sees, and what a GurtOS box sends.
---

## This site

gurtos.com is a static site. It has no accounts, no forms and no comments, and it runs no analytics or tracking code.
It collects nothing from you. The one thing it remembers is your light or dark choice, if you use the theme switch: it
saves `light` or `dark` in your browser's local storage and in a cookie for `.gurtos.com`, so gurtos.com, the docs and
calhacks.gurtos.com agree. Nothing else is stored, and the cookie is never read by a server for anything but the page's
own styling.

Vercel hosts the site. Like any web host, it receives each request (your IP address, your browser's user agent and the
page you asked for) and may keep ordinary server logs. Vercel's own privacy notice governs that. We do not read or
export those logs for anything but keeping the site running.

Search runs in your browser, on an index the site serves. The page does not send what you type anywhere.

## Downloads

The install images come from GitHub Releases and a Vultr Object Storage mirror. Those services see the download
request, with your IP address, and have their own privacy notices.

## The software

GurtOS runs on your own computer. This site does not collect data from a GurtOS box, and a box sends nothing to us.
A box calls only the hosts you allow, such as your model provider with the key you give it. The
[security model](/docs/security/model/) says what a box stores and where.

If you turn on remote access, traffic between your phone and your box passes through the relay at `*.box.gurtos.com`.
See [Reach your box from anywhere](/docs/guides/reach-your-box-from-anywhere/).

## Contact

To ask about this page, open an issue in the project's [GitHub repository](https://github.com/benz16107/calhacks13/issues).

Last updated Oct 24, 2026. See also the [Terms of use](/terms/).
