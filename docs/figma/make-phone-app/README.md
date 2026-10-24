# GurtOS phone app: clickable prototype (Figma Make)

A clickable prototype of the GurtOS companion phone app, built from the phone app frames in
[`../phone-app/README.md`](../phone-app/README.md). It is sample data only: no real machines, people or payments.

Figma Make file: https://www.figma.com/make/gSXGjlKZRZbtMSKjxTvjgK

This folder is the source that was imported into Make: a small Vite, React and TypeScript app with no UI libraries.
It uses the GurtOS Light colour tokens and Atkinson Hyperlegible Next, at 390 x 844. `npm install` then `npm run dev`
runs it locally; `npm run build` type-checks and builds it. The `.figma/make/` scripts tell Make how to install, run
and publish it.

## What you can click

- **Switch machines.** Tap the machine name at the top. The Machines sheet lists Home box (GurtOS Server), Ben's laptop
  (GurtOS Personal) and Fogline Supply (GurtOS Business, signed in as Rosa Delgado). Pick one and the home changes.
  The waiting counts go down as you answer things.
- **Home box.** Pause all agents stops the running tasks and shows the paused state; Resume all agents undoes it.
- **Ben's laptop.** Undo or Keep changes on the finished folder task, then Put files back.
- **Fogline Supply.** Waiting for me. Tap Bright Harbor Catering to open the $40,000 request with the agent's checks,
  then Approve or Deny.
- **Simulate a notification** (above the phone). The lock screen shows "Fogline Supply: Approve a $40,000 credit line?".
  Tapping it switches to Fogline Supply and opens the request.
- **Add a machine.** From the Machines sheet: the QR scanner and where each edition shows its code.
- **Install walkthrough** (above the phone). Five steps: Camera reads the QR code, Safari on app.gurtos.com, Add to
  Home Screen, allow notifications, pair with Home box.
- **Reset** puts everything back.

## Publishing it (only Ben can do this)

1. Open https://www.figma.com/make/gSXGjlKZRZbtMSKjxTvjgK and wait for the preview to load.
2. Click **Publish** at the top right, keep or pick the site address, then click **Publish** again.
3. Click **Share** at the top right. Under who has access, choose **Anyone with the link** and **can view**, then
   click **Copy link**.
4. Paste the published address and the share link into `docs/figma.md`, or send them to the Figma thread.
