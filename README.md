# Wallet Lens

A read-only Web3 wallet tracker. Paste any public wallet address (or an ENS name like `vitalik.eth`) and see its token balances, their USD value, and its recent transactions across five EVM chains.

**Live demo:** https://anurimamajhi677.github.io/wallet-lens/

No wallet connection, no private keys, no API keys, no backend. It only reads public blockchain data.

## Features

- **Look up any wallet** by `0x…` address or ENS name (`.eth`)
- **5 chains:** Ethereum, Base, Optimism, Arbitrum, Polygon
- **Portfolio summary:** native balance and total value of priced tokens in USD
- **Token balances** sorted by value, with **spam filtering**: hides tokens flagged as scams and, by default, tokens with no market price (where most airdrop spam lives)
- **Recent transactions** with in/out direction, method name, counterparty (ENS-aware), and age, with "Load more" pagination
- **Shareable links:** the URL updates to `?address=…&chain=…`
- **Recent searches** remembered in your browser
- Works on mobile, supports light and dark mode

## How it works

```
index.html          page layout
src/api.js          small client for the public Blockscout REST API (v2)
src/format.js       pure helpers: unit conversion, formatting, spam filter
src/app.js          UI: fetches data in parallel and renders it
test/               unit tests for format.js (Node's built-in test runner)
```

- **Data source:** [Blockscout](https://docs.blockscout.com/devs/apis/rest), an open-source block explorer with a free, keyless, CORS-enabled API. Each chain is just a different Blockscout host, so adding a chain is one line in `src/api.js`.
- **Precision:** token balances arrive as huge integers in base units (wei). `fromBaseUnits` converts them with `BigInt`, so large balances don't lose precision the way JavaScript `Number` would.
- **Security:** token names and symbols are chosen by whoever deployed the token, so they are untrusted input. The UI builds every element with `textContent` and never `innerHTML`, which blocks script injection through a malicious token name.
- **Progressive loading:** the wallet summary, tokens and transactions are fetched in parallel and each section renders as soon as its own data arrives. Wallets full of airdropped spam (like `vitalik.eth`) can make the token endpoint very slow, so a slow token list never blocks the rest of the page.
- **Resilience:** requests time out after 60 seconds with a Retry option, out-of-order responses are discarded if you start a new search, and the 404 / 429 (rate limit) cases show clear messages.

## Run it locally

No install needed; it is plain HTML, CSS and JavaScript modules.

```bash
npm start        # serves the folder at http://localhost:3000
npm test         # runs the unit tests (Node 18+)
```

Or use any static server, e.g. `python3 -m http.server`.

## Built with

Vanilla JavaScript (ES modules), CSS, the Blockscout API, and GitHub Pages for hosting. Built with [Claude Code](https://claude.com/claude-code) as an AI pair programmer.

## Ideas for next steps

- NFT tab (Blockscout exposes ERC-721/1155 holdings)
- Balance across all chains at once
- Price chart for the top holding

## License

MIT
