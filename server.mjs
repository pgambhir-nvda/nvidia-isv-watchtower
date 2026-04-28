import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const PORT = Number(process.env.PORT || 3000);
loadLocalEnv();
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || "";

const DEFAULT_WATCHLIST = [
  { id: "NOW", mode: "ticker", symbol: "NOW", label: "ServiceNow" },
  { id: "PLTR", mode: "ticker", symbol: "PLTR", label: "Palantir" },
  { id: "CRWD", mode: "ticker", symbol: "CRWD", label: "CrowdStrike" },
  { id: "CRM", mode: "ticker", symbol: "CRM", label: "Salesforce" },
  { id: "SAP", mode: "ticker", symbol: "SAP", label: "SAP" },
  { id: "IBM", mode: "ticker", symbol: "IBM", label: "IBM" },
  { id: "SNOW", mode: "ticker", symbol: "SNOW", label: "Snowflake" },
  { id: "ORCL", mode: "ticker", symbol: "ORCL", label: "Oracle" },
  { id: "ADBE", mode: "ticker", symbol: "ADBE", label: "Adobe" },
  { id: "WDAY", mode: "ticker", symbol: "WDAY", label: "Workday" },
  { id: "TEAM", mode: "ticker", symbol: "TEAM", label: "Atlassian" },
  { id: "DOCU", mode: "ticker", symbol: "DOCU", label: "DocuSign" },
  { id: "ESTC", mode: "ticker", symbol: "ESTC", label: "Elastic" },
  { id: "SIEGY", mode: "ticker", symbol: "SIEGY", label: "Siemens" },
  { id: "DASTY", mode: "ticker", symbol: "DASTY", label: "Dassault Systemes" },
  { id: "SNPS", mode: "ticker", symbol: "SNPS", label: "Synopsys" },
  { id: "CDNS", mode: "ticker", symbol: "CDNS", label: "Cadence" },
  { id: "ZM", mode: "ticker", symbol: "ZM", label: "Zoom" },
  { id: "AKAM", mode: "ticker", symbol: "AKAM", label: "Akamai" },
  { id: "BOX", mode: "ticker", symbol: "BOX", label: "Box" },
  { id: "NET", mode: "ticker", symbol: "NET", label: "Cloudflare" },
  { id: "CVLT", mode: "ticker", symbol: "CVLT", label: "Commvault" },
  { id: "DBX", mode: "ticker", symbol: "DBX", label: "Dropbox" },
  { id: "FSLY", mode: "ticker", symbol: "FSLY", label: "Fastly" },
  { id: "MDB", mode: "ticker", symbol: "MDB", label: "MongoDB" },
  { id: "NTAP", mode: "ticker", symbol: "NTAP", label: "NetApp" },
  { id: "PSTG", mode: "ticker", symbol: "PSTG", label: "Pure Storage" },
  { id: "RBRK", mode: "ticker", symbol: "RBRK", label: "Rubrik" },
  { id: "TDC", mode: "ticker", symbol: "TDC", label: "Teradata" }
];

const PERSONAL_DEFAULT_WATCHLIST = [
  { id: "NVDA", mode: "ticker", symbol: "NVDA", label: "NVDA" },
  { id: "MSFT", mode: "ticker", symbol: "MSFT", label: "MSFT" },
  { id: "AAPL", mode: "ticker", symbol: "AAPL", label: "AAPL" }
];

const cache = new Map();
const SEC_HEADERS = {
  "User-Agent": "Codex NVIDIA dashboard admincontact@example.com",
  Accept: "application/json, text/html;q=0.9, application/xhtml+xml;q=0.8"
};
const NASDAQ_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/"
};

const seedQuoteSnapshots = {
  TEAM: {
    symbol: "TEAM",
    price: 67.62,
    previousClose: 74.01,
    change: -6.39,
    changePercent: -8.634,
    volume: 7770000,
    latestTradingDay: "2026-04-23",
    isFallback: true
  },
  PLTR: {
    symbol: "PLTR",
    price: 141.57,
    previousClose: 152.62,
    change: -11.05,
    changePercent: -7.2402,
    volume: 58160000,
    latestTradingDay: "2026-04-23",
    isFallback: true
  },
  NOW: {
    symbol: "NOW",
    price: 84.78,
    previousClose: 103.07,
    change: -18.29,
    changePercent: -17.7452,
    volume: 83330000,
    latestTradingDay: "2026-04-23",
    isFallback: true
  }
};

const preferredNewsSources = [
  { label: "Reuters", domains: ["reuters.com"] },
  { label: "WSJ", domains: ["wsj.com"] },
  { label: "The New York Times", domains: ["nytimes.com"] },
  { label: "CNBC", domains: ["cnbc.com"] },
  { label: "BBC", domains: ["bbc.com", "bbc.co.uk"] },
  { label: "TechCrunch", domains: ["techcrunch.com"] },
  { label: "ABC News", domains: ["abcnews.go.com"] },
  { label: "Forbes", domains: ["forbes.com"] },
  { label: "Fortune", domains: ["fortune.com"] },
  { label: "Wired", domains: ["wired.com"] },
  { label: "CNET", domains: ["cnet.com"] },
  { label: "MSNBC", domains: ["msnbc.com"] },
  { label: "CNN", domains: ["cnn.com"] }
];

const preferredNewsDomainQuery = preferredNewsSources
  .flatMap((source) => source.domains.map((domain) => `site:${domain}`))
  .join(" OR ");

const broaderBusinessNewsSources = [
  "finance.yahoo.com",
  "marketwatch.com",
  "bloomberg.com",
  "barrons.com",
  "seekingalpha.com",
  "benzinga.com",
  "fool.com",
  "investopedia.com",
  "investors.com",
  "tipranks.com"
];

const knownCompanyProfiles = {
  TEAM: {
    name: "Atlassian",
    description:
      "Atlassian is a collaboration and developer workflow platform spanning Jira, Confluence, Jira Service Management, and AI-powered teamwork experiences.",
    sector: "Technology",
    industry: "Collaboration Software",
    aliases: ["Atlassian", "Jira", "Confluence"]
  },
  PLTR: {
    name: "Palantir",
    description:
      "Palantir focuses on operational data platforms, decision intelligence, AI deployment, and mission workflows across commercial and public sector accounts.",
    sector: "Technology",
    industry: "Analytics and Decision Platforms",
    aliases: ["Palantir", "Palantir Technologies"]
  },
  NOW: {
    name: "ServiceNow",
    description:
      "ServiceNow is a workflow automation platform spanning IT, customer, employee, and industry processes with a strong enterprise AI and agent story.",
    sector: "Technology",
    industry: "Enterprise Workflow Software",
    aliases: ["ServiceNow"]
  },
  CRM: {
    name: "Salesforce, Inc.",
    description:
      "Salesforce is a cloud software platform spanning CRM, data cloud, customer engagement, workflow automation, and enterprise AI applications.",
    sector: "Technology",
    industry: "Customer Relationship Management Software",
    aliases: ["Salesforce", "Salesforce CRM", "Customer 360"]
  },
  DATABRICKS: {
    name: "Databricks",
    description:
      "Databricks is a private enterprise data and AI platform centered on lakehouse architecture, governed analytics, and production AI workflows.",
    sector: "Technology",
    industry: "Data and AI Platforms",
    aliases: ["Databricks"]
  }
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const themeDefinitions = [
  {
    id: "enterprise-ai",
    title: "Enterprise AI rollouts",
    keywords: [
      "artificial intelligence",
      "generative ai",
      "genai",
      "llm",
      "large language model",
      "agentic",
      "copilot",
      "agent"
    ],
    leverage:
      "Lean into inference scale, model optimization, and reference architectures that shorten time-to-value for production AI."
  },
  {
    id: "data-platform",
    title: "Data platform expansion",
    keywords: [
      "data platform",
      "lakehouse",
      "analytics",
      "warehouse",
      "data engineering",
      "data science",
      "mlops"
    ],
    leverage:
      "Position NVIDIA as the acceleration layer for training, vector retrieval, and governed enterprise AI on top of the customer data estate."
  },
  {
    id: "workflow-automation",
    title: "Workflow automation",
    keywords: [
      "workflow",
      "automation",
      "service desk",
      "it service",
      "case management",
      "operations",
      "productivity"
    ],
    leverage:
      "Show how GPU-backed copilots and agents can lift throughput in existing workflows without forcing a rip-and-replace motion."
  },
  {
    id: "developer-platform",
    title: "Developer platform",
    keywords: [
      "developer",
      "software",
      "engineering",
      "code",
      "devops",
      "collaboration",
      "knowledge work"
    ],
    leverage:
      "Tie NVIDIA value to developer productivity, code intelligence, and knowledge graph experiences that become stickier when embedded in daily workflows."
  },
  {
    id: "public-sector",
    title: "Regulated and public sector demand",
    keywords: [
      "government",
      "federal",
      "defense",
      "regulated",
      "compliance",
      "security",
      "mission"
    ],
    leverage:
      "Highlight trusted deployment patterns, on-prem and sovereign options, and ecosystem credibility where compliance and data control matter."
  },
  {
    id: "cloud-ecosystem",
    title: "Cloud ecosystem motions",
    keywords: ["aws", "azure", "gcp", "google cloud", "microsoft", "cloud"],
    leverage:
      "Use cloud marketplace, co-sell, and joint solution packaging to shorten enterprise adoption cycles and reduce integration friction."
  }
];

function loadLocalEnv() {
  const envPath = join(__dirname, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const contents = readFileSync(envPath, "utf-8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  });
}

function json(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function sendError(response, error, statusCode = 500) {
  json(response, statusCode, {
    error: error instanceof Error ? error.message : String(error)
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

async function withConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
  );

  return results;
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(items) {
  return items.filter(Boolean);
}

function toCurrency(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : 4
  }).format(value);
}

function toCompactNumber(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
}

function toPercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(normalized) ? normalized : null;
}

function toRatio(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return `${value.toFixed(digits)}x`;
}

function toPlainNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return value.toFixed(digits);
}

function normalizePercentUnits(value) {
  const parsed = parseNumber(String(value ?? "").replace(/%/g, ""));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function safeDivide(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function toDateLabel(value) {
  const isoDate = toIsoDate(value);
  if (!isoDate) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

function normalizeEntries(entries) {
  const sourceEntries = Array.isArray(entries) && entries.length ? entries : DEFAULT_WATCHLIST;

  return sourceEntries
    .map((entry) => {
      const mode = entry?.mode === "company" ? "company" : "ticker";

      if (mode === "company") {
        const query = sanitizeText(entry.query || entry.label);
        if (!query) {
          return null;
        }

        return {
          id: entry.id || query.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
          mode,
          query,
          label: sanitizeText(entry.label || query)
        };
      }

      const symbol = sanitizeText(entry?.symbol || entry?.query || entry?.label).toUpperCase();
      if (!symbol) {
        return null;
      }

      return {
        id: entry.id || symbol,
        mode,
        symbol,
        label: sanitizeText(entry.label || symbol)
      };
    })
    .filter(Boolean);
}

function normalizePersonalEntries(entries) {
  const sourceEntries =
    Array.isArray(entries) && entries.length ? entries : PERSONAL_DEFAULT_WATCHLIST;

  return sourceEntries
    .map((entry) => {
      const symbol = sanitizeText(entry?.symbol || entry?.query || entry?.label).toUpperCase();
      if (!symbol) {
        return null;
      }

      return {
        id: entry.id || symbol,
        mode: "ticker",
        symbol,
        label: sanitizeText(entry.label || symbol)
      };
    })
    .filter(Boolean);
}

function getCacheEntry(key, options = {}) {
  const { allowStale = false } = options;
  const existing = cache.get(key);
  if (!existing) {
    return null;
  }

  if (!allowStale && existing.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return existing.value;
}

async function cached(key, ttlMs, producer) {
  const hit = getCacheEntry(key);
  if (hit) {
    return hit;
  }

  const value = await producer();
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
  return value;
}

function buildAlphaUrl(params) {
  if (!ALPHA_VANTAGE_API_KEY) {
    throw new Error("ALPHA_VANTAGE_API_KEY is not configured.");
  }

  const search = new URLSearchParams({ ...params, apikey: ALPHA_VANTAGE_API_KEY });
  return `https://www.alphavantage.co/query?${search.toString()}`;
}

async function alphaQuery(params, ttlMs) {
  const cacheKey = JSON.stringify(params);
  const cachedValue = getCacheEntry(cacheKey);
  if (cachedValue) {
    return cachedValue;
  }

  const staleValue = getCacheEntry(cacheKey, { allowStale: true });

  try {
    await sleep(1100);
    const response = await fetch(buildAlphaUrl(params), {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Alpha Vantage request failed with status ${response.status}.`);
    }

    const data = await response.json();

    if (data.Note) {
      throw new Error(
        "Alpha Vantage rate limit reached. Try refreshing again in a minute or reduce the watchlist size."
      );
    }

    if (data.Information) {
      throw new Error(data.Information);
    }

    if (data["Error Message"]) {
      throw new Error(data["Error Message"]);
    }

    cache.set(cacheKey, {
      value: data,
      expiresAt: Date.now() + ttlMs
    });

    return data;
  } catch (error) {
    if (staleValue) {
      return { ...staleValue, __stale: true };
    }

    throw error;
  }
}

async function getQuote(symbol) {
  try {
    const response = await alphaQuery(
      { function: "GLOBAL_QUOTE", symbol },
      5 * 60 * 1000
    );
    const quote = response["Global Quote"] || {};

    const price = parseNumber(quote["05. price"]);
    const previousClose = parseNumber(quote["08. previous close"]);
    const change = parseNumber(quote["09. change"]);
    const changePercent = parseNumber(String(quote["10. change percent"] || "").replace("%", ""));

    return {
      symbol,
      price,
      previousClose,
      change,
      changePercent,
      volume: parseNumber(quote["06. volume"]),
      latestTradingDay: quote["07. latest trading day"] || null,
      isFallback: false
    };
  } catch (error) {
    const fallback = seedQuoteSnapshots[symbol];
    if (fallback) {
      return fallback;
    }

    throw error;
  }
}

async function getOverview(symbol) {
  return alphaQuery(
    { function: "OVERVIEW", symbol },
    24 * 60 * 60 * 1000
  ).then((overview) => ({
    symbol,
    name: sanitizeText(overview.Name || symbol),
    description: sanitizeText(overview.Description),
    sector: sanitizeText(overview.Sector),
    industry: sanitizeText(overview.Industry),
    marketCap: parseNumber(overview.MarketCapitalization),
    peRatio: parseNumber(overview.PERatio),
    analystTargetPrice: parseNumber(overview.AnalystTargetPrice),
    revenueTTM: parseNumber(overview.RevenueTTM),
    beta: parseNumber(overview.Beta),
    weekHigh52: parseNumber(overview["52WeekHigh"]),
    weekLow52: parseNumber(overview["52WeekLow"])
  }));
}

async function getYahooChart(symbol, options = {}) {
  const {
    range = "1y",
    interval = "1d",
    includePrePost = "false",
    events = "div,splits"
  } = options;

  return cached(
    `yahoo-chart:${symbol}:${range}:${interval}:${includePrePost}:${events}`,
    15 * 60 * 1000,
    async () => {
      const params = new URLSearchParams({
        range,
        interval,
        includePrePost,
        events
      });

      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Yahoo chart fallback failed with status ${response.status}.`);
      }

      const payload = await response.json();
      const result = payload.chart?.result?.[0];
      const error = payload.chart?.error;

      if (!result || error) {
        throw new Error(error?.description || `No market history found for ${symbol}.`);
      }

      return result;
    }
  );
}

function buildYahooMarketData(symbol, chart) {
  const meta = chart.meta || {};
  const closes = chart.indicators?.quote?.[0]?.close || [];
  const points = (chart.timestamp || [])
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000),
      close: parseNumber(closes[index])
    }))
    .filter((point) => Number.isFinite(point.close));

  const latestPoint = points.at(-1) || null;
  const regularMarketPrice = parseNumber(meta.regularMarketPrice);
  const price = regularMarketPrice ?? latestPoint?.close ?? null;
  const previousClose =
    parseNumber(meta.chartPreviousClose) ??
    points.findLast((point) => point.close !== price)?.close ??
    null;
  const change =
    Number.isFinite(price) && Number.isFinite(previousClose) ? price - previousClose : null;
  const changePercent =
    Number.isFinite(change) && Number.isFinite(previousClose) && previousClose !== 0
      ? (change / previousClose) * 100
      : null;

  const currentYear = new Date().getFullYear();
  const ytdStart = new Date(Date.UTC(currentYear, 0, 1));
  const ytdBase = points.find((point) => point.date >= ytdStart) || points[0] || null;
  const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const monthBase = points.find((point) => point.date >= monthStart) || points[0] || null;

  const ytdChangePercent =
    Number.isFinite(price) && Number.isFinite(ytdBase?.close) && ytdBase.close !== 0
      ? ((price - ytdBase.close) / ytdBase.close) * 100
      : null;
  const oneMonthChangePercent =
    Number.isFinite(price) && Number.isFinite(monthBase?.close) && monthBase.close !== 0
      ? ((price - monthBase.close) / monthBase.close) * 100
      : null;

  return {
    symbol,
    companyName: sanitizeText(meta.longName || meta.shortName || symbol),
    price,
    previousClose,
    change,
    changePercent,
    volume: parseNumber(meta.regularMarketVolume),
    latestTradingDay: latestPoint ? latestPoint.date.toISOString().slice(0, 10) : null,
    weekHigh52: parseNumber(meta.fiftyTwoWeekHigh),
    weekLow52: parseNumber(meta.fiftyTwoWeekLow),
    ytdChangePercent,
    oneMonthChangePercent,
    isFallback: true
  };
}

function extractYahooPoints(chart) {
  const closes = chart.indicators?.quote?.[0]?.close || [];

  return (chart.timestamp || [])
    .map((timestamp, index) => {
      const date = new Date(timestamp * 1000);
      return {
        date,
        dateKey: toIsoDate(date),
        close: parseNumber(closes[index])
      };
    })
    .filter((point) => point.dateKey && Number.isFinite(point.close));
}

function calculateChangePercent(currentValue, baseValue) {
  const ratio = safeDivide(currentValue - baseValue, baseValue);
  return Number.isFinite(ratio) ? ratio * 100 : null;
}

function findPointOnOrAfter(points, targetTime) {
  return points.find((point) => point.date.getTime() >= targetTime) || points[0] || null;
}

function calculateTrailingPerformance(points, days) {
  if (!points.length) {
    return null;
  }

  const latestPoint = points.at(-1);
  const basePoint = findPointOnOrAfter(points, Date.now() - days * 24 * 60 * 60 * 1000);
  return calculateChangePercent(latestPoint?.close, basePoint?.close);
}

function calculateYearToDatePerformance(points) {
  if (!points.length) {
    return null;
  }

  const latestPoint = points.at(-1);
  const currentYear = new Date().getUTCFullYear();
  const startOfYear = Date.UTC(currentYear, 0, 1);
  const basePoint = findPointOnOrAfter(points, startOfYear);
  return calculateChangePercent(latestPoint?.close, basePoint?.close);
}

function extractDividendYield(chart, currentPrice) {
  const metaYield = normalizePercentUnits(chart?.meta?.trailingAnnualDividendYield);
  if (Number.isFinite(metaYield)) {
    return metaYield;
  }

  const dividends = Object.values(chart?.events?.dividends || {});
  if (!dividends.length || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return null;
  }

  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const annualDividend = dividends.reduce((sum, item) => {
    const timestampMs = Number(item?.date) * 1000;
    if (!Number.isFinite(timestampMs) || timestampMs < oneYearAgo) {
      return sum;
    }

    return sum + (parseNumber(item?.amount) || 0);
  }, 0);

  return annualDividend > 0 ? (annualDividend / currentPrice) * 100 : null;
}

function extractUpcomingEarningsDate(chart) {
  const rawCandidates = [
    chart?.meta?.earningsTimestamp,
    ...(Array.isArray(chart?.meta?.earningsTimestampStart)
      ? chart.meta.earningsTimestampStart
      : [chart?.meta?.earningsTimestampStart]),
    ...(Array.isArray(chart?.meta?.earningsTimestampEnd)
      ? chart.meta.earningsTimestampEnd
      : [chart?.meta?.earningsTimestampEnd])
  ]
    .flat()
    .map((value) => Number(value))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  if (!rawCandidates.length) {
    return null;
  }

  const nowSeconds = Date.now() / 1000;
  const upcoming = rawCandidates.find((value) => value >= nowSeconds - 7 * 24 * 60 * 60);
  return toIsoDate(new Date((upcoming || rawCandidates[0]) * 1000));
}

async function getYahooSearchProfile(symbol) {
  return cached(`yahoo-search:${symbol}`, 12 * 60 * 60 * 1000, async () => {
    const params = new URLSearchParams({
      q: symbol,
      quotesCount: "8",
      newsCount: "0"
    });

    const response = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo company search failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const quotes = Array.isArray(payload.quotes) ? payload.quotes : [];
    const exactMatch =
      quotes.find((item) => String(item.symbol || "").toUpperCase() === symbol.toUpperCase()) ||
      quotes.find((item) => String(item.quoteType || "").toUpperCase() === "EQUITY") ||
      quotes[0];

    if (!exactMatch) {
      throw new Error(`No Yahoo company profile found for ${symbol}.`);
    }

    return {
      symbol: sanitizeText(exactMatch.symbol || symbol).toUpperCase(),
      name: sanitizeText(exactMatch.longname || exactMatch.shortname || exactMatch.symbol),
      sector: sanitizeText(exactMatch.sectorDisp || exactMatch.sector),
      industry: sanitizeText(exactMatch.industryDisp || exactMatch.industry),
      exchange: sanitizeText(exactMatch.exchange || exactMatch.exchDisp)
    };
  });
}

async function getYahooInsights(symbol) {
  return cached(`yahoo-insights:${symbol}`, 12 * 60 * 60 * 1000, async () => {
    const response = await fetch(
      `https://query1.finance.yahoo.com/ws/insights/v1/finance/insights?symbol=${encodeURIComponent(symbol)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo insights failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const result = Array.isArray(payload.finance?.result)
      ? payload.finance.result[0]
      : payload.finance?.result;

    if (!result) {
      throw new Error(`No Yahoo insights found for ${symbol}.`);
    }

    return result;
  });
}

async function getYahooFundamentals(symbol) {
  const types = [
    "quarterlyTotalDebt",
    "quarterlyStockholdersEquity",
    "quarterlyDilutedEPS",
    "quarterlyTotalRevenue",
    "quarterlyNetIncome",
    "annualDilutedEPS",
    "quarterlyOrdinarySharesNumber",
    "quarterlyShareIssued",
    "quarterlyBasicAverageShares"
  ];
  const period1 = Math.floor(Date.UTC(new Date().getUTCFullYear() - 6, 0, 1) / 1000);
  const period2 = Math.floor(Date.now() / 1000);

  return cached(`yahoo-fundamentals:${symbol}`, 12 * 60 * 60 * 1000, async () => {
    const params = new URLSearchParams({
      type: types.join(","),
      period1: String(period1),
      period2: String(period2)
    });

    const response = await fetch(
      `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo fundamentals failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const results = Array.isArray(payload.timeseries?.result) ? payload.timeseries.result : [];

    if (!results.length) {
      throw new Error(`No Yahoo fundamentals found for ${symbol}.`);
    }

    return results;
  });
}

function getSeriesTimestamp(entry) {
  return (
    Date.parse(
      entry?.asOfDate ||
        entry?.reportedDate ||
        entry?.period ||
        entry?.quarter ||
        entry?.endDate ||
        ""
    ) || 0
  );
}

function buildTimeseriesIndex(results) {
  const index = new Map();

  for (const item of results || []) {
    for (const [key, value] of Object.entries(item || {})) {
      if (key === "meta" || !Array.isArray(value) || !value.length) {
        continue;
      }

      index.set(
        key,
        [...value].sort((left, right) => getSeriesTimestamp(right) - getSeriesTimestamp(left))
      );
    }
  }

  return index;
}

function extractSeriesValue(node) {
  if (!node || typeof node !== "object") {
    return parseNumber(node);
  }

  return parseNumber(
    node.raw ??
      node.value ??
      node.reportedValue?.raw ??
      node.reportedValue?.value ??
      node.fmt
  );
}

function getSeriesValue(index, key, offset = 0) {
  const series = index.get(key) || [];
  return extractSeriesValue(series[offset]);
}

function sumSeriesValues(index, key, count) {
  const series = (index.get(key) || []).slice(0, count).map(extractSeriesValue);
  if (series.length < count || series.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return series.reduce((sum, value) => sum + value, 0);
}

function extractInsightText(node) {
  if (!node) {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return sanitizeText(node);
  }

  return sanitizeText(
    node.stateDescription ||
      node.signalDescription ||
      node.description ||
      node.signal ||
      node.shortDescription ||
      node.term ||
      node.text ||
      node.name ||
      node.rating ||
      node.value ||
      node.fmt
  );
}

function extractInsightNumber(node) {
  if (!node || typeof node !== "object") {
    return parseNumber(node);
  }

  return parseNumber(node.raw ?? node.value ?? node.price ?? node.targetPrice ?? node.fmt);
}

function extractTechnicalTone(node) {
  const text = extractInsightText(node).toLowerCase();
  if (!text) {
    return 0;
  }

  if (/\b(bullish|positive|uptrend|buy|improving|strong|up)\b/.test(text)) {
    return 1;
  }

  if (/\b(bearish|negative|downtrend|sell|weak|deteriorating|down)\b/.test(text)) {
    return -1;
  }

  return 0;
}

async function getNasdaqShortInterest(symbol) {
  return cached(`nasdaq-short-interest:${symbol}`, 24 * 60 * 60 * 1000, async () => {
    const response = await fetch(
      `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol.toLowerCase())}/short-interest?assetclass=stocks`,
      {
        headers: NASDAQ_HEADERS
      }
    );

    if (!response.ok) {
      throw new Error(`Nasdaq short interest failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const data = payload.data || {};
    const table = data.shortInterestTable || {};
    const row = Array.isArray(table.rows) ? table.rows[0] || {} : {};

    return {
      settlementDate: toIsoDate(row.settlementDate || data.settlementDate || table.settlementDate),
      interest: parseNumber(row.interest || data.interest || table.interest),
      avgDailyShareVolume: parseNumber(
        row.avgDailyShareVolume || data.avgDailyShareVolume || table.avgDailyShareVolume
      ),
      daysToCover: parseNumber(row.daysToCover || data.daysToCover || table.daysToCover)
    };
  });
}

async function getNasdaqEarningsCalendar(dateKey) {
  return cached(`nasdaq-earnings:${dateKey}`, 12 * 60 * 60 * 1000, async () => {
    const response = await fetch(
      `https://api.nasdaq.com/api/calendar/earnings?date=${encodeURIComponent(dateKey)}`,
      {
        headers: NASDAQ_HEADERS
      }
    );

    if (!response.ok) {
      throw new Error(`Nasdaq earnings calendar failed with status ${response.status}.`);
    }

    const payload = await response.json();
    return Array.isArray(payload.data?.rows) ? payload.data.rows : [];
  });
}

async function findNextNasdaqEarningsDate(symbol, maxDays = 90) {
  const normalizedSymbol = sanitizeText(symbol).toUpperCase();

  for (let offset = 0; offset <= maxDays; offset += 1) {
    const current = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
    const dateKey = toIsoDate(current);
    const rows = await getNasdaqEarningsCalendar(dateKey).catch(() => []);
    const match = rows.find(
      (row) => sanitizeText(row.symbol || row.ticker).toUpperCase() === normalizedSymbol
    );

    if (match) {
      return dateKey;
    }
  }

  return null;
}

async function getSecTickerMap() {
  return cached("sec-ticker-map", 24 * 60 * 60 * 1000, async () => {
    const response = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: SEC_HEADERS
    });

    if (!response.ok) {
      throw new Error(`SEC ticker map failed with status ${response.status}.`);
    }

    const payload = await response.json();
    return Object.values(payload);
  });
}

async function getSecCompanyBySymbol(symbol) {
  const tickers = await getSecTickerMap();
  const normalizedSymbol = symbol.toUpperCase();
  return (
    tickers.find((entry) => String(entry.ticker || "").toUpperCase() === normalizedSymbol) || null
  );
}

async function getSecSubmissions(cik) {
  const normalizedCik = String(cik).padStart(10, "0");
  return cached(`sec-submissions:${normalizedCik}`, 6 * 60 * 60 * 1000, async () => {
    const response = await fetch(
      `https://data.sec.gov/submissions/CIK${normalizedCik}.json`,
      { headers: SEC_HEADERS }
    );

    if (!response.ok) {
      throw new Error(`SEC submissions failed with status ${response.status}.`);
    }

    return response.json();
  });
}

function extractRecentFilingRows(submissions) {
  const recent = submissions?.filings?.recent;
  if (!recent?.form?.length) {
    return [];
  }

  return recent.form.map((form, index) => ({
    form,
    filingDate: recent.filingDate[index],
    accessionNumber: recent.accessionNumber[index],
    primaryDocument: recent.primaryDocument[index],
    primaryDocDescription: recent.primaryDocDescription[index]
  }));
}

function pickLatestFilings(submissions) {
  const rows = extractRecentFilingRows(submissions);
  const formsOfInterest = [
    ["8-K"],
    ["10-Q", "10-Q/A"],
    ["10-K", "10-K/A"],
    ["20-F", "6-K"]
  ];

  return formsOfInterest
    .map((group) => rows.find((row) => group.includes(row.form)))
    .filter(Boolean)
    .slice(0, 3);
}

async function getSecFilingText(cik, accessionNumber, primaryDocument) {
  const normalizedCik = String(Number(cik));
  const accessionWithoutDashes = String(accessionNumber).replace(/-/g, "");
  const cacheKey = `sec-filing:${normalizedCik}:${accessionWithoutDashes}:${primaryDocument}`;

  return cached(cacheKey, 24 * 60 * 60 * 1000, async () => {
    const url = `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${accessionWithoutDashes}/${primaryDocument}`;
    const response = await fetch(url, {
      headers: {
        ...SEC_HEADERS,
        Accept: "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      throw new Error(`SEC filing fetch failed with status ${response.status}.`);
    }

    return response.text();
  });
}

function extractKeywordSnippets(text, keywords, limit = 2) {
  const plain = stripHtml(text).replace(/\s+/g, " ");
  const sentences =
    plain.match(/[^.!?]{40,320}[.!?]/g)?.map((sentence) => sanitizeText(sentence)) || [];

  return Array.from(
    new Set(
      sentences.filter((sentence) => keywords.some((pattern) => pattern.test(sentence)))
    )
  )
    .slice(0, limit)
    .map((sentence) => trimSummary(sentence));
}

async function getEdgarContext(symbol) {
  const company = await getSecCompanyBySymbol(symbol);
  if (!company) {
    return null;
  }

  const submissions = await getSecSubmissions(company.cik_str);
  const filings = pickLatestFilings(submissions);
  const guidanceKeywords = [
    /\bguidance\b/i,
    /\boutlook\b/i,
    /\bforecast\b/i,
    /\bexpect(?:s|ed|ation)?\b/i,
    /\brevenue\b/i,
    /\bmargin\b/i,
    /\bremaining performance obligation\b/i
  ];

  const guidance = [];
  for (const filing of filings.slice(0, 2)) {
    try {
      const filingText = await getSecFilingText(
        company.cik_str,
        filing.accessionNumber,
        filing.primaryDocument
      );
      guidance.push(
        ...extractKeywordSnippets(filingText, guidanceKeywords).map((snippet) => ({
          form: filing.form,
          filingDate: filing.filingDate,
          text: snippet
        }))
      );
    } catch {
      // Ignore per-filing fetch failures and keep the rest of the card functional.
    }
  }

  const highlights = [];
  if (submissions.category) {
    highlights.push(`SEC filer category: ${sanitizeText(submissions.category)}.`);
  }

  filings.forEach((filing) => {
    const label = filing.primaryDocDescription || filing.form;
    highlights.push(`Recent ${filing.form}: ${sanitizeText(label)}.`);
  });

  return {
    cik: String(company.cik_str).padStart(10, "0"),
    companyName: sanitizeText(submissions.name || company.title),
    sicDescription: sanitizeText(submissions.sicDescription),
    filerCategory: sanitizeText(submissions.category),
    filings,
    guidance: guidance.slice(0, 3),
    highlights: highlights.slice(0, 4)
  };
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value) {
  return sanitizeText(decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " ")));
}

function getPreferredSourceMeta(hostname = "") {
  const normalizedHost = hostname.replace(/^www\./, "").toLowerCase();
  const index = preferredNewsSources.findIndex((source) =>
    source.domains.some(
      (domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
    )
  );

  if (index === -1) {
    return {
      priority: preferredNewsSources.length + 1,
      label: normalizedHost || "Source"
    };
  }

  return {
    priority: index,
    label: preferredNewsSources[index].label
  };
}

function isPreferredNewsHost(hostname = "") {
  const normalizedHost = hostname.replace(/^www\./, "").toLowerCase();
  return preferredNewsSources.some((source) =>
    source.domains.some(
      (domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
    )
  );
}

function isAllowedBroaderNewsHost(hostname = "") {
  const normalizedHost = hostname.replace(/^www\./, "").toLowerCase();
  return (
    isPreferredNewsHost(normalizedHost) ||
    broaderBusinessNewsSources.some(
      (domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
    )
  );
}

function isBareTickerAlias(alias) {
  return /^[A-Z]{1,5}$/.test(sanitizeText(alias));
}

function getCompanyAliases(entry, companyName) {
  const curated = knownCompanyProfiles[entry.symbol] || knownCompanyProfiles[entry.id];
  const normalizedCompanyName = sanitizeText(companyName);
  const normalizedSymbol = sanitizeText(entry.symbol).toUpperCase();
  const normalizedLabel = sanitizeText(entry.label);
  const rawAliases = [
    normalizedCompanyName,
    normalizedLabel &&
    !(
      normalizedSymbol &&
      normalizedLabel.toUpperCase() === normalizedSymbol &&
      normalizedCompanyName &&
      normalizedCompanyName.toUpperCase() !== normalizedSymbol
    )
      ? normalizedLabel
      : null,
    entry.query,
    ...((!normalizedCompanyName || normalizedCompanyName.toUpperCase() === normalizedSymbol) &&
    normalizedSymbol
      ? [normalizedSymbol]
      : []),
    ...(curated?.aliases || [])
  ];
  const dedupedAliases = Array.from(
    new Set(
      rawAliases
        .map((alias) => sanitizeText(alias))
        .filter(Boolean)
    )
  );
  const hasDescriptiveAlias = dedupedAliases.some((alias) => !isBareTickerAlias(alias));

  return dedupedAliases.filter((alias) => !hasDescriptiveAlias || !isBareTickerAlias(alias));
}

function parseRelativeTimestamp(label) {
  const clean = sanitizeText(label).toLowerCase();
  if (!clean) {
    return null;
  }

  const now = new Date();
  const minutesMatch = clean.match(/(\d+)\s*minute/);
  if (minutesMatch) {
    return new Date(now.getTime() - Number(minutesMatch[1]) * 60 * 1000).toISOString();
  }

  const hoursMatch = clean.match(/(\d+)\s*hour/);
  if (hoursMatch) {
    return new Date(now.getTime() - Number(hoursMatch[1]) * 60 * 60 * 1000).toISOString();
  }

  const daysMatch = clean.match(/(\d+)\s*day/);
  if (daysMatch) {
    return new Date(now.getTime() - Number(daysMatch[1]) * 24 * 60 * 60 * 1000).toISOString();
  }

  if (clean.includes("yesterday")) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }

  const directDate = new Date(label);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate.toISOString();
  }

  return null;
}

function extractTimeLabel(block) {
  const matches = [...block.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);
  return (
    matches.find((value) =>
      /minute|hour|day|yesterday|\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2,8}\s+\d{1,2}/i.test(value)
    ) || ""
  );
}

function splitBingNewsBlocks(html) {
  return html
    .split('<div class="news-card newsitem cardcommon"')
    .slice(1)
    .map((segment) => segment.split('<div class="news_eae_container')[0]);
}

function parseBingNewsResults(html, aliases) {
  const loweredAliases = aliases.map((alias) => alias.toLowerCase());
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return splitBingNewsBlocks(html)
    .map((block) => {
      const url = decodeHtmlEntities(
        block.match(/data-url="([^"]+)"/)?.[1] ||
          block.match(/class="title"[^>]*href="([^"]+)"/)?.[1] ||
          ""
      );
      const title = stripHtml(
        block.match(/data-title="([^"]+)"/)?.[1] ||
          block.match(/<h2 class="[^"]*">([\s\S]*?)<\/h2>/)?.[1] ||
          ""
      );
      const snippet = stripHtml(
        block.match(/<div class="snippet"[^>]*title="([^"]*)"/)?.[1] ||
          block.match(/<div class="snippet"[^>]*>([\s\S]*?)<\/div>/)?.[1] ||
          ""
      );
      const source = stripHtml(
        block.match(/data-author="([^"]+)"/)?.[1] ||
          block.match(/aria-label="Search news from ([^"]+)"/)?.[1] ||
          ""
      );
      const timeLabel = decodeHtmlEntities(extractTimeLabel(block));
      const publishedAt = parseRelativeTimestamp(timeLabel);

      if (!url || !title) {
        return null;
      }

      let hostname = "";
      try {
        hostname = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        hostname = "";
      }

      const haystack = `${title} ${snippet}`.toLowerCase();
      const titleMatch = loweredAliases.some((alias) => title.toLowerCase().includes(alias));
      const snippetMatch = loweredAliases.some((alias) => haystack.includes(alias));
      if (!titleMatch && !snippetMatch) {
        return null;
      }

      if (publishedAt && new Date(publishedAt).getTime() < sevenDaysAgo) {
        return null;
      }

      const sourceMeta = getPreferredSourceMeta(hostname);
      return {
        title,
        url,
        source: source || sourceMeta.label,
        sourceDomain: hostname,
        publishedAt,
        summary: snippet || title,
        priority: sourceMeta.priority,
        score: (titleMatch ? 4 : 0) + (snippetMatch ? 2 : 0)
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.priority - right.priority || right.score - left.score)
    .filter((article, index, collection) =>
      collection.findIndex((candidate) => candidate.url === article.url) === index
    );
}

function buildCuratedNewsItems(rawResults, companyName) {
  return rawResults.slice(0, 5).map((article) => ({
    title: sanitizeText(article.title),
    url: article.url,
    source: sanitizeText(article.source),
    sourceDomain: sanitizeText(article.sourceDomain),
    publishedAt: article.publishedAt,
    summary: trimSummary(article.summary),
    whyCare: getWhyCare(article, companyName),
    sentimentLabel: null,
    topics: []
  }));
}

async function searchBingNews(query, aliases, cacheKey) {
  return cached(cacheKey, 20 * 60 * 1000, async () => {
    const params = new URLSearchParams({
      q: query,
      qft: 'sortbydate="1"'
    });

    const response = await fetch(`https://www.bing.com/news/search?${params.toString()}`, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Curated news search failed with status ${response.status}.`);
    }

    const html = await response.text();
    if (
      /This site can'?t be reached/i.test(html) ||
      /Please complete the following challenge/i.test(html) ||
      /Unfortunately, bots use/i.test(html)
    ) {
      throw new Error("Curated news search was blocked upstream. Please refresh and try again.");
    }

    return parseBingNewsResults(html, aliases);
  });
}

async function searchCuratedNews(entry, companyName) {
  const aliases = getCompanyAliases(entry, companyName);
  const aliasQuery = aliases
    .map((alias) => (alias.includes(" ") ? `"${alias}"` : alias))
    .join(" OR ");
  const preferredQuery = `(${aliasQuery}) (${preferredNewsDomainQuery})`;
  const preferredResults = await searchBingNews(
    preferredQuery,
    aliases,
    `bing-news:preferred:${preferredQuery}`
  );

  if (preferredResults.length >= 3) {
    return preferredResults;
  }

  const broaderQuery = `(${aliasQuery})`;
  const broaderResults = await searchBingNews(
    broaderQuery,
    aliases,
    `bing-news:broader:${broaderQuery}`
  );
  const filteredBroaderResults = broaderResults.filter((article) =>
    isAllowedBroaderNewsHost(article.sourceDomain)
  );

  return [...preferredResults, ...filteredBroaderResults].filter(
    (article, index, collection) =>
      collection.findIndex((candidate) => candidate.url === article.url) === index
  );
}

function buildAnalystReactions(rawResults) {
  return rawResults.slice(0, 3).map((article) => ({
    title: sanitizeText(article.title),
    url: article.url,
    source: sanitizeText(article.source),
    publishedAt: article.publishedAt,
    summary: trimSummary(article.summary),
    tone: getAnalystTone(`${article.title} ${article.summary}`)
  }));
}

function getAnalystTone(text) {
  const lowered = sanitizeText(text).toLowerCase();
  if (/\b(upgrade|raises|raised|outperform|overweight|buy rating|bullish|positive)\b/.test(lowered)) {
    return "Positive";
  }

  if (/\b(downgrade|cuts|cut|underperform|underweight|sell rating|bearish|negative)\b/.test(lowered)) {
    return "Negative";
  }

  return "Mixed";
}

async function searchAnalystReactions(entry, companyName) {
  const aliases = getCompanyAliases(entry, companyName);
  const aliasQuery = aliases
    .map((alias) => (alias.includes(" ") ? `"${alias}"` : alias))
    .join(" OR ");
  const analystQuery =
    '(analyst OR analysts OR downgrade OR upgrade OR "price target" OR rating OR initiate OR reiterate)';

  const preferredResults = await searchBingNews(
    `(${aliasQuery}) ${analystQuery} (${preferredNewsDomainQuery})`,
    aliases,
    `bing-analyst:preferred:${entry.id}`
  );

  if (preferredResults.length) {
    return preferredResults;
  }

  const broaderResults = await searchBingNews(
    `(${aliasQuery}) ${analystQuery}`,
    aliases,
    `bing-analyst:broader:${entry.id}`
  );

  return broaderResults.filter((article) => isAllowedBroaderNewsHost(article.sourceDomain));
}

function buildTopicLabel(item) {
  return sanitizeText(item?.topic || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function articleMentionsSymbol(article, symbol) {
  return (article.ticker_sentiment || []).some(
    (item) => String(item.ticker || "").toUpperCase() === symbol.toUpperCase()
  );
}

function scoreArticleRelevance(article, symbol) {
  const sentimentMatch = (article.ticker_sentiment || []).find(
    (item) => String(item.ticker || "").toUpperCase() === symbol.toUpperCase()
  );
  const baseScore = parseNumber(sentimentMatch?.relevance_score) || 0;
  const overall = parseNumber(article.overall_sentiment_score) || 0;
  return baseScore * 2 + Math.abs(overall);
}

function parsePublishedTimestamp(value) {
  if (!value || typeof value !== "string" || value.length < 13) {
    return null;
  }

  const isoValue = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(
    9,
    11
  )}:${value.slice(11, 13)}:00Z`;

  const date = new Date(isoValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sentenceCase(value) {
  const text = sanitizeText(value);
  if (!text) {
    return "";
  }

  return text[0].toUpperCase() + text.slice(1);
}

function extractThemes(...textBlocks) {
  const combined = textBlocks.map(sanitizeText).join(" ").toLowerCase();

  return themeDefinitions
    .filter((definition) => definition.keywords.some((keyword) => combined.includes(keyword)))
    .map((definition) => ({
      id: definition.id,
      title: definition.title,
      leverage: definition.leverage
    }));
}

function getWhyCare(article, companyName) {
  const text = `${sanitizeText(article.title)} ${sanitizeText(article.summary)}`.toLowerCase();
  const signals = [];

  if (/\b(earnings|guidance|forecast|revenue|margin|profit)\b/.test(text)) {
    signals.push(
      "This changes budget confidence and buying appetite, so it is useful for timing platform and expansion conversations."
    );
  }

  if (/\b(launch|release|introduce|debut|roadmap|preview)\b/.test(text)) {
    signals.push(
      "A product move creates a near-term opening to insert NVIDIA-enabled differentiation before the story hardens in the market."
    );
  }

  if (/\b(partnership|partner|alliance|collaboration|joint)\b/.test(text)) {
    signals.push(
      "Partnership news usually signals ecosystem motion, which is the right moment to look for co-sell, marketplace, and reference-architecture hooks."
    );
  }

  if (/\b(government|federal|department|agency|public sector|usda|defense)\b/.test(text)) {
    signals.push(
      "This signals public-sector traction, which matters for regulated deployments, sovereign AI positioning, and credibility with risk-sensitive buyers."
    );
  }

  if (/\b(ai|genai|agent|copilot|model|inference|automation)\b/.test(text)) {
    signals.push(
      "The article is tied to enterprise AI adoption, which is directly relevant to where NVIDIA can influence architecture, performance, and monetization."
    );
  }

  if (/\b(employee|workforce|culture|talent|layoff)\b/.test(text)) {
    signals.push(
      "This is an execution-health signal. Internal turbulence can slow product delivery, partner motion, and field responsiveness even when demand remains intact."
    );
  }

  if (/\b(acquisition|buy|merger|restructuring|layoff|cut)\b/.test(text)) {
    signals.push(
      "This can change account priorities and partner maps quickly, so it is worth checking for disruption risk or whitespace."
    );
  }

  if (!signals.length) {
    signals.push(
      `${companyName} is in motion, and even general corporate updates can affect timing, messaging, and which executive stakeholders will engage.`
    );
  }

  return signals[0];
}

function trimSummary(summary) {
  const clean = sanitizeText(summary);
  if (clean.length <= 220) {
    return clean;
  }

  return `${clean.slice(0, 217).trim()}...`;
}

function buildNewsItems(feed, companyName, symbol) {
  const relevantArticles = feed
    .filter((article) => articleMentionsSymbol(article, symbol))
    .sort((left, right) => scoreArticleRelevance(right, symbol) - scoreArticleRelevance(left, symbol))
    .slice(0, 5);

  return relevantArticles.map((article) => ({
    title: sanitizeText(article.title),
    url: article.url,
    source: sanitizeText(article.source),
    sourceDomain: sanitizeText(article.source_domain),
    publishedAt: parsePublishedTimestamp(article.time_published),
    summary: trimSummary(article.summary),
    whyCare: getWhyCare(article, companyName),
    sentimentLabel: sentenceCase(article.overall_sentiment_label),
    topics: compact((article.topics || []).map(buildTopicLabel)).slice(0, 4)
  }));
}

function buildCompanyNewsItems(feed, companyName) {
  const matcher = companyName.toLowerCase();

  const relevantArticles = feed
    .filter((article) => {
      const haystack = `${sanitizeText(article.title)} ${sanitizeText(article.summary)}`.toLowerCase();
      return haystack.includes(matcher);
    })
    .slice(0, 5);

  return relevantArticles.map((article) => ({
    title: sanitizeText(article.title),
    url: article.url,
    source: sanitizeText(article.source),
    sourceDomain: sanitizeText(article.source_domain),
    publishedAt: parsePublishedTimestamp(article.time_published),
    summary: trimSummary(article.summary),
    whyCare: getWhyCare(article, companyName),
    sentimentLabel: sentenceCase(article.overall_sentiment_label),
    topics: compact((article.topics || []).map(buildTopicLabel)).slice(0, 4)
  }));
}

function buildStrategyNotes({ companyName, description, themes, newsItems, sector, industry }) {
  const notes = [];

  if (themes[0]) {
    notes.push(themes[0].leverage);
  }

  if (sector || industry) {
    notes.push(
      `Keep messaging anchored in ${compact([sector, industry]).join(" / ")} value pools so outbound feels native to the buyer's current priorities.`
    );
  }

  if (newsItems[0]) {
    notes.push(
      `Use the latest ${sanitizeText(newsItems[0].source)} coverage as a conversation starter, especially with executives shaping AI roadmap, budget, or partner decisions.`
    );
  }

  if (/marketplace|partner|ecosystem|cloud/i.test(description)) {
    notes.push(
      "There is clear ecosystem language in the company profile, which usually means partner-ready packaging and solution briefs will land better than raw infrastructure pitches."
    );
  }

  if (!notes.length) {
    notes.push(
      `Use recent ${companyName} announcements to test where AI budget, platform ownership, and partner influence are consolidating before you commit field resources.`
    );
  }

  return Array.from(new Set(notes)).slice(0, 3);
}

function buildWatchouts({ newsItems, overview }) {
  const watchouts = [];
  const combinedNewsText = newsItems.map((item) => `${item.title} ${item.summary}`).join(" ");

  if (overview.analystTargetPrice && overview.price && overview.price > overview.analystTargetPrice) {
    watchouts.push("Valuation already sits above analyst target, so expectations may be harder to beat.");
  }

  if (newsItems.some((item) => /(negative|bearish)/i.test(item.sentimentLabel))) {
    watchouts.push("Recent article sentiment includes negative coverage, so prep for budget or execution objections.");
  }

  if (/\b(drop|drops|fell|falls|plunge|plunges|selloff|fear|margin pressure)\b/i.test(combinedNewsText)) {
    watchouts.push("Recent coverage points to execution or market-confidence pressure, so expect tougher questions on ROI, urgency, and near-term stability.");
  }

  if (newsItems.some((item) => /restructuring|layoff|cut/i.test(`${item.title} ${item.summary}`))) {
    watchouts.push("Operational reset signals can slow partner motion even when strategy still looks strong.");
  }

  return watchouts.slice(0, 2);
}

function buildHighlights({ market, secContext, newsItems, analystReactions }) {
  const highlights = [];

  if (market.ytdChangePercent) {
    highlights.push(`Shares are ${market.ytdChangePercent} year to date.`);
  }

  if (secContext?.filings?.[0]) {
    highlights.push(`Latest SEC signal: ${secContext.filings[0].form} is on file.`);
  }

  if (newsItems[0]) {
    highlights.push(`Latest headline driver: ${newsItems[0].title}`);
  }

  if (analystReactions[0]) {
    highlights.push(`Recent analyst read: ${analystReactions[0].title}`);
  }

  return highlights.slice(0, 4);
}

function buildShortTermOutlook({ market, watchouts, newsItems, analystReactions, secContext }) {
  let score = 0;
  const reasons = [];

  if (Number.isFinite(market.rawYtdChangePercent)) {
    if (market.rawYtdChangePercent >= 10) {
      score += 1;
      reasons.push(`YTD performance is strong at ${market.ytdChangePercent}.`);
    } else if (market.rawYtdChangePercent <= -10) {
      score -= 1;
      reasons.push(`YTD performance is weak at ${market.ytdChangePercent}.`);
    }
  }

  if (Number.isFinite(market.rawOneMonthChangePercent)) {
    if (market.rawOneMonthChangePercent >= 5) {
      score += 1;
      reasons.push(`The last 30 days show positive momentum at ${market.oneMonthChangePercent}.`);
    } else if (market.rawOneMonthChangePercent <= -5) {
      score -= 1;
      reasons.push(`The last 30 days show pressure at ${market.oneMonthChangePercent}.`);
    }
  }

  const positiveAnalysts = analystReactions.filter((item) => item.tone === "Positive").length;
  const negativeAnalysts = analystReactions.filter((item) => item.tone === "Negative").length;
  if (positiveAnalysts > negativeAnalysts) {
    score += 1;
    reasons.push("Analyst reaction flow is net constructive.");
  } else if (negativeAnalysts > positiveAnalysts) {
    score -= 1;
    reasons.push("Analyst reaction flow is net cautious.");
  }

  if (secContext?.guidance?.length) {
    score += 1;
    reasons.push("Recent SEC filing language includes explicit guidance or outlook commentary.");
  }

  if (watchouts.length) {
    score -= 1;
    reasons.push(watchouts[0]);
  }

  if (
    newsItems.some((item) =>
      /\b(contract|deal|partnership|expansion|launch|ga|general availability)\b/i.test(
        `${item.title} ${item.summary}`
      )
    )
  ) {
    score += 1;
  }

  let label = "Mixed";
  if (score >= 2) {
    label = "Constructive";
  } else if (score <= -2) {
    label = "Pressured";
  }

  return {
    label,
    summary:
      reasons.slice(0, 2).join(" ") ||
      "Short-term outlook is being driven more by narrative flow than by a single decisive signal."
  };
}

function buildMarketPosition(quote, overview) {
  const price = quote.price;
  const low = overview.weekLow52;
  const high = overview.weekHigh52;

  if (!Number.isFinite(price) || !Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    return null;
  }

  return Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
}

function buildProfile(entry, overview) {
  const curated = knownCompanyProfiles[entry.symbol] || knownCompanyProfiles[entry.id];

  return {
    name: overview?.name || curated?.name || null,
    description:
      overview?.description ||
      curated?.description ||
      "Profile data is temporarily unavailable. The card is still useful for tracking narrative and market movement.",
    sector: overview?.sector || curated?.sector || null,
    industry: overview?.industry || curated?.industry || null,
    marketCap: overview?.marketCap ?? null,
    peRatio: overview?.peRatio ?? null,
    analystTargetPrice: overview?.analystTargetPrice ?? null,
    revenueTTM: overview?.revenueTTM ?? null,
    beta: overview?.beta ?? null,
    weekHigh52: overview?.weekHigh52 ?? null,
    weekLow52: overview?.weekLow52 ?? null
  };
}

function isTickerLikeName(name, entry) {
  const normalizedName = sanitizeText(name).toUpperCase();
  const normalizedSymbol = sanitizeText(entry?.symbol).toUpperCase();
  const normalizedLabel = sanitizeText(entry?.label).toUpperCase();

  if (!normalizedName) {
    return true;
  }

  return Boolean(
    normalizedName === normalizedSymbol ||
    normalizedName === normalizedLabel
  );
}

function mergeMarketData(alphaQuote, yahooMarket, profile) {
  const selectedPrice = alphaQuote?.price ?? yahooMarket?.price ?? null;
  const selectedChange = alphaQuote?.change ?? yahooMarket?.change ?? null;
  const selectedChangePercent = alphaQuote?.changePercent ?? yahooMarket?.changePercent ?? null;

  return {
    price: toCurrency(selectedPrice),
    rawPrice: selectedPrice,
    dayChange: toCurrency(selectedChange),
    dayChangePercent: toPercent(selectedChangePercent),
    rawDayChangePercent: selectedChangePercent,
    marketCap: toCompactNumber(profile.marketCap),
    peRatio: profile.peRatio ? profile.peRatio.toFixed(1) : null,
    analystTarget: toCurrency(profile.analystTargetPrice),
    revenueTTM: toCompactNumber(profile.revenueTTM),
    beta: profile.beta ? profile.beta.toFixed(2) : null,
    ytdChangePercent: toPercent(yahooMarket?.ytdChangePercent ?? null),
    rawYtdChangePercent: yahooMarket?.ytdChangePercent ?? null,
    oneMonthChangePercent: toPercent(yahooMarket?.oneMonthChangePercent ?? null),
    rawOneMonthChangePercent: yahooMarket?.oneMonthChangePercent ?? null,
    rangeLow: toCurrency(profile.weekLow52 ?? yahooMarket?.weekLow52 ?? null),
    rangeHigh: toCurrency(profile.weekHigh52 ?? yahooMarket?.weekHigh52 ?? null),
    rangePosition: buildMarketPosition(
      { price: selectedPrice },
      {
        weekLow52: profile.weekLow52 ?? yahooMarket?.weekLow52 ?? null,
        weekHigh52: profile.weekHigh52 ?? yahooMarket?.weekHigh52 ?? null
      }
    ),
    quoteStatus: alphaQuote?.price
      ? alphaQuote?.isFallback
        ? "alpha_snapshot"
        : "alpha_live"
      : yahooMarket?.price
        ? "yahoo_fallback"
        : "unavailable"
  };
}

function buildTickerCard(entry, marketBundle, secContext, newsFeed, analystFeed) {
  const { alphaQuote, overview, yahooMarket } = marketBundle;
  const profile = buildProfile(entry, overview);
  if (isTickerLikeName(profile.name, entry) && !isTickerLikeName(yahooMarket?.companyName, entry)) {
    profile.name = yahooMarket.companyName;
  }
  if (!profile.weekHigh52 && yahooMarket?.weekHigh52) {
    profile.weekHigh52 = yahooMarket.weekHigh52;
  }
  if (!profile.weekLow52 && yahooMarket?.weekLow52) {
    profile.weekLow52 = yahooMarket.weekLow52;
  }
  if (isTickerLikeName(profile.name, entry) && !isTickerLikeName(secContext?.companyName, entry)) {
    profile.name = secContext.companyName;
  }
  if (!profile.industry && secContext?.sicDescription) {
    profile.industry = secContext.sicDescription;
  }

  const newsItems = buildCuratedNewsItems(newsFeed, profile.name || entry.label);
  const analystReactions = buildAnalystReactions(analystFeed);
  const themes = extractThemes(profile.description, ...newsItems.map((item) => `${item.title} ${item.summary}`));
  const companyName = profile.name || secContext?.companyName || yahooMarket?.companyName || entry.label || entry.symbol;
  const watchouts = buildWatchouts({
    newsItems,
    overview: {
      ...profile,
      price: alphaQuote?.price ?? yahooMarket?.price ?? null
    }
  });
  const market = mergeMarketData(alphaQuote, yahooMarket, profile);
  const outlook = buildShortTermOutlook({
    market,
    watchouts,
    newsItems,
    analystReactions,
    secContext
  });

  return {
    id: entry.id,
    mode: "ticker",
    symbol: entry.symbol,
    companyName,
    label: entry.label,
    market,
    company: {
      sector: profile.sector || null,
      industry: profile.industry || null
    },
    highlights: buildHighlights({
      market,
      secContext,
      newsItems,
      analystReactions
    }),
    sec: secContext || {
      cik: null,
      filerCategory: null,
      filings: [],
      guidance: [],
      highlights: ["No SEC EDGAR context available for this symbol."]
    },
    analystReactions,
    outlook,
    themes,
    strategyNotes: buildStrategyNotes({
      companyName,
      description: profile.description,
      themes,
      newsItems,
      sector: profile.sector,
      industry: profile.industry
    }),
    watchouts,
    newsItems
  };
}

function buildCompanyOnlyCard(entry, newsFeed, analystFeed) {
  const newsItems = buildCuratedNewsItems(newsFeed, entry.query);
  const analystReactions = buildAnalystReactions(analystFeed);
  const curated = knownCompanyProfiles[entry.id];
  const companyName = entry.label || entry.query;
  const themes = extractThemes(
    curated?.description || entry.query,
    ...newsItems.map((item) => `${item.title} ${item.summary}`)
  );
  const market = {
    price: null,
    rawPrice: null,
    dayChange: null,
    dayChangePercent: null,
    rawDayChangePercent: null,
    marketCap: null,
    peRatio: null,
    analystTarget: null,
    revenueTTM: null,
    beta: null,
    ytdChangePercent: null,
    rawYtdChangePercent: null,
    oneMonthChangePercent: null,
    rawOneMonthChangePercent: null,
    quoteStatus: "narrative",
    rangeLow: null,
    rangeHigh: null,
    rangePosition: null
  };
  const watchouts = buildWatchouts({ newsItems, overview: {} });
  const outlook = buildShortTermOutlook({
    market,
    watchouts,
    newsItems,
    analystReactions,
    secContext: null
  });

  return {
    id: entry.id,
    mode: "company",
    symbol: null,
    companyName,
    label: companyName,
    market,
    company: {
      sector: curated?.sector || null,
      industry: curated?.industry || null
    },
    highlights: buildHighlights({
      market,
      secContext: null,
      newsItems,
      analystReactions
    }),
    sec: {
      cik: null,
      filerCategory: null,
      filings: [],
      guidance: [],
      highlights: ["No SEC EDGAR data is expected because this entry is in company-name mode."]
    },
    analystReactions,
    outlook,
    themes,
    strategyNotes: buildStrategyNotes({
      companyName,
      description: curated?.description || companyName,
      themes,
      newsItems,
      sector: null,
      industry: null
    }),
    watchouts,
    newsItems
  };
}

function getInvestorSentimentLabel(text) {
  const lowered = sanitizeText(text).toLowerCase();
  if (
    /\b(beat|beats|raise|raises|raised|upgrade|upgraded|bullish|surge|strong|outperform|overweight)\b/.test(
      lowered
    )
  ) {
    return "Positive";
  }

  if (
    /\b(miss|misses|cut|cuts|cutting|downgrade|downgraded|bearish|slump|weak|underperform|underweight|probe|lawsuit)\b/.test(
      lowered
    )
  ) {
    return "Negative";
  }

  return "Mixed";
}

function getInvestorWhyCare(article, companyName) {
  const text = `${sanitizeText(article.title)} ${sanitizeText(article.summary)}`.toLowerCase();

  if (/\b(earnings|guidance|forecast|margin|revenue|eps)\b/.test(text)) {
    return "This can reset near-term expectations fast, which often moves both the price range and the risk of analyst estimate revisions.";
  }

  if (/\b(partnership|deal|customer|contract|expansion|launch|product)\b/.test(text)) {
    return "This is a demand or execution signal. It helps confirm whether the thesis is improving, stalling, or getting new catalyst support.";
  }

  if (/\b(ai|chip|platform|cloud|data center|software)\b/.test(text)) {
    return "This matters for multiple expansion and competitive positioning because narrative leadership tends to influence how aggressively the market prices future growth.";
  }

  if (/\b(regulator|regulatory|probe|antitrust|lawsuit|legal|ban|tariff)\b/.test(text)) {
    return "This is a downside-risk signal. Regulatory or legal friction can compress valuation quickly even if the operating story remains intact.";
  }

  if (/\b(layoff|restructuring|cost cut|job cut)\b/.test(text)) {
    return "This can help margins in the short term, but it can also signal demand pressure or execution stress that needs closer scrutiny.";
  }

  return `${companyName} is in motion, and headline flow can change both trade timing and conviction even when the longer-term thesis is unchanged.`;
}

function buildInvestorNewsItems(rawResults, companyName) {
  const relevantResults = rawResults.filter((article) => article.publishedAt);
  const selectedResults = (relevantResults.length ? relevantResults : rawResults).slice(0, 5);

  return selectedResults.map((article) => ({
    title: sanitizeText(article.title),
    url: article.url,
    source: sanitizeText(article.source),
    sourceDomain: sanitizeText(article.sourceDomain),
    publishedAt: article.publishedAt,
    summary: trimSummary(article.summary),
    whyCare: getInvestorWhyCare(article, companyName),
    sentimentLabel: getInvestorSentimentLabel(`${article.title} ${article.summary}`),
    topics: []
  }));
}

function buildInvestorAnalystReactions(rawResults) {
  const relevantResults = rawResults.filter((article) => article.publishedAt);
  const selectedResults = (relevantResults.length ? relevantResults : rawResults).slice(0, 3);

  return selectedResults.map((article) => ({
    title: sanitizeText(article.title),
    url: article.url,
    source: sanitizeText(article.source),
    publishedAt: article.publishedAt,
    summary: trimSummary(article.summary),
    tone: getAnalystTone(`${article.title} ${article.summary}`)
  }));
}

function buildPersonalIdentity(entry, searchProfile, chart, insights) {
  const chartName = sanitizeText(chart?.meta?.longName || chart?.meta?.shortName);
  const searchName = sanitizeText(searchProfile?.name);
  let companyName = searchName || chartName || entry.label || entry.symbol;

  if (isTickerLikeName(companyName, entry) && chartName && !isTickerLikeName(chartName, entry)) {
    companyName = chartName;
  }

  if (isTickerLikeName(companyName, entry) && searchName && !isTickerLikeName(searchName, entry)) {
    companyName = searchName;
  }

  const snapshot = insights?.companySnapshot || {};

  return {
    companyName,
    sector:
      sanitizeText(searchProfile?.sector) ||
      extractInsightText(snapshot.sectorInfo || snapshot.company?.sectorInfo) ||
      null,
    industry:
      sanitizeText(searchProfile?.industry) ||
      extractInsightText(snapshot.company?.industry || snapshot.industryInfo) ||
      null,
    exchange: sanitizeText(searchProfile?.exchange) || null
  };
}

function buildPersonalMarketSnapshot(symbol, chart, timeseriesIndex, insights, shortInterest, fallbackEarningsDate) {
  const points = chart ? extractYahooPoints(chart) : [];
  const latestPoint = points.at(-1) || null;
  const meta = chart?.meta || {};
  const currentPrice = parseNumber(meta.regularMarketPrice) ?? latestPoint?.close ?? null;
  const previousClose =
    parseNumber(meta.previousClose) ??
    points.at(-2)?.close ??
    parseNumber(meta.chartPreviousClose) ??
    points.findLast((point) => point.close !== currentPrice)?.close ??
    null;
  const dayChange =
    Number.isFinite(currentPrice) && Number.isFinite(previousClose)
      ? currentPrice - previousClose
      : null;
  const dayChangePercent = calculateChangePercent(currentPrice, previousClose);
  const trailingEps =
    sumSeriesValues(timeseriesIndex, "quarterlyDilutedEPS", 4) ??
    getSeriesValue(timeseriesIndex, "annualDilutedEPS");
  const sharesOutstanding =
    getSeriesValue(timeseriesIndex, "quarterlyOrdinarySharesNumber") ??
    getSeriesValue(timeseriesIndex, "quarterlyShareIssued") ??
    getSeriesValue(timeseriesIndex, "quarterlyBasicAverageShares");
  const latestRevenue = getSeriesValue(timeseriesIndex, "quarterlyTotalRevenue");
  const priorRevenue = getSeriesValue(timeseriesIndex, "quarterlyTotalRevenue", 4);
  const latestQuarterEps = getSeriesValue(timeseriesIndex, "quarterlyDilutedEPS");
  const priorQuarterEps = getSeriesValue(timeseriesIndex, "quarterlyDilutedEPS", 4);
  const latestNetIncome = getSeriesValue(timeseriesIndex, "quarterlyNetIncome");
  const latestDebt = getSeriesValue(timeseriesIndex, "quarterlyTotalDebt");
  const latestEquity = getSeriesValue(timeseriesIndex, "quarterlyStockholdersEquity");
  const revenueGrowthPercent = calculateChangePercent(latestRevenue, priorRevenue);
  const epsGrowthPercent = calculateChangePercent(latestQuarterEps, priorQuarterEps);
  const netMarginPercent = safeDivide(latestNetIncome, latestRevenue);
  const roePercent = safeDivide(latestNetIncome * 4, latestEquity);
  const debtToEquity = safeDivide(latestDebt, latestEquity);
  const marketCap =
    Number.isFinite(currentPrice) && Number.isFinite(sharesOutstanding)
      ? currentPrice * sharesOutstanding
      : null;
  const dividendYield = extractDividendYield(chart, currentPrice);
  const peRatio =
    Number.isFinite(currentPrice) && Number.isFinite(trailingEps) && trailingEps > 0
      ? currentPrice / trailingEps
      : null;
  const instrumentInfo = insights?.instrumentInfo || {};
  const recommendation = instrumentInfo.recommendation || {};
  const keyTechnicals = instrumentInfo.keyTechnicals || {};
  const valuation = instrumentInfo.valuation || {};
  const targetPrice = parseNumber(recommendation.targetPrice);
  const targetUpsidePercent = calculateChangePercent(targetPrice, currentPrice);
  const valuationDiscountPercent = normalizePercentUnits(valuation.discount);
  const support = extractInsightNumber(keyTechnicals.support);
  const resistance = extractInsightNumber(keyTechnicals.resistance);
  const stopLoss = extractInsightNumber(keyTechnicals.stopLoss);
  const shortInterestPercent = safeDivide(shortInterest?.interest, sharesOutstanding);
  const technicalEvents = instrumentInfo.technicalEvents || {};
  const technicalScore =
    extractTechnicalTone(technicalEvents.shortTerm) +
    extractTechnicalTone(technicalEvents.midTerm) +
    extractTechnicalTone(technicalEvents.longTerm);
  const weekHigh52 = parseNumber(meta.fiftyTwoWeekHigh);
  const weekLow52 = parseNumber(meta.fiftyTwoWeekLow);
  const rangePosition =
    Number.isFinite(currentPrice) && Number.isFinite(weekLow52) && Number.isFinite(weekHigh52)
      ? Math.max(0, Math.min(100, ((currentPrice - weekLow52) / (weekHigh52 - weekLow52)) * 100))
      : null;
  const nextEarningsDate = extractUpcomingEarningsDate(chart) || fallbackEarningsDate || null;

  return {
    symbol,
    rawPrice: currentPrice,
    price: toCurrency(currentPrice),
    rawDayChange: dayChange,
    dayChange: toCurrency(dayChange),
    rawDayChangePercent: dayChangePercent,
    dayChangePercent: toPercent(dayChangePercent),
    chart30d: points.slice(-30).map((point) => ({
      date: point.dateKey,
      close: point.close
    })),
    performance: {
      week: calculateTrailingPerformance(points, 7),
      sixMonth: calculateTrailingPerformance(points, 182),
      ytd: calculateYearToDatePerformance(points),
      oneYear: calculateTrailingPerformance(points, 365),
      fiveYear: calculateTrailingPerformance(points, 365 * 5)
    },
    peRatio,
    peRatioLabel: Number.isFinite(peRatio) ? peRatio.toFixed(1) : trailingEps ? "N/M" : null,
    dividendYield,
    dividendYieldLabel: toPercent(dividendYield),
    analystTargetPrice: targetPrice,
    analystTargetLabel: toCurrency(targetPrice),
    targetUpsidePercent,
    targetUpsideLabel: toPercent(targetUpsidePercent),
    nextEarningsDate,
    nextEarningsLabel: toDateLabel(nextEarningsDate),
    debtToEquity,
    debtToEquityLabel: toRatio(debtToEquity),
    shortInterestPercent:
      Number.isFinite(shortInterestPercent) ? shortInterestPercent * 100 : null,
    shortInterestPercentLabel: toPercent(
      Number.isFinite(shortInterestPercent) ? shortInterestPercent * 100 : null
    ),
    shortInterestDateLabel: toDateLabel(shortInterest?.settlementDate),
    daysToCover: shortInterest?.daysToCover ?? null,
    daysToCoverLabel: toPlainNumber(shortInterest?.daysToCover ?? null, 1),
    marketCap,
    marketCapLabel: toCompactNumber(marketCap),
    revenueGrowthPercent,
    revenueGrowthLabel: toPercent(revenueGrowthPercent),
    epsGrowthPercent,
    epsGrowthLabel: toPercent(epsGrowthPercent),
    netMarginPercent: Number.isFinite(netMarginPercent) ? netMarginPercent * 100 : null,
    netMarginLabel: toPercent(
      Number.isFinite(netMarginPercent) ? netMarginPercent * 100 : null
    ),
    roePercent: Number.isFinite(roePercent) ? roePercent * 100 : null,
    roeLabel: toPercent(Number.isFinite(roePercent) ? roePercent * 100 : null),
    rangeLow: toCurrency(weekLow52),
    rangeHigh: toCurrency(weekHigh52),
    rangePosition,
    supportLabel: toCurrency(support),
    resistanceLabel: toCurrency(resistance),
    stopLossLabel: toCurrency(stopLoss),
    valuationDescription: sanitizeText(valuation.description),
    valuationDiscountPercent,
    valuationDiscountLabel: toPercent(valuationDiscountPercent),
    recommendationRating: sanitizeText(recommendation.rating),
    recommendationProvider: sanitizeText(recommendation.provider),
    technicalSignals: {
      shortTerm: extractInsightText(technicalEvents.shortTerm),
      midTerm: extractInsightText(technicalEvents.midTerm),
      longTerm: extractInsightText(technicalEvents.longTerm)
    },
    technicalScore
  };
}

function buildFact(label, value, tone = "neutral", note = null) {
  if (!value) {
    return null;
  }

  return { label, value, tone, note };
}

function getValueTone(value) {
  if (!Number.isFinite(value)) {
    return "neutral";
  }

  if (value > 0) {
    return "positive";
  }

  if (value < 0) {
    return "negative";
  }

  return "neutral";
}

function buildPersonalFacts(market) {
  const quickFacts = compact([
    buildFact("1W Change", toPercent(market.performance.week), getValueTone(market.performance.week)),
    buildFact(
      "6M Change",
      toPercent(market.performance.sixMonth),
      getValueTone(market.performance.sixMonth)
    ),
    buildFact("YTD Change", toPercent(market.performance.ytd), getValueTone(market.performance.ytd)),
    buildFact(
      "1Y Change",
      toPercent(market.performance.oneYear),
      getValueTone(market.performance.oneYear)
    ),
    buildFact("P/E Ratio", market.peRatioLabel),
    buildFact("Dividend Yield", market.dividendYieldLabel, getValueTone(market.dividendYield)),
    buildFact(
      "12M Target",
      [market.analystTargetLabel, market.targetUpsideLabel].filter(Boolean).join(" | "),
      getValueTone(market.targetUpsidePercent)
    ),
    buildFact("Next Earnings", market.nextEarningsLabel)
  ]);

  const factorFacts = compact([
    buildFact("5Y Change", toPercent(market.performance.fiveYear), getValueTone(market.performance.fiveYear)),
    buildFact("Market Cap", market.marketCapLabel),
    buildFact("Debt / Equity", market.debtToEquityLabel),
    buildFact(
      "Short Interest",
      market.shortInterestPercentLabel,
      getValueTone(-1 * (market.shortInterestPercent ?? 0)),
      market.shortInterestDateLabel ? `Settle ${market.shortInterestDateLabel}` : null
    ),
    buildFact("Days to Cover", market.daysToCoverLabel),
    buildFact(
      "Revenue Growth",
      market.revenueGrowthLabel,
      getValueTone(market.revenueGrowthPercent)
    ),
    buildFact("EPS Growth", market.epsGrowthLabel, getValueTone(market.epsGrowthPercent)),
    buildFact("Net Margin", market.netMarginLabel, getValueTone(market.netMarginPercent)),
    buildFact("ROE", market.roeLabel, getValueTone(market.roePercent)),
    buildFact(
      "52W Range",
      [market.rangeLow, market.rangeHigh].filter(Boolean).join(" to "),
      getValueTone((market.rangePosition ?? 50) - 50),
      Number.isFinite(market.rangePosition) ? `${market.rangePosition.toFixed(0)}% through range` : null
    )
  ]);

  const technicalFacts = compact([
    buildFact("Support", market.supportLabel),
    buildFact("Resistance", market.resistanceLabel),
    buildFact("Stop Loss", market.stopLossLabel),
    buildFact(
      "Valuation",
      [market.valuationDescription, market.valuationDiscountLabel].filter(Boolean).join(" | "),
      getValueTone(market.valuationDiscountPercent)
    )
  ]);

  return {
    quickFacts,
    factorFacts,
    technicalFacts
  };
}

function buildInvestorCall({ companyName, market, analystReactions, newsItems }) {
  let score = 0;
  const reasons = [];
  const catalysts = [];
  const risks = [];

  if (Number.isFinite(market.targetUpsidePercent)) {
    if (market.targetUpsidePercent >= 15) {
      score += 2;
      reasons.push(`Street target implies ${market.targetUpsideLabel} upside from the current price.`);
    } else if (market.targetUpsidePercent >= 5) {
      score += 1;
      reasons.push(`Street target still leaves ${market.targetUpsideLabel} upside.`);
    } else if (market.targetUpsidePercent <= -10) {
      score -= 2;
      risks.push(`Street target sits ${market.targetUpsideLabel} below the current price.`);
    }
  }

  if (Number.isFinite(market.revenueGrowthPercent)) {
    if (market.revenueGrowthPercent >= 10) {
      score += 1;
      reasons.push(`Revenue growth is healthy at ${market.revenueGrowthLabel}.`);
    } else if (market.revenueGrowthPercent < 0) {
      score -= 1;
      risks.push(`Revenue is contracting at ${market.revenueGrowthLabel}.`);
    }
  }

  if (Number.isFinite(market.epsGrowthPercent)) {
    if (market.epsGrowthPercent >= 10) {
      score += 1;
      reasons.push(`EPS is improving at ${market.epsGrowthLabel}.`);
    } else if (market.epsGrowthPercent < 0) {
      score -= 1;
      risks.push(`EPS trend is weak at ${market.epsGrowthLabel}.`);
    }
  }

  if (Number.isFinite(market.performance.sixMonth)) {
    if (market.performance.sixMonth >= 15) {
      score += 1;
      catalysts.push(`Six-month price momentum is strong at ${toPercent(market.performance.sixMonth)}.`);
    } else if (market.performance.sixMonth <= -15) {
      score -= 1;
      risks.push(`Six-month momentum is weak at ${toPercent(market.performance.sixMonth)}.`);
    }
  }

  if (Number.isFinite(market.performance.oneYear)) {
    if (market.performance.oneYear >= 20) {
      score += 1;
    } else if (market.performance.oneYear <= -20) {
      score -= 1;
    }
  }

  if (Number.isFinite(market.debtToEquity) && market.debtToEquity >= 2) {
    score -= 1;
    risks.push(`Leverage is elevated at ${market.debtToEquityLabel}.`);
  }

  if (Number.isFinite(market.shortInterestPercent) && market.shortInterestPercent >= 8) {
    score -= 1;
    risks.push(`Short interest is elevated at ${market.shortInterestPercentLabel}.`);
  }

  if (Number.isFinite(market.valuationDiscountPercent)) {
    if (market.valuationDiscountPercent >= 10) {
      score += 1;
      reasons.push(`Valuation snapshot reads favorable at ${market.valuationDiscountLabel}.`);
    } else if (market.valuationDiscountPercent <= -10) {
      score -= 1;
      risks.push(`Valuation snapshot is stretched at ${market.valuationDiscountLabel}.`);
    }
  }

  if (market.technicalScore >= 2) {
    score += 1;
    catalysts.push("Technical trend is supportive across multiple time horizons.");
  } else if (market.technicalScore <= -2) {
    score -= 1;
    risks.push("Technical trend is weak across multiple time horizons.");
  }

  const positiveAnalysts = analystReactions.filter((item) => item.tone === "Positive").length;
  const negativeAnalysts = analystReactions.filter((item) => item.tone === "Negative").length;
  if (positiveAnalysts > negativeAnalysts) {
    score += 1;
    reasons.push("Recent analyst reaction flow is net constructive.");
  } else if (negativeAnalysts > positiveAnalysts) {
    score -= 1;
    risks.push("Recent analyst reaction flow is net cautious.");
  }

  const positiveNews = newsItems.filter((item) => item.sentimentLabel === "Positive").length;
  const negativeNews = newsItems.filter((item) => item.sentimentLabel === "Negative").length;
  if (positiveNews > negativeNews + 1) {
    score += 1;
    catalysts.push("Headline flow is broadly supportive.");
  } else if (negativeNews > positiveNews + 1) {
    score -= 1;
    risks.push("Headline flow is leaning negative.");
  }

  if (market.nextEarningsDate) {
    const daysUntilEarnings = Math.round(
      (new Date(`${market.nextEarningsDate}T12:00:00Z`).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000)
    );
    if (daysUntilEarnings >= 0 && daysUntilEarnings <= 14) {
      catalysts.push(`Next earnings is close on ${market.nextEarningsLabel}.`);
      risks.push("Event-driven volatility is elevated into earnings.");
    } else if (daysUntilEarnings > 14 && daysUntilEarnings <= 45) {
      catalysts.push(`Next earnings is scheduled for ${market.nextEarningsLabel}.`);
    }
  }

  let action = "Hold";
  let sentiment = "Balanced";
  if (score >= 4) {
    action = "Buy";
    sentiment = "Bullish";
  } else if (score >= 2) {
    action = "Buy";
    sentiment = "Constructive";
  } else if (score <= -3) {
    action = "Sell";
    sentiment = "Bearish";
  } else if (score <= -1) {
    action = "Hold";
    sentiment = "Cautious";
  }

  const uniqueReasons = Array.from(new Set(reasons)).slice(0, 4);
  const uniqueCatalysts = Array.from(new Set(catalysts)).slice(0, 4);
  const uniqueRisks = Array.from(new Set(risks)).slice(0, 4);

  return {
    action,
    sentiment,
    score,
    summary:
      uniqueReasons.slice(0, 2).join(" ") ||
      `${companyName} has a ${sentiment.toLowerCase()} read right now, but the setup is not one-sided.`,
    reasons: uniqueReasons,
    catalysts: uniqueCatalysts,
    risks: uniqueRisks
  };
}

function buildPersonalCard(entry, identity, market, rawNewsFeed, rawAnalystFeed) {
  const newsItems = buildInvestorNewsItems(rawNewsFeed, identity.companyName);
  const analystReactions = buildInvestorAnalystReactions(rawAnalystFeed);
  const strategy = buildInvestorCall({
    companyName: identity.companyName,
    market,
    analystReactions,
    newsItems
  });
  const facts = buildPersonalFacts(market);
  const highlights = compact([
    strategy.reasons[0],
    market.nextEarningsLabel ? `Next earnings is ${market.nextEarningsLabel}.` : null,
    market.shortInterestPercentLabel
      ? `Short interest sits at ${market.shortInterestPercentLabel}.`
      : null,
    market.valuationDescription || null
  ]).slice(0, 4);

  return {
    id: entry.id,
    symbol: entry.symbol,
    companyName: identity.companyName,
    company: {
      sector: identity.sector,
      industry: identity.industry,
      exchange: identity.exchange
    },
    market,
    highlights,
    strategy,
    quickFacts: facts.quickFacts,
    factorFacts: facts.factorFacts,
    technicalFacts: facts.technicalFacts,
    analystSnapshot: {
      rating: market.recommendationRating || null,
      provider: market.recommendationProvider || null,
      target: market.analystTargetLabel || null,
      upside: market.targetUpsideLabel || null,
      valuation: market.valuationDescription || null
    },
    analystReactions,
    newsItems
  };
}

function buildPersonalPortfolioSignals(cards) {
  const callCounts = { Buy: 0, Hold: 0, Sell: 0 };
  cards.forEach((card) => {
    callCounts[card.strategy.action] += 1;
  });

  const biggestMove = cards
    .filter((card) => Number.isFinite(card.market.rawDayChangePercent))
    .sort(
      (left, right) =>
        Math.abs(right.market.rawDayChangePercent) - Math.abs(left.market.rawDayChangePercent)
    )[0];

  const bestUpside = cards
    .filter((card) => Number.isFinite(card.market.targetUpsidePercent))
    .sort((left, right) => right.market.targetUpsidePercent - left.market.targetUpsidePercent)[0];

  return {
    totalCompanies: cards.length,
    callCounts,
    callMix: `${callCounts.Buy} Buy | ${callCounts.Hold} Hold | ${callCounts.Sell} Sell`,
    biggestMove: biggestMove
      ? {
          companyName: biggestMove.companyName,
          symbol: biggestMove.symbol,
          dayChange: biggestMove.market.dayChange,
          dayChangePercent: biggestMove.market.dayChangePercent
        }
      : null,
    strongestUpside: bestUpside
      ? {
          companyName: bestUpside.companyName,
          symbol: bestUpside.symbol,
          upside: bestUpside.market.targetUpsideLabel
        }
      : null
  };
}

async function getPersonalDashboardData(entries) {
  const normalizedEntries = normalizePersonalEntries(entries);
  const warnings = new Set();

  const cards = await withConcurrency(normalizedEntries, 2, async (entry) => {
    const [chartResult, searchResult, insightsResult, fundamentalsResult, shortInterestResult] =
      await Promise.allSettled([
        getYahooChart(entry.symbol, { range: "5y", interval: "1d" }),
        getYahooSearchProfile(entry.symbol),
        getYahooInsights(entry.symbol),
        getYahooFundamentals(entry.symbol),
        getNasdaqShortInterest(entry.symbol)
      ]);

    if (chartResult.status === "rejected") {
      warnings.add(`Price history unavailable for ${entry.symbol}: ${chartResult.reason.message}`);
    }

    if (fundamentalsResult.status === "rejected") {
      warnings.add(
        `Fundamental metrics unavailable for ${entry.symbol}: ${fundamentalsResult.reason.message}`
      );
    }

    if (shortInterestResult.status === "rejected") {
      warnings.add(
        `Short interest unavailable for ${entry.symbol}: ${shortInterestResult.reason.message}`
      );
    }

    const chart = chartResult.status === "fulfilled" ? chartResult.value : null;
    const searchProfile = searchResult.status === "fulfilled" ? searchResult.value : null;
    const insights = insightsResult.status === "fulfilled" ? insightsResult.value : null;
    const timeseriesIndex =
      fundamentalsResult.status === "fulfilled"
        ? buildTimeseriesIndex(fundamentalsResult.value)
        : new Map();
    const shortInterest = shortInterestResult.status === "fulfilled" ? shortInterestResult.value : null;
    const identity = buildPersonalIdentity(entry, searchProfile, chart, insights);
    const fallbackEarningsDate =
      chart && extractUpcomingEarningsDate(chart)
        ? null
        : await findNextNasdaqEarningsDate(entry.symbol).catch(() => null);
    const market = buildPersonalMarketSnapshot(
      entry.symbol,
      chart,
      timeseriesIndex,
      insights,
      shortInterest,
      fallbackEarningsDate
    );
    const [newsResult, analystResult] = await Promise.allSettled([
      searchCuratedNews(entry, identity.companyName),
      searchAnalystReactions(entry, identity.companyName)
    ]);

    if (newsResult.status === "rejected") {
      warnings.add(`News unavailable for ${identity.companyName}: ${newsResult.reason.message}`);
    }

    if (analystResult.status === "rejected") {
      warnings.add(
        `Analyst coverage unavailable for ${identity.companyName}: ${analystResult.reason.message}`
      );
    }

    return buildPersonalCard(
      entry,
      identity,
      market,
      newsResult.status === "fulfilled" ? newsResult.value : [],
      analystResult.status === "fulfilled" ? analystResult.value : []
    );
  });

  return {
    generatedAt: new Date().toISOString(),
    watchlist: normalizedEntries,
    portfolio: buildPersonalPortfolioSignals(cards),
    cards,
    warnings: [...warnings],
    metadata: {
      newsLookbackDays: 7,
      quoteSource: "Yahoo Finance chart, fundamentals, and Nasdaq short-interest data",
      newsSource: "Curated business and market news search"
    }
  };
}

function buildPortfolioSignals(cards) {
  const totalArticles = cards.reduce((count, card) => count + card.newsItems.length, 0);
  const themeCounts = new Map();

  for (const card of cards) {
    for (const theme of card.themes) {
      themeCounts.set(theme.title, (themeCounts.get(theme.title) || 0) + 1);
    }
  }

  const topThemes = [...themeCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([theme]) => theme);

  const highestMomentum = cards
    .filter(
      (card) =>
        Number.isFinite(card.market.rawPrice) && Number.isFinite(card.market.rawDayChangePercent)
    )
    .sort(
      (left, right) =>
        Math.abs(right.market.rawDayChangePercent) - Math.abs(left.market.rawDayChangePercent)
    )[0];

  return {
    totalCompanies: cards.length,
    publicTickers: cards.filter((card) => card.mode === "ticker").length,
    newsHits: totalArticles,
    topThemes,
    momentumLeader: highestMomentum
      ? {
          companyName: highestMomentum.companyName,
          symbol: highestMomentum.symbol,
          dayChangePercent: highestMomentum.market.dayChangePercent
        }
      : null
  };
}

function sevenDaysAgoTimestamp() {
  const now = new Date();
  const result = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const parts = [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, "0"),
    String(result.getUTCDate()).padStart(2, "0"),
    "T",
    String(result.getUTCHours()).padStart(2, "0"),
    String(result.getUTCMinutes()).padStart(2, "0")
  ];

  return parts.join("");
}

async function getDashboardData(entries) {
  const normalizedEntries = normalizeEntries(entries);
  const tickerEntries = normalizedEntries.filter((entry) => entry.mode === "ticker");
  const companyEntries = normalizedEntries.filter((entry) => entry.mode === "company");
  const warnings = new Set();

  const tickerCards = await withConcurrency(tickerEntries, 2, async (entry) => {
    const secCompany = await getSecCompanyBySymbol(entry.symbol).catch(() => null);
    const baseProfile = buildProfile(
      { ...entry, label: sanitizeText(secCompany?.title || entry.label) },
      null
    );
    const [alphaQuoteResult, overviewResult, yahooResult, secResult, newsResult, analystResult] =
      await Promise.allSettled([
        getQuote(entry.symbol),
        getOverview(entry.symbol),
        getYahooChart(entry.symbol),
        getEdgarContext(entry.symbol),
        searchCuratedNews(entry, baseProfile.name),
        searchAnalystReactions(entry, baseProfile.name)
      ]);

    if (alphaQuoteResult.status === "rejected" && yahooResult.status === "rejected") {
      warnings.add(`No quote data found for ${entry.symbol}. Check that the ticker is valid.`);
    } else if (alphaQuoteResult.status === "rejected" && yahooResult.status === "fulfilled") {
      warnings.add(
        `Alpha Vantage could not price ${entry.symbol}; using Yahoo market fallback until the Alpha quota resets.`
      );
    } else if (
      alphaQuoteResult.status === "fulfilled" &&
      alphaQuoteResult.value?.isFallback &&
      yahooResult.status === "fulfilled"
    ) {
      warnings.add(
        `Alpha Vantage snapshot data is stale for ${entry.symbol}; current YTD and range metrics are from Yahoo history.`
      );
    }

    if (newsResult.status === "rejected") {
      warnings.add(`Curated news unavailable for ${baseProfile.name}: ${newsResult.reason.message}`);
    }

    if (analystResult.status === "rejected") {
      warnings.add(`Analyst reactions unavailable for ${baseProfile.name}: ${analystResult.reason.message}`);
    }

    if (secResult.status === "rejected") {
      warnings.add(`SEC EDGAR context unavailable for ${entry.symbol}: ${secResult.reason.message}`);
    }

    const marketBundle = {
      alphaQuote: alphaQuoteResult.status === "fulfilled" ? alphaQuoteResult.value : null,
      overview: overviewResult.status === "fulfilled" ? overviewResult.value : null,
      yahooMarket: yahooResult.status === "fulfilled"
        ? buildYahooMarketData(entry.symbol, yahooResult.value)
        : null
    };

    return buildTickerCard(
      entry,
      marketBundle,
      secResult.status === "fulfilled" ? secResult.value : null,
      newsResult.status === "fulfilled" ? newsResult.value : [],
      analystResult.status === "fulfilled" ? analystResult.value : []
    );
  });

  const companyCards = await withConcurrency(companyEntries, 2, async (entry) => {
    const [newsResult, analystResult] = await Promise.allSettled([
      searchCuratedNews(entry, entry.query),
      searchAnalystReactions(entry, entry.query)
    ]);

    if (newsResult.status === "rejected") {
      warnings.add(`Curated news unavailable for ${entry.query}: ${newsResult.reason.message}`);
    }

    if (analystResult.status === "rejected") {
      warnings.add(`Analyst reactions unavailable for ${entry.query}: ${analystResult.reason.message}`);
    }

    return buildCompanyOnlyCard(
      entry,
      newsResult.status === "fulfilled" ? newsResult.value : [],
      analystResult.status === "fulfilled" ? analystResult.value : []
    );
  });

  const cards = [...tickerCards, ...companyCards];
  const portfolio = buildPortfolioSignals(cards);

  return {
    generatedAt: new Date().toISOString(),
    watchlist: normalizedEntries,
    portfolio,
    cards,
    warnings: [...warnings],
    metadata: {
      newsLookbackDays: 7,
      quoteSource: "Alpha Vantage primary with Yahoo chart fallback",
      newsSource: "Curated business and technology news search"
    }
  };
}

async function serveStaticFile(requestPath, response) {
  const strippedPath = requestPath === "/" ? "index.html" : requestPath.replace(/^[/\\]+/, "");
  const safePath = normalize(strippedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safePath);

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/config") {
      json(response, 200, { defaultWatchlist: DEFAULT_WATCHLIST });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/personal-config") {
      json(response, 200, { defaultWatchlist: PERSONAL_DEFAULT_WATCHLIST });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/dashboard") {
      const body = await readJsonBody(request);
      const data = await getDashboardData(body.entries);
      json(response, 200, data);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/personal-dashboard") {
      const body = await readJsonBody(request);
      const data = await getPersonalDashboardData(body.entries);
      json(response, 200, data);
      return;
    }

    if (request.method === "GET") {
      const requestPath = url.pathname === "/pg" ? "/pg.html" : url.pathname;
      const served = await serveStaticFile(requestPath, response);
      if (served) {
        return;
      }

      const fallbackServed = await serveStaticFile("/", response);
      if (fallbackServed) {
        return;
      }
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  } catch (error) {
    sendError(response, error);
  }
});

server.listen(PORT, () => {
  console.log(`NVIDIA ISV Watchtower running on http://localhost:${PORT}`);
});
