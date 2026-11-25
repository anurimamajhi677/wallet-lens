import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAddress, isEnsName, shortAddress, fromBaseUnits, formatAmount,
  formatUsd, usdValue, timeAgo, txDirection, cleanTokens,
} from "../src/format.js";

const ME = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const OTHER = "0x0000000000000000000000000000000000000001";

test("isAddress / isEnsName", () => {
  assert.ok(isAddress(ME));
  assert.ok(!isAddress("0x123"));
  assert.ok(!isAddress("vitalik.eth"));
  assert.ok(isEnsName("vitalik.eth"));
  assert.ok(isEnsName("sub.name.eth"));
  assert.ok(!isEnsName("vitalik.com"));
});

test("shortAddress", () => {
  assert.equal(shortAddress(ME), "0xd8dA…6045");
});

test("fromBaseUnits keeps precision with BigInt", () => {
  assert.equal(fromBaseUnits("1000000000000000000", 18), "1");
  assert.equal(fromBaseUnits("1500000", 6), "1.5");
  assert.equal(fromBaseUnits("1", 18), "0.000000000000000001");
  assert.equal(fromBaseUnits("123456789012345678901234567890", 18), "123456789012.34567890123456789");
  assert.equal(fromBaseUnits("0", 18), "0");
  assert.equal(fromBaseUnits("42", 0), "42");
});

test("formatAmount and formatUsd", () => {
  assert.equal(formatAmount("1234.56789"), "1,234.5679");
  assert.equal(formatAmount("0.0000123"), "0.000012");
  assert.equal(formatAmount("0.0000000001"), "<0.000001");
  assert.equal(formatAmount("0"), "0");
  assert.equal(formatUsd(1234.5), "$1,234.50");
  assert.equal(formatUsd(0.001), "<$0.01");
  assert.equal(formatUsd(0), "$0.00");
});

test("usdValue", () => {
  assert.equal(usdValue("2", "1500"), 3000);
  assert.equal(usdValue("2", null), null);
});

test("timeAgo", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  assert.equal(timeAgo("2026-11-25T11:58:00Z", now), "2 mins ago");
  assert.equal(timeAgo("2026-11-24T12:00:00Z", now), "1 day ago");
  assert.equal(timeAgo("2026-11-25T12:00:00Z", now), "just now");
});

test("txDirection", () => {
  assert.equal(txDirection({ from: { hash: ME }, to: { hash: OTHER } }, ME.toLowerCase()), "out");
  assert.equal(txDirection({ from: { hash: OTHER }, to: { hash: ME } }, ME), "in");
  assert.equal(txDirection({ from: { hash: ME }, to: { hash: ME } }, ME), "self");
  assert.equal(txDirection({ from: { hash: ME }, to: null }, ME), "out");
});

test("cleanTokens drops scams and unpriced tokens, sorts by value", () => {
  const items = [
    { value: "1000000", token: { address_hash: "0xa", symbol: "USDC", name: "USD Coin", decimals: "6", exchange_rate: "1", reputation: "ok" } },
    { value: "2000000000000000000", token: { address_hash: "0xb", symbol: "WETH", name: "Wrapped Ether", decimals: "18", exchange_rate: "3000", reputation: "ok" } },
    { value: "5", token: { address_hash: "0xc", symbol: "SCAM", name: "Claim rewards", decimals: "0", exchange_rate: "1", reputation: "scam" } },
    { value: "7", token: { address_hash: "0xd", symbol: "NOPRICE", name: "Airdrop", decimals: "0", exchange_rate: null, reputation: "ok" } },
  ];
  const priced = cleanTokens(items);
  assert.deepEqual(priced.map((t) => t.symbol), ["WETH", "USDC"]);
  assert.equal(priced[0].usd, 6000);
  const all = cleanTokens(items, { hideUnpriced: false });
  assert.deepEqual(all.map((t) => t.symbol), ["WETH", "USDC", "NOPRICE"]);
});
