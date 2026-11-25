import {
  CHAINS, resolveEns, getAddress, getTokens, getTransactions,
  explorerTx, explorerAddress, explorerToken,
} from "./api.js";
import {
  isAddress, isEnsName, shortAddress, fromBaseUnits, formatAmount,
  formatUsd, usdValue, timeAgo, txDirection, cleanTokens,
} from "./format.js";

const $ = (id) => document.getElementById(id);
const form = $("search");
const input = $("address");
const chainSelect = $("chain");

// State for the wallet currently on screen.
let current = { chain: "ethereum", address: null, tokensRaw: [], nextPage: null, requestId: 0 };

// --- small DOM helper: builds elements with textContent only, never innerHTML,
// because token names and symbols are attacker-controlled strings. ---
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function setStatus(message, isError = false) {
  $("status").textContent = message || "";
  $("status").className = isError ? "error" : "";
}

// --- recent searches (per-browser convenience only) ---
function loadRecent() {
  try { return JSON.parse(localStorage.getItem("recent") || "[]"); } catch { return []; }
}
function saveRecent(query) {
  try {
    const list = [query, ...loadRecent().filter((q) => q !== query)].slice(0, 5);
    localStorage.setItem("recent", JSON.stringify(list));
  } catch { /* storage unavailable: ignore */ }
  renderRecent();
}
function renderRecent() {
  const list = loadRecent();
  const box = $("recent");
  box.replaceChildren();
  box.hidden = list.length === 0;
  if (!list.length) return;
  box.append("Recent:");
  for (const q of list) {
    const b = el("button", { type: "button", class: "link", text: isAddress(q) ? shortAddress(q) : q });
    b.addEventListener("click", () => lookup(q, chainSelect.value));
    box.append(b);
  }
}

// --- rendering ---
function renderSummary(info, chain) {
  const { symbol } = CHAINS[chain];
  const native = fromBaseUnits(info.coin_balance ?? "0", 18);
  $("wallet-name").textContent = info.ens_domain_name || shortAddress(info.hash);
  const link = $("wallet-link");
  link.textContent = shortAddress(info.hash, 10, 8);
  link.href = explorerAddress(chain, info.hash);
  $("native").textContent = `${formatAmount(native)} ${symbol}`;
  const usd = usdValue(native, info.exchange_rate);
  $("native-usd").textContent = usd == null ? "" : `≈ ${formatUsd(usd)}`;
}

function renderTokens() {
  const hideUnpriced = !$("show-unpriced").checked;
  const tokens = cleanTokens(current.tokensRaw, { hideUnpriced });
  const priced = cleanTokens(current.tokensRaw, { hideUnpriced: true });
  const total = priced.reduce((sum, t) => sum + (t.usd || 0), 0);
  $("tokens-total").textContent = formatUsd(total);
  $("tokens-count").textContent =
    `${priced.length} priced of ${current.tokensRaw.length} shown (top holdings by value)`;

  const body = $("token-rows");
  body.replaceChildren();
  if (!tokens.length) {
    body.append(el("tr", {}, el("td", { colspan: "3", class: "empty", text: "No ERC-20 tokens found." })));
    return;
  }
  for (const t of tokens) {
    const icon = t.icon
      ? el("img", { src: t.icon, alt: "", loading: "lazy", referrerpolicy: "no-referrer" })
      : el("span", { class: "dot" });
    const names = el("a", { class: "names", href: explorerToken(current.chain, t.address), target: "_blank", rel: "noopener" },
      el("span", { class: "sym", text: t.symbol }),
      el("span", { class: "nm", text: t.name }));
    body.append(el("tr", {},
      el("td", {}, el("div", { class: "token" }, icon, names)),
      el("td", { class: "num", text: formatAmount(t.amount) }),
      el("td", { class: "num", text: t.usd == null ? "—" : formatUsd(t.usd) })));
  }
}

function renderTransactions(items, append) {
  const list = $("tx-list");
  if (!append) list.replaceChildren();
  if (!append && !items.length) {
    list.append(el("li", { class: "empty", text: "No transactions yet." }));
  }
  const { symbol } = CHAINS[current.chain];
  for (const tx of items) {
    const dir = txDirection(tx, current.address);
    const counterparty = dir === "out" ? tx.to : tx.from;
    const cpName = counterparty?.ens_domain_name || counterparty?.name || shortAddress(counterparty?.hash || "contract creation");
    const method = tx.method && !tx.method.startsWith("0x") ? tx.method : (tx.value !== "0" ? "Transfer" : "Contract call");
    const amount = fromBaseUnits(tx.value, 18);

    list.append(el("li", {},
      el("span", { class: `badge ${dir}`, text: dir }),
      el("div", { class: "tx-main" },
        el("a", { class: "method", href: explorerTx(current.chain, tx.hash), target: "_blank", rel: "noopener", text: method }),
        el("div", { class: "who" },
          `${dir === "out" ? "to" : "from"} ${cpName} · ${timeAgo(tx.timestamp)}`,
          tx.status === "error" ? el("span", { class: "failed", text: " · failed" }) : null)),
      el("div", { class: "num", text: amount === "0" ? "" : `${formatAmount(amount)} ${symbol}` })));
  }
  $("more").hidden = !current.nextPage;
}

// --- main flow ---
async function lookup(query, chain) {
  query = query.trim();
  input.value = query;
  chainSelect.value = chain;
  const requestId = ++current.requestId;
  $("results").hidden = true;
  setStatus("Loading…");

  try {
    let address = query;
    if (isEnsName(query)) {
      setStatus(`Resolving ${query}…`);
      address = await resolveEns(query);
    } else if (!isAddress(query)) {
      throw new Error("Enter a valid 0x address (42 characters) or an ENS name ending in .eth.");
    }

    setStatus("Loading balances and transactions…");
    const [info, tokens, txs] = await Promise.all([
      getAddress(chain, address),
      getTokens(chain, address).catch(() => ({ items: [] })),
      getTransactions(chain, address).catch(() => ({ items: [] })),
    ]);
    if (requestId !== current.requestId) return; // a newer search started

    current = { ...current, chain, address, tokensRaw: tokens.items || [], nextPage: txs.next_page_params };
    renderSummary(info, chain);
    renderTokens();
    renderTransactions(txs.items || [], false);
    $("results").hidden = false;
    setStatus("");
    saveRecent(query);

    const url = new URL(location.href);
    url.searchParams.set("address", query);
    url.searchParams.set("chain", chain);
    history.replaceState(null, "", url);
  } catch (err) {
    if (requestId !== current.requestId) return;
    setStatus(err.message || "Something went wrong.", true);
  }
}

async function loadMore() {
  const button = $("more");
  button.disabled = true;
  button.textContent = "Loading…";
  try {
    const txs = await getTransactions(current.chain, current.address, current.nextPage);
    current.nextPage = txs.next_page_params;
    renderTransactions(txs.items || [], true);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Load more";
  }
}

// --- wiring ---
for (const [id, c] of Object.entries(CHAINS)) {
  chainSelect.append(el("option", { value: id, text: c.name }));
}
form.addEventListener("submit", (e) => { e.preventDefault(); lookup(input.value, chainSelect.value); });
chainSelect.addEventListener("change", () => { if (input.value.trim()) lookup(input.value, chainSelect.value); });
$("show-unpriced").addEventListener("change", renderTokens);
$("more").addEventListener("click", loadMore);
document.querySelectorAll("[data-example]").forEach((b) =>
  b.addEventListener("click", () => lookup(b.dataset.example, chainSelect.value)));

renderRecent();
const params = new URLSearchParams(location.search);
if (params.get("address")) {
  lookup(params.get("address"), CHAINS[params.get("chain")] ? params.get("chain") : "ethereum");
}
