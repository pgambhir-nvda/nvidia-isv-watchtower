const state = {
  watchlist: [],
  dashboard: null,
  loading: false,
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
  expandAllButton: document.querySelector("#expandAllButton"),
  collapseAllButton: document.querySelector("#collapseAllButton"),
  exportButton: document.querySelector("#exportButton"),
  totalCompanies: document.querySelector("#totalCompanies"),
  coverageDetail: document.querySelector("#coverageDetail"),
  callMix: document.querySelector("#callMix"),
  callMixDetail: document.querySelector("#callMixDetail"),
  biggestMove: document.querySelector("#biggestMove"),
  biggestMoveDetail: document.querySelector("#biggestMoveDetail"),
  chipTemplate: document.querySelector("#chipTemplate"),
  cardTemplate: document.querySelector("#cardTemplate"),
  newsTemplate: document.querySelector("#newsTemplate"),
  reactionTemplate: document.querySelector("#reactionTemplate")
};

const sectionDefinitions = [
  { id: "strategy", label: "Strategy" },
  { id: "factors", label: "Factors" },
  { id: "analysts", label: "Analysts" },
  { id: "news", label: "News" }
];

function saveWatchlist() {
  localStorage.setItem("pg-watchtower-watchlist", JSON.stringify(state.watchlist));
}

function loadWatchlist() {
  const saved = localStorage.getItem("pg-watchtower-watchlist");
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

function uniqueWatchlist(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const symbol = String(entry?.symbol || entry?.label || "").toUpperCase().trim();
    if (!symbol || seen.has(symbol)) {
      return false;
    }

    seen.add(symbol);
    return true;
  });
}

function buildEntryFromInput(value) {
  const clean = value.trim().toUpperCase().replace(/[^A-Z.\-]/g, "");
  if (!clean) {
    return null;
  }

  return {
    id: clean,
    mode: "ticker",
    symbol: clean,
    label: clean
  };
}

function setStatus(message, isError = false) {
  elements.statusBanner.textContent = message;
  elements.statusBanner.classList.toggle("error", isError);
}

function renderPortfolioSummary(portfolio) {
  elements.totalCompanies.textContent = `${portfolio.totalCompanies} name${
    portfolio.totalCompanies === 1 ? "" : "s"
  }`;
  elements.coverageDetail.textContent = `${portfolio.totalCompanies} tickers loaded for price, factors, analysts, and news.`;
  elements.callMix.textContent = portfolio.callMix;
  elements.callMixDetail.textContent = "Buy / Hold / Sell counts across the current watchlist.";

  if (portfolio.biggestMove) {
    elements.biggestMove.textContent = `${portfolio.biggestMove.companyName} (${portfolio.biggestMove.symbol})`;
    elements.biggestMoveDetail.textContent = `${portfolio.biggestMove.dayChangePercent} today${
      portfolio.biggestMove.dayChange ? ` | ${portfolio.biggestMove.dayChange}` : ""
    }`;
  } else if (portfolio.strongestUpside) {
    elements.biggestMove.textContent = `${portfolio.strongestUpside.companyName} (${portfolio.strongestUpside.symbol})`;
    elements.biggestMoveDetail.textContent = `No valid day move yet. Best target upside in the set: ${portfolio.strongestUpside.upside}`;
  } else {
    elements.biggestMove.textContent = "No day move found";
    elements.biggestMoveDetail.textContent = "Add more public tickers to compare same-day price movement.";
  }
}

function setTopButtonsDisabled(disabled) {
  elements.refreshButton.disabled = disabled;
  elements.expandAllButton.disabled = disabled;
  elements.collapseAllButton.disabled = disabled;
  elements.exportButton.disabled = disabled;
}

function renderWatchlistChips() {
  elements.watchlistChips.innerHTML = "";

  state.watchlist.forEach((entry) => {
    const fragment = elements.chipTemplate.content.cloneNode(true);
    fragment.querySelector(".chip-title").textContent = entry.symbol;
    fragment.querySelector(".chip-subtitle").textContent = "Investor card";

    fragment.querySelector(".remove-chip").addEventListener("click", () => {
      state.watchlist = state.watchlist.filter((item) => item.id !== entry.id);
      saveWatchlist();
      renderWatchlistChips();
      loadDashboard();
    });

    elements.watchlistChips.appendChild(fragment);
  });
}

function appendNoteItems(target, notes, emptyMessage) {
  target.innerHTML = "";

  if (!notes.length) {
    const item = document.createElement("li");
    item.textContent = emptyMessage;
    target.appendChild(item);
    return;
  }

  notes.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    target.appendChild(item);
  });
}

function createMetricCard(item, kind = "metric") {
  const element = document.createElement("div");
  element.className = `${kind}-card ${item.tone || "neutral"}`;

  const label = document.createElement("span");
  label.className = `${kind}-label`;
  label.textContent = item.label;
  element.appendChild(label);

  const value = document.createElement("span");
  value.className = `${kind}-value`;
  value.textContent = item.value;
  element.appendChild(value);

  if (item.note) {
    const note = document.createElement("span");
    note.className = `${kind}-note`;
    note.textContent = item.note;
    element.appendChild(note);
  }

  return element;
}

function renderFactGrid(items, parent, kind = "metric") {
  parent.innerHTML = "";
  items.forEach((item) => parent.appendChild(createMetricCard(item, kind)));
}

function renderNews(newsItems, parent) {
  parent.innerHTML = "";

  if (!newsItems.length) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent = "No recent articles matched this company in the current feed.";
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
    parent.appendChild(fragment);
  });
}

function renderAnalystReactions(reactions, parent) {
  parent.innerHTML = "";

  if (!reactions.length) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent = "No recent analyst-reaction articles matched this company.";
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

function renderAnalystSnapshot(snapshot, parent) {
  parent.innerHTML = "";
  const items = [
    snapshot?.rating ? { label: "Street Rating", value: snapshot.rating } : null,
    snapshot?.provider ? { label: "Provider", value: snapshot.provider } : null,
    snapshot?.target ? { label: "12M Target", value: snapshot.target } : null,
    snapshot?.upside ? { label: "Implied Move", value: snapshot.upside } : null,
    snapshot?.valuation ? { label: "Valuation Read", value: snapshot.valuation } : null
  ].filter(Boolean);

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent = "No street snapshot is available for this ticker yet.";
    parent.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = createMetricCard(item, "metric");
    card.classList.add("analyst-snapshot-item");
    parent.appendChild(card);
  });
}

function buildPath(points, width, height) {
  if (points.length < 2) {
    return { line: "", area: "" };
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xStep = width / (points.length - 1);
  const coordinates = points.map((value, index) => ({
    x: index * xStep,
    y: height - ((value - min) / range) * (height - 12) - 6
  }));

  const line = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${line} L ${coordinates.at(-1).x} ${height} L ${coordinates[0].x} ${height} Z`;
  return { line, area };
}

function renderMiniChart(card, cardElement) {
  const chartPanel = cardElement.querySelector(".chart-panel");
  const line = cardElement.querySelector(".chart-line");
  const area = cardElement.querySelector(".chart-area");
  const caption = cardElement.querySelector(".chart-caption");
  const points = (card.market.chart30d || []).map((point) => point.close).filter(Number.isFinite);

  if (points.length < 2) {
    line.setAttribute("d", "");
    area.setAttribute("d", "");
    caption.textContent = "Chart unavailable";
    chartPanel.classList.remove("positive", "negative");
    return;
  }

  const first = points[0];
  const last = points.at(-1);
  const change = first !== 0 ? ((last - first) / first) * 100 : null;
  const { line: linePath, area: areaPath } = buildPath(points, 280, 120);

  line.setAttribute("d", linePath);
  area.setAttribute("d", areaPath);
  caption.textContent =
    change === null ? "30 day move unavailable" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  chartPanel.classList.remove("positive", "negative");
  if (change > 0) {
    chartPanel.classList.add("positive");
  } else if (change < 0) {
    chartPanel.classList.add("negative");
  }
}

function syncDashboardCardOrder() {
  if (!state.dashboard?.cards) {
    return;
  }

  const cardMap = new Map(state.dashboard.cards.map((card) => [card.id, card]));
  state.dashboard.cards = state.watchlist.map((entry) => cardMap.get(entry.id)).filter(Boolean);
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

function setAllCardsCollapsed(collapsed) {
  if (!state.dashboard?.cards?.length) {
    return;
  }

  state.collapsedCards = collapsed
    ? new Set(state.dashboard.cards.map((card) => card.id))
    : new Set();
  renderCards(state.dashboard.cards);
}

function getAvailableSections(card) {
  return sectionDefinitions.filter((section) => {
    if (section.id === "strategy") {
      return true;
    }

    if (section.id === "factors") {
      return Boolean(card.factorFacts?.length || card.technicalFacts?.length);
    }

    if (section.id === "analysts") {
      return Boolean(card.analystReactions?.length || card.analystSnapshot?.target || card.analystSnapshot?.rating);
    }

    if (section.id === "news") {
      return true;
    }

    return false;
  });
}

function applySectionTabs(cardElement, cardId, availableSections) {
  const nav = cardElement.querySelector(".card-section-nav");
  const enabledBlocks = Array.from(cardElement.querySelectorAll(".section-block"));

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

    fragment.querySelector(".card-tag").textContent =
      `${card.symbol} | ${[card.company.sector, card.company.industry].filter(Boolean).join(" / ") || "Public equity"}`;
    fragment.querySelector(".company-name").textContent = card.companyName;
    fragment.querySelector(".company-subtitle").textContent =
      [card.company.exchange, card.company.sector].filter(Boolean).join(" | ") || "Market profile loading";
    fragment.querySelector(".price-value").textContent = card.market.price || "Price unavailable";
    fragment.querySelector(".price-change").textContent =
      card.market.dayChange && card.market.dayChangePercent
        ? `${card.market.dayChange} (${card.market.dayChangePercent})`
        : "Daily move unavailable";

    const actionBadge = fragment.querySelector(".action-badge");
    actionBadge.textContent = card.strategy.action;
    actionBadge.classList.add(card.strategy.action.toLowerCase());

    fragment.querySelector(".sentiment-badge").textContent = card.strategy.sentiment;
    fragment.querySelector(".signal-summary").textContent = card.strategy.summary;
    appendNoteItems(
      fragment.querySelector(".highlights-list"),
      card.highlights || [],
      "No notable highlights yet."
    );

    renderMiniChart(card, fragment);
    renderFactGrid(card.quickFacts || [], fragment.querySelector(".quick-facts"));
    fragment.querySelector(".strategy-summary").textContent = card.strategy.summary;
    appendNoteItems(
      fragment.querySelector(".reasons-list"),
      card.strategy.reasons || [],
      "No decisive drivers yet."
    );
    appendNoteItems(
      fragment.querySelector(".catalysts-list"),
      card.strategy.catalysts || [],
      "No near-term catalysts identified."
    );
    appendNoteItems(
      fragment.querySelector(".risks-list"),
      card.strategy.risks || [],
      "No major short-term risks flagged."
    );
    renderFactGrid(card.factorFacts || [], fragment.querySelector(".factor-facts"));
    renderFactGrid(card.technicalFacts || [], fragment.querySelector(".technical-facts"), "technical");
    renderAnalystSnapshot(card.analystSnapshot, fragment.querySelector(".analyst-snapshot"));
    renderAnalystReactions(card.analystReactions || [], fragment.querySelector(".reaction-list"));
    renderNews(card.newsItems || [], fragment.querySelector(".news-list"));

    applySectionTabs(cardElement, card.id, getAvailableSections(card));
    applyCollapseBehavior(cardElement, card.id);
    applyReorderBehavior(cardElement, card.id);
    elements.dashboardGrid.appendChild(fragment);
  });
}

async function fetchConfig() {
  const response = await fetch("/api/personal-config");
  if (!response.ok) {
    throw new Error("Unable to load personal dashboard defaults.");
  }

  return response.json();
}

async function fetchDashboard() {
  const response = await fetch("/api/personal-dashboard", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ entries: state.watchlist })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Unable to load the personal dashboard right now.");
  }

  return response.json();
}

async function loadDashboard() {
  if (!state.watchlist.length) {
    setStatus("Add at least one stock ticker to start the dashboard.");
    elements.dashboardGrid.innerHTML = "";
    return;
  }

  state.loading = true;
  setStatus("Loading price history, factors, analyst context, and recent news...");
  setTopButtonsDisabled(true);

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
        `Loaded ${data.cards.length} cards with recent news across the last ${data.metadata.newsLookbackDays} days.`
      );
    }
  } catch (error) {
    state.dashboard = null;
    setStatus(error.message, true);
  } finally {
    state.loading = false;
    setTopButtonsDisabled(false);
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
      const panels = Array.from(card.querySelectorAll(".section-block"));
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
  const response = await fetch("/pg.css");
  if (!response.ok) {
    throw new Error("Unable to load styles for HTML export.");
  }

  const styles = await response.text();
  const root = document.documentElement.cloneNode(true);
  const head = root.querySelector("head");
  const body = root.querySelector("body");

  root.querySelectorAll("script").forEach((node) => node.remove());
  root.querySelectorAll("template").forEach((node) => node.remove());
  root.querySelectorAll("link[rel='stylesheet'][href='/pg.css']").forEach((node) => node.remove());
  root
    .querySelectorAll(
      "#refreshButton, #expandAllButton, #collapseAllButton, #exportButton, .watchlist-form, .remove-chip, .drag-hint"
    )
    .forEach((node) => node.remove());
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

  setTopButtonsDisabled(true);
  setStatus("Building standalone HTML snapshot...");

  try {
    const html = await buildStandaloneHtml();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pg-cents-and-sensibility-watchtower-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Standalone HTML snapshot is ready.");
  } catch (error) {
    setStatus(error.message || "Unable to export standalone HTML.", true);
  } finally {
    setTopButtonsDisabled(false);
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

elements.expandAllButton.addEventListener("click", () => {
  setAllCardsCollapsed(false);
});

elements.collapseAllButton.addEventListener("click", () => {
  setAllCardsCollapsed(true);
});

elements.exportButton.addEventListener("click", () => {
  exportDashboardHtml();
});

initialize().catch((error) => {
  setStatus(error.message, true);
});
