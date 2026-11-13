# EMS-SCADA Dashboard – Windows Installer

Desktop wrapper (Electron) for the Megarevo MPS & Schneider PowerLogic monitoring dashboard.
GitHub Actions builds the Windows installer `.exe` automatically.

## Get the .exe
1. Create a new GitHub repository and push this folder to the `main` branch.
2. Open the repo > **Actions** tab > **Build Windows Installer** (runs automatically on push, or click *Run workflow*).
3. When finished (~3–5 min), open the run and download **EMS-SCADA-Dashboard-Installer** from *Artifacts* (zip containing the Setup .exe).

### Release version (public download link)
```
git tag v1.0.0
git push origin v1.0.0
```
The installer is attached to the repo's **Releases** page.

## Install
Run `EMS-SCADA-Dashboard-Setup-1.0.0.exe`. It creates Desktop and Start Menu shortcuts.
Windows SmartScreen may warn because the installer is unsigned: click *More info > Run anyway*.

## Update the dashboard
Replace `app/index.html` with the new HTML, commit and push; a new installer is built.

## Notes
- Chart.js, Tailwind and Lucide are downloaded at build time, so the installed app works offline (fonts fall back to system fonts).
- CORS is relaxed inside the app so the dashboard can fetch from your gateway API URL on the local network.
- Run locally for testing: `npm install && npm start`.
