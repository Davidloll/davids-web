# DAVIDS WEB — Thetuber79 site

A Node.js mirror of the public Truffled site, customized as requested: browser-tab branding says **Thetuber79**, the homepage says **Hi and welcome to DAVIDS WEB**, Wii-style cursors are installed, and the site's ads are disabled. The original site's legal credits and external links remain intact.

## Run locally

Requires Node.js 20 or newer. Run `npm start`, then visit `http://localhost:3000`. The app uses `PORT` when your host provides one. No npm dependencies are required.

## Publish a live site with GitHub + Render

GitHub Pages alone cannot run this project: the site needs a Node.js server for its API, music range requests, and WebSocket relay. `render.yaml` sets up a Render web service instead.

### Easiest on Windows or Mac: GitHub Desktop

Use **davids-web-github-desktop.zip** (it already contains a local Git repository). Install [GitHub Desktop](https://desktop.github.com/) and sign in. Unzip the archive, then in GitHub Desktop choose **File → Add local repository → Choose...** and select the **inner `davids-web` folder** containing `package.json` and `render.yaml`. Click **Add repository**, then **Publish repository**. Make sure **Keep this code private** is **unchecked**; publishing creates the public GitHub repository for you. You do not need to create an empty repo on github.com first.

### Command-line alternative

Use **davids-web-github-ready.zip** (no `.git` directory). Unzip it, create a **public, empty** repository on GitHub, then run these commands in its inner `davids-web` folder. Replace the placeholders with your GitHub name/repo; do not put an access token into the repository.

```bash
git init
git add .
git commit -m "Publish DAVIDS WEB"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Deploy on Render

In the [Render Dashboard](https://dashboard.render.com/), choose **New → Blueprint**, connect your GitHub account, and select the repository. Render reads the root `render.yaml`; review the free web service and deploy it. Render then displays the public `*.onrender.com` address. Future pushes to the linked branch can update the deployment.

Alternatively, create a Render **Web Service** linked to the repository, with build command `npm install --omit=dev`, start command `npm start`, and health check `/__mirror_health`.

## How the mirror works

The main pages, scripts, styles, cursors, and a small starter set of thumbnails are cached in `site-cache/`. Uncached routes and game files are fetched from `https://truffled.lol` when requested. Music audio is streamed with `Content-Range` intact so playback and seeking work. The browser/search WebSocket is relayed to the original WISP service.

**Limitations:** The live site depends on the original Truffled server and third-party music/game services staying online. A free host may sleep during inactivity, and external services or a host's network policies can affect individual features. This is not an independent copy of Truffled's entire game library or browsing backend.

**Rights and credits:** The original site's credits/legal panels remain accessible. Game art, music, trademarks, and other third-party assets belong to their respective owners; check your rights before publishing or redistributing them. The Wii-style cursors are derived from the user-provided reference sheet credited to **@fanta_ferret**; the full reference sheet is not included in this GitHub-ready package. `scripts/make_cursors.py` is optional and needs that sheet at `uploads/image-1.png` if you want to regenerate the cursor files.
