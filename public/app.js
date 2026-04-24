const state = {
  watchlist: [],
  mode: "ticker",
  loading: false,
  dashboard: null,
  collapsedCards: new Set(),
  draggingId: null,
  activeSections: new Map()
};

const elements = {
  watchlistForm: document.querySelector("#watchlistForm"),
  watchInput: document.querySelector("#watchInput"),
  watchlistChips: document.querySelector("#watchlistChips"),
  dashboardGrid: document.querySelector("#dashboardGrid"),
  statusBanner: document.querySelector("#statusBanner"),
  generatedAt: document.querySelector("#generatedAt"),
  refreshButton: document.querySelector("#refreshButton"),
  exportButton: document.querySelector("#exportButton"),
  totalCompanies: document.querySelector("#totalCompanies"),
  coverageDetail: document.querySelector("#coverageDetail"),
  commonThemes: document.querySelector("#commonThemes"),
  momentumLeader: document.querySelector("#momentumLeader"),
  momentumDetail: document.querySelector("#momentumDetail"),
  chipTemplate: document.querySelector("#chipTemplate"),
  cardTemplate: document.querySelector("#cardTemplate"),
  newsTemplate: document.querySelector("#newsTemplate"),
  reactionTemplate: document.querySelector("#reactionTemplate"),
  modePills: Array.from(document.querySelectorAll(".mode-pill"))
};

const sectionDefinitions = [
  { id: "overview", label: "Overview" },
  { id: "outlook", label: "Outlook" },
  { id: "strategy", label: "Strategy" },
  { id: "edgar", label: "SEC EDGAR" },
  { id: "analysts", label: "Analysts" },
  { id: "themes", label: "Themes" },
  { id: "news", label: "News" }
];

function saveWatchlist() {
  localStorage.setItem("nvidia-watchtower-watchlist", JSON.stringify(state.watchlist));
}

function loadWatchlist() {
  const saved = localStorage.getItem("nvidia-watchtower-watchlist");
  if (!saved) {
    return null;
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatDateTime(value) {
  if (!value) {
    return "Waiting for update";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) {
    return "Recent";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function setMode(mode) {
  state.mode = mode === "company" ? "company" : "ticker";
  elements.modePills.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  elements.watchInput.placeholder =
    state.mode === "ticker"
      ? "Try TEAM, NOW, PLTR, CRM"
      : "Try Databricks, Snowflake, Rubrik";
}

function uniqueWatchlist(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key =
      entry.mode === "company"
        ? `company:${entry.query.toLowerCase()}`
        : `ticker:${entry.symbol.toUpperCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildEntryFromInput(value) {
  const clean = value.trim();
  if (!clean) {
    return null;
  }

  if (state.mode === "company") {
    return {
      id: clean.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
      mode: "company",
      query: clean,
      label: clean
    };
  }

  return {
    id: clean.toUpperCase(),
    mode: "ticker",
    symbol: clean.toUpperCase(),
    label: clean.toUpperCase()
  };
}

function setStatus(message, isError = false) {
  elements.statusBanner.textContent = message;
  elements.statusBanner.classList.toggle("error", isError);
}

function metricCard(label, value) {
  if (!value) {
    return "";
  }

  return `
    <div class="metric-card">
      <span class="metric-label">${label}</span>
      <span class="metric-value">${value}</span>
    </div>
  `;
}

function renderPortfolioSummary(portfolio) {
  elements.totalCompanies.textContent = `${portfolio.totalCompanies} compan${
    portfolio.totalCompanies === 1 ? "y" : "ies"
  }`;
  elements.coverageDetail.textContent = `${portfolio.publicTickers} public tickers, ${portfolio.newsHits} news items in the last 7 days.`;
  elements.commonThemes.textContent = portfolio.topThemes.length
    ? portfolio.topThemes.join(" | ")
    : "No repeated themes yet";

  if (portfolio.momentumLeader) {
    elements.momentumLeader.textContent = `${portfolio.momentumLeader.companyName} (${portfolio.momentumLeader.symbol})`;
    elements.momentumDetail.textContent = `${portfolio.momentumLeader.dayChangePercent} today`;
  } else {
    elements.momentumLeader.textContent = "No market move yet";
    elements.momentumDetail.textContent = "Add a public ticker to compare same-day price movement.";
  }
}

function renderWatchlistChips() {
  elements.watchlistChips.innerHTML = "";

  state.watchlist.forEach((entry) => {
    const fragment = elements.chipTemplate.content.cloneNode(true);
    fragment.querySelector(".chip-title").textContent =
      entry.mode === "ticker" ? entry.symbol : entry.query;
    fragment.querySelector(".chip-subtitle").textContent =
      entry.mode === "ticker" ? "Stock + news card" : "News-only company card";

    fragment.querySelector(".remove-chip").addEventListener("click", () => {
      state.watchlist = state.watchlist.filter((item) => item.id !== entry.id);
      saveWatchlist();
      renderWatchlistChips();
      loadDashboard();
    });

    elements.watchlistChips.appendChild(fragment);
  });
}

function appendNoteItems(target, notes) {
  target.innerHTML = "";
  notes.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    target.appendChild(item);
  });
}

function renderNews(newsItems, parent) {
  parent.innerHTML = "";

  if (!newsItems.length) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent =
      "No recent articles matched this company in the current feed. Try refreshing later or add more specific coverage targets.";
    parent.appendChild(empty);
    return;
  }

  newsItems.forEach((item) => {
    const fragment = elements.newsTemplate.content.cloneNode(true);
    fragment.querySelector(".news-source").textContent = [item.source, item.sentimentLabel]
      .filter(Boolean)
      .join(" | ");
    fragment.querySelector(".news-link").textContent = item.title;
    fragment.querySelector(".news-link").href = item.url;
    fragment.querySelector(".news-date").textContent = formatDate(item.publishedAt);
    fragment.querySelector(".news-summary").textContent = item.summary || "Summary unavailable.";
    fragment.querySelector(".news-why-care").textContent = item.whyCare;

    const topicRow = fragment.querySelector(".topic-row");
    item.topics.forEach((topic) => {
      const pill = document.createElement("span");
      pill.className = "topic-pill";
      pill.textContent = topic;
      topicRow.appendChild(pill);
    });

    parent.appendChild(fragment);
  });
}

function renderAnalystReactions(reactions, parent) {
  parent.innerHTML = "";

  if (!reactions.length) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent = "No analyst reaction coverage matched the current company inputs.";
    parent.appendChild(empty);
    return;
  }

  reactions.forEach((item) => {
    const fragment = elements.reactionTemplate.content.cloneNode(true);
    fragment.querySelector(".reaction-source").textContent = [item.source, item.tone]
      .filter(Boolean)
      .join(" | ");
    fragment.querySelector(".reaction-date").textContent = formatDate(item.publishedAt);
    fragment.querySelector(".reaction-link").textContent = item.title;
    fragment.querySelector(".reaction-link").href = item.url;
    fragment.querySelector(".reaction-summary").textContent = item.summary || "Summary unavailable.";
    parent.appendChild(fragment);
  });
}

function syncDashboardCardOrder() {
  if (!state.dashboard?.cards) {
    return;
  }

  const cardMap = new Map(state.dashboard.cards.map((card) => [card.id, card]));
  state.dashboard.cards = state.watchlist
    .map((entry) => cardMap.get(entry.id))
    .filter(Boolean);
}

function persistReorderedWatchlist(draggedId, targetId) {
  const currentIndex = state.watchlist.findIndex((entry) => entry.id === draggedId);
  const targetIndex = state.watchlist.findIndex((entry) => entry.id === targetId);

  if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) {
    return;
  }

  const reordered = [...state.watchlist];
  const [movedEntry] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, movedEntry);
  state.watchlist = reordered;
  saveWatchlist();
  renderWatchlistChips();
  syncDashboardCardOrder();

  if (state.dashboard?.cards) {
    renderCards(state.dashboard.cards);
  }
}

function clearDragState() {
  state.draggingId = null;
  document.querySelectorAll(".company-card").forEach((card) => {
    card.classList.remove("is-dragging", "drag-over");
  });
}

function applyReorderBehavior(cardElement, cardId) {
  cardElement.setAttribute("draggable", "true");

  cardElement.addEventListener("dragstart", (event) => {
    state.draggingId = cardId;
    cardElement.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", cardId);
  });

  cardElement.addEventListener("dragover", (event) => {
    if (!state.draggingId || state.draggingId === cardId) {
      return;
    }

    event.preventDefault();
    cardElement.classList.add("drag-over");
    event.dataTransfer.dropEffect = "move";
  });

  cardElement.addEventListener("dragleave", () => {
    cardElement.classList.remove("drag-over");
  });

  cardElement.addEventListener("drop", (event) => {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData("text/plain") || state.draggingId;
    cardElement.classList.remove("drag-over");
    persistReorderedWatchlist(draggedId, cardId);
    clearDragState();
  });

  cardElement.addEventListener("dragend", () => {
    clearDragState();
  });
}

function applyCollapseBehavior(cardElement, cardId) {
  const toggleButton = cardElement.querySelector(".card-toggle");
  const body = cardElement.querySelector(".card-body");
  const isCollapsed = state.collapsedCards.has(cardId);

  cardElement.classList.toggle("is-collapsed", isCollapsed);
  body.classList.toggle("hidden", isCollapsed);
  toggleButton.textContent = isCollapsed ? "Expand" : "Collapse";
  toggleButton.setAttribute("aria-expanded", String(!isCollapsed));

  toggleButton.addEventListener("click", () => {
    const collapsed = cardElement.classList.toggle("is-collapsed");
    body.classList.toggle("hidden", collapsed);
    toggleButton.textContent = collapsed ? "Expand" : "Collapse";
    toggleButton.setAttribute("aria-expanded", String(!collapsed));

    if (collapsed) {
      state.collapsedCards.add(cardId);
    } else {
      state.collapsedCards.delete(cardId);
    }
  });
}

function enableSection(sectionElement) {
  sectionElement.dataset.enabled = "true";
  sectionElement.classList.remove("hidden");
}

function getAvailableSections(card) {
  return sectionDefinitions.filter((section) => {
    if (section.id === "overview") {
      return Boolean(card.highlights?.length || card.watchouts?.length);
    }

    if (section.id === "outlook") {
      return Boolean(card.outlook?.label || card.outlook?.summary);
    }

    if (section.id === "strategy") {
      return Boolean(card.strategyNotes?.length);
    }

    if (section.id === "edgar") {
      return card.mode === "ticker" && Boolean(card.sec?.highlights?.length || card.sec?.guidance?.length);
    }

    if (section.id === "analysts") {
      return Boolean(card.analystReactions?.length);
    }

    if (section.id === "themes") {
      return Boolean(card.themes?.length);
    }

    if (section.id === "news") {
      return true;
    }

    return false;
  });
}

function applySectionTabs(cardElement, cardId, availableSections) {
  const nav = cardElement.querySelector(".card-section-nav");
  const enabledBlocks = Array.from(cardElement.querySelectorAll(".section-block[data-enabled='true']"));

  nav.innerHTML = "";
  if (!availableSections.length) {
    nav.classList.add("hidden");
    enabledBlocks.forEach((block) => block.classList.remove("hidden"));
    return;
  }

  nav.classList.remove("hidden");
  let activeSection = state.activeSections.get(cardId);
  if (!availableSections.some((section) => section.id === activeSection)) {
    activeSection = availableSections[0].id;
    state.activeSections.set(cardId, activeSection);
  }

  const updateView = (sectionId) => {
    state.activeSections.set(cardId, sectionId);
    nav.querySelectorAll(".card-section-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.section === sectionId);
    });
    enabledBlocks.forEach((block) => {
      block.classList.toggle("hidden", block.dataset.section !== sectionId);
    });
  };

  availableSections.forEach((section) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-section-tab";
    button.dataset.section = section.id;
    button.textContent = section.label;
    button.addEventListener("click", () => updateView(section.id));
    nav.appendChild(button);
  });

  updateView(activeSection);
}

function renderCards(cards) {
  elements.dashboardGrid.innerHTML = "";

  cards.forEach((card) => {
    const fragment = elements.cardTemplate.content.cloneNode(true);
    const cardElement = fragment.querySelector(".company-card");
    const highlightsSection = fragment.querySelector(".highlights-section");
    const outlookSection = fragment.querySelector(".outlook-section");
    const strategySection = fragment.querySelector(".strategy-section");
    const watchoutSection = fragment.querySelector(".watchout-section");
    const edgarSection = fragment.querySelector(".edgar-section");
    const analystSection = fragment.querySelector(".analyst-section");
    const themeSection = fragment.querySelector(".theme-section");
    const newsSection = fragment.querySelector(".news-section");

    fragment.querySelector(".card-tag").textContent =
      card.mode === "ticker"
        ? `${card.symbol} | ${[card.company.sector, card.company.industry].filter(Boolean).join(" / ") || "Public company"}`
        : "Company narrative | Private or no public ticker";
    fragment.querySelector(".drag-hint").textContent = "Drag to reorder";
    fragment.querySelector(".company-name").textContent = card.companyName;
    fragment.querySelector(".price-value").textContent = card.market.price || "No public quote";
    fragment.querySelector(".price-change").textContent =
      card.mode === "company"
        ? "Narrative tracking mode"
        : card.market.dayChangePercent && card.market.dayChange
          ? `${card.market.dayChange} (${card.market.dayChangePercent})`
          : card.market.price
            ? "Change unavailable"
            : "Quote unavailable";

    const metricGrid = fragment.querySelector(".metric-grid");
    metricGrid.innerHTML = [
      metricCard("Market cap", card.market.marketCap),
      metricCard("Revenue TTM", card.market.revenueTTM),
      metricCard("P/E ratio", card.market.peRatio),
      metricCard("Analyst target", card.market.analystTarget),
      metricCard("YTD move", card.market.ytdChangePercent),
      metricCard("30D move", card.market.oneMonthChangePercent),
      metricCard("Beta", card.market.beta)
    ]
      .filter(Boolean)
      .join("");

    if (card.market.rangePosition !== null) {
      const rangePanel = fragment.querySelector(".range-panel");
      rangePanel.classList.remove("hidden");
      fragment.querySelector(".range-low").textContent = card.market.rangeLow;
      fragment.querySelector(".range-high").textContent = card.market.rangeHigh;
      fragment.querySelector(".range-indicator").style.left = `${card.market.rangePosition}%`;
    }

    if (card.highlights?.length) {
      enableSection(highlightsSection);
      appendNoteItems(fragment.querySelector(".highlights-list"), card.highlights);
    }

    if (card.outlook?.label || card.outlook?.summary) {
      enableSection(outlookSection);
      fragment.querySelector(".outlook-label").textContent = card.outlook.label || "Mixed";
      fragment.querySelector(".outlook-summary").textContent =
        card.outlook.summary || "No short-term outlook available.";
    }

    enableSection(strategySection);
    appendNoteItems(fragment.querySelector(".strategy-list"), card.strategyNotes || []);

    if (card.watchouts?.length) {
      enableSection(watchoutSection);
      appendNoteItems(fragment.querySelector(".watchout-list"), card.watchouts);
    }

    if ((card.sec?.highlights?.length || card.sec?.guidance?.length) && card.mode === "ticker") {
      enableSection(edgarSection);
      appendNoteItems(fragment.querySelector(".edgar-list"), card.sec.highlights || []);
      appendNoteItems(
        fragment.querySelector(".guidance-list"),
        (card.sec.guidance || []).map((item) => `${item.form}: ${item.text}`)
      );
    }

    if (card.analystReactions?.length) {
      enableSection(analystSection);
      renderAnalystReactions(card.analystReactions, fragment.querySelector(".reaction-list"));
    }

    if (card.themes?.length) {
      enableSection(themeSection);
      const themeRow = fragment.querySelector(".theme-row");
      card.themes.forEach((theme) => {
        const pill = document.createElement("span");
        pill.className = "theme-pill";
        pill.textContent = theme.title;
        themeRow.appendChild(pill);
      });
    }

    enableSection(newsSection);
    renderNews(card.newsItems || [], fragment.querySelector(".news-list"));

    const availableSections = getAvailableSections(card);
    applySectionTabs(cardElement, card.id, availableSections);
    applyCollapseBehavior(cardElement, card.id);
    applyReorderBehavior(cardElement, card.id);
    elements.dashboardGrid.appendChild(fragment);
  });
}

async function fetchConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Unable to load dashboard defaults.");
  }

  return response.json();
}

async function fetchDashboard() {
  const response = await fetch("/api/dashboard", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ entries: state.watchlist })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Unable to load the dashboard right now.");
  }

  return response.json();
}

async function loadDashboard() {
  if (!state.watchlist.length) {
    setStatus("Add at least one ticker or company to start the dashboard.");
    elements.dashboardGrid.innerHTML = "";
    return;
  }

  state.loading = true;
  setStatus("Loading quotes, filings, analyst reactions, and recent news...");
  elements.refreshButton.disabled = true;
  elements.exportButton.disabled = true;

  try {
    const data = await fetchDashboard();
    state.dashboard = data;
    renderPortfolioSummary(data.portfolio);
    renderCards(data.cards);
    elements.generatedAt.textContent =
      `Updated ${formatDateTime(data.generatedAt)} | Quotes: ${data.metadata.quoteSource} | News: ${data.metadata.newsSource}`;

    if (data.warnings?.length) {
      setStatus(`Loaded ${data.cards.length} cards. ${data.warnings[0]}`);
    } else {
      setStatus(
        `Loaded ${data.cards.length} cards with ${data.portfolio.newsHits} recent news items across the last ${data.metadata.newsLookbackDays} days.`
      );
    }
  } catch (error) {
    state.dashboard = null;
    setStatus(error.message, true);
  } finally {
    state.loading = false;
    elements.refreshButton.disabled = false;
    elements.exportButton.disabled = false;
  }
}

function buildStandaloneBehaviorScript() {
  return `
    document.querySelectorAll(".company-card").forEach((card) => {
      const toggle = card.querySelector(".card-toggle");
      const body = card.querySelector(".card-body");
      if (toggle && body) {
        toggle.addEventListener("click", () => {
          const collapsed = card.classList.toggle("is-collapsed");
          body.classList.toggle("hidden", collapsed);
          toggle.textContent = collapsed ? "Expand" : "Collapse";
          toggle.setAttribute("aria-expanded", String(!collapsed));
        });
      }

      const tabs = Array.from(card.querySelectorAll(".card-section-tab"));
      const panels = Array.from(card.querySelectorAll(".section-block[data-enabled='true']"));
      const activate = (sectionId) => {
        tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.section === sectionId));
        panels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.section !== sectionId));
      };

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => activate(tab.dataset.section));
      });

      const activeTab = tabs.find((tab) => tab.classList.contains("active")) || tabs[0];
      if (activeTab) {
        activate(activeTab.dataset.section);
      }
    });
  `;
}

async function buildStandaloneHtml() {
  const response = await fetch("/styles.css");
  if (!response.ok) {
    throw new Error("Unable to load styles for HTML export.");
  }

  const styles = await response.text();
  const root = document.documentElement.cloneNode(true);
  const head = root.querySelector("head");
  const body = root.querySelector("body");

  root.querySelectorAll("script").forEach((node) => node.remove());
  root.querySelectorAll("template").forEach((node) => node.remove());
  root.querySelectorAll("link[rel='stylesheet'][href='/styles.css']").forEach((node) => node.remove());
  root.querySelectorAll("#refreshButton, #exportButton, .watchlist-form, .pill-group, .remove-chip, .drag-hint").forEach((node) => node.remove());
  root.querySelectorAll(".company-card").forEach((card) => card.removeAttribute("draggable"));

  const exportNote = document.createElement("p");
  exportNote.className = "hero-footnote export-note";
  exportNote.textContent = `Standalone HTML snapshot generated ${formatDateTime(
    state.dashboard?.generatedAt || new Date().toISOString()
  )}.`;
  root.querySelector(".hero-actions")?.appendChild(exportNote);

  const styleEl = document.createElement("style");
  styleEl.textContent = `${styles}

  .watchlist-form,
  .pill-group,
  .remove-chip,
  .drag-hint,
  .hero-button-row {
    display: none !important;
  }

  .export-note {
    margin-top: 0;
  }

  .watch-chip {
    padding-right: 16px;
  }

  .watch-chip button {
    display: none !important;
  }

  .company-card {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  `;
  head.appendChild(styleEl);

  const scriptEl = document.createElement("script");
  scriptEl.textContent = buildStandaloneBehaviorScript();
  body.appendChild(scriptEl);

  return `<!DOCTYPE html>\n${root.outerHTML}`;
}

async function exportDashboardHtml() {
  if (!state.dashboard?.cards?.length) {
    setStatus("Load the dashboard before exporting a standalone HTML snapshot.", true);
    return;
  }

  elements.exportButton.disabled = true;
  setStatus("Building standalone HTML snapshot...");

  try {
    const html = await buildStandaloneHtml();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nvidia-isv-watchtower-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Standalone HTML snapshot is ready.");
  } catch (error) {
    setStatus(error.message || "Unable to export standalone HTML.", true);
  } finally {
    elements.exportButton.disabled = false;
  }
}

async function initialize() {
  const savedWatchlist = loadWatchlist();

  if (savedWatchlist?.length) {
    state.watchlist = uniqueWatchlist(savedWatchlist);
  } else {
    const config = await fetchConfig();
    state.watchlist = uniqueWatchlist(config.defaultWatchlist);
    saveWatchlist();
  }

  renderWatchlistChips();
  await loadDashboard();
}

elements.watchlistForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextEntry = buildEntryFromInput(elements.watchInput.value);
  if (!nextEntry) {
    return;
  }

  state.watchlist = uniqueWatchlist([...state.watchlist, nextEntry]);
  saveWatchlist();
  renderWatchlistChips();
  elements.watchInput.value = "";
  loadDashboard();
});

elements.refreshButton.addEventListener("click", () => {
  loadDashboard();
});

elements.exportButton.addEventListener("click", () => {
  exportDashboardHtml();
});

elements.modePills.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

setMode("ticker");
initialize().catch((error) => {
  setStatus(error.message, true);
});
