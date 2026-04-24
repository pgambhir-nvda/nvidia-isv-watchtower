# NVIDIA ISV Watchtower

A lightweight browser dashboard for tracking enterprise ISV stock signals and recent company news with NVIDIA-oriented strategy notes.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/pgambhir-nvda/nvidia-isv-watchtower)

## Features

- Add any number of public companies by stock ticker.
- Add private companies or companies without a public ticker in company-name mode.
- Live stock quote data from Alpha Vantage for public tickers.
- Recent news from the last 7 days with summaries, sources, and "why should I care?" framing.
- Strategy notes tuned for NVIDIA product management and GTM workflows.
- Watchlist persistence in browser local storage.

## Run locally

```powershell
node server.mjs
```

Then open `http://localhost:3000`.

For local secrets, create a `.env` file in the project root:

```powershell
ALPHA_VANTAGE_API_KEY=your-key-here
```

An `.env.example` file is included, and `.env` is ignored by git.

## Notes

- `ALPHA_VANTAGE_API_KEY` must be provided through environment configuration for any published deployment.
- Private companies do not have a stock quote card, so the dashboard switches them into news-only narrative tracking.

## Public Deployment

GitHub Pages is not a fit for the live ISV watchtower because the app depends on a Node server and server-side requests to Alpha Vantage, SEC, Yahoo, Bing, and Nasdaq.

The recommended public deployment path is:

1. Click the Deploy to Render button above, or open `https://render.com/deploy?repo=https://github.com/pgambhir-nvda/nvidia-isv-watchtower`.
2. Sign into Render and approve access to your GitHub account if prompted.
3. Review the Blueprint created from `render.yaml`.
4. Set the `ALPHA_VANTAGE_API_KEY` environment variable in Render.
5. Create the service and wait for the first deploy to finish.
6. Open the Render service URL once the deploy is green.

This gives you a public URL for the dashboard without requiring people to download anything, while keeping the API key out of the repository.
