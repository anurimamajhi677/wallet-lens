// Thin client for the free, keyless Blockscout REST API (v2).
// Docs: https://docs.blockscout.com/devs/apis/rest

export const CHAINS = {
  ethereum: { name: "Ethereum", symbol: "ETH", host: "https://eth.blockscout.com" },
  base: { name: "Base", symbol: "ETH", host: "https://base.blockscout.com" },
  optimism: { name: "Optimism", symbol: "ETH", host: "https://explorer.optimism.io" },
  arbitrum: { name: "Arbitrum", symbol: "ETH", host: "https://arbitrum.blockscout.com" },
  polygon: { name: "Polygon", symbol: "POL", host: "https://polygon.blockscout.com" },
};

const TIMEOUT_MS = 60000;

async function get(chain, path, params = {}) {
  const url = new URL(`/api/v2${path}`, CHAINS[chain].host);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  let res;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === "TimeoutError") throw new Error("The explorer took too long to respond. Try again.");
    throw new Error("Network error: could not reach the explorer.");
  }
  if (res.status === 404) throw new Error("No activity found for this address on this chain.");
  if (res.status === 429) throw new Error("Rate limited by the explorer. Wait a few seconds and try again.");
  if (!res.ok) throw new Error(`Explorer returned ${res.status}.`);
  return res.json();
}

/** Resolve an ENS name (e.g. vitalik.eth) to an address via Blockscout search. */
export async function resolveEns(name) {
  const data = await get("ethereum", "/search", { q: name });
  const hit = (data.items || []).find(
    (i) => i.ens_info?.name?.toLowerCase() === name.toLowerCase()
  );
  if (!hit) throw new Error(`Could not resolve ${name}.`);
  return hit.address_hash;
}

export const getAddress = (chain, address) => get(chain, `/addresses/${address}`);

export const getTokens = (chain, address) =>
  get(chain, `/addresses/${address}/tokens`, { type: "ERC-20" });

/** Recent transactions. Pass the previous page's `next_page_params` to page. */
export const getTransactions = (chain, address, pageParams = {}) =>
  get(chain, `/addresses/${address}/transactions`, pageParams);

export const explorerTx = (chain, hash) => `${CHAINS[chain].host}/tx/${hash}`;
export const explorerAddress = (chain, address) => `${CHAINS[chain].host}/address/${address}`;
export const explorerToken = (chain, address) => `${CHAINS[chain].host}/token/${address}`;
