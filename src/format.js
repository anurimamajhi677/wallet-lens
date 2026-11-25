// Pure helpers with no DOM access, so they can be unit-tested in Node.

/** True for a 0x-prefixed, 40-hex-character EVM address. */
export function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value).trim());
}

/** True for something that looks like an ENS name, e.g. "vitalik.eth". */
export function isEnsName(value) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(String(value).trim());
}

/** 0x1234…abcd */
export function shortAddress(address, lead = 6, tail = 4) {
  if (!address) return "";
  if (address.length <= lead + tail) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * Convert an integer string in base units (wei) into a decimal string,
 * using BigInt so large balances do not lose precision.
 */
export function fromBaseUnits(raw, decimals = 18) {
  const d = Number(decimals) || 0;
  let value = BigInt(raw ?? 0);
  const negative = value < 0n;
  if (negative) value = -value;
  const base = 10n ** BigInt(d);
  const whole = value / base;
  const frac = (value % base).toString().padStart(d, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

/** Human-friendly token amount: 1234.5678 -> "1,234.57", 0.000012 -> "0.000012". */
export function formatAmount(decimalString, maxFraction = 4) {
  const n = Number(decimalString);
  if (!Number.isFinite(n)) return decimalString;
  if (n === 0) return "0";
  if (Math.abs(n) < 1e-6) return "<0.000001";
  if (Math.abs(n) >= 1e15) return n.toExponential(2);
  if (Math.abs(n) >= 1e9) return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
  const digits = Math.abs(n) < 1 ? 6 : maxFraction;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** "$1,234.56"; tiny non-zero values become "<$0.01". */
export function formatUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "$0.00";
  if (Math.abs(n) < 0.01) return "<$0.01";
  if (Math.abs(n) >= 1e9) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });
  }
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** USD value of a token amount, or null when there is no price. */
export function usdValue(decimalString, exchangeRate) {
  if (exchangeRate == null || exchangeRate === "") return null;
  const v = Number(decimalString) * Number(exchangeRate);
  return Number.isFinite(v) ? v : null;
}

/** "3 min ago", "2 days ago" relative to `now`. */
export function timeAgo(isoTimestamp, now = Date.now()) {
  const then = new Date(isoTimestamp).getTime();
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, Math.round((now - then) / 1000));
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["min", 60],
  ];
  for (const [name, size] of units) {
    const n = Math.floor(s / size);
    if (n >= 1) return `${n} ${name}${n > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

/** "in" | "out" | "self" relative to the wallet being viewed. */
export function txDirection(tx, wallet) {
  const me = wallet.toLowerCase();
  const from = tx.from?.hash?.toLowerCase();
  const to = tx.to?.hash?.toLowerCase();
  if (from === me && to === me) return "self";
  if (from === me) return "out";
  return "in";
}

/**
 * Drop tokens Blockscout flags as scams and, optionally, tokens without a
 * market price (the usual home of airdropped spam). Sort by USD value.
 */
export function cleanTokens(items, { hideUnpriced = true } = {}) {
  return items
    .filter((i) => i.token && i.token.reputation !== "scam")
    .map((i) => {
      const amount = fromBaseUnits(i.value, i.token.decimals ?? 0);
      return {
        address: i.token.address_hash,
        name: i.token.name || "Unknown token",
        symbol: i.token.symbol || "?",
        icon: i.token.icon_url || null,
        amount,
        usd: usdValue(amount, i.token.exchange_rate),
      };
    })
    .filter((t) => !hideUnpriced || t.usd != null)
    .sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
}
