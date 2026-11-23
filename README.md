[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/epul2/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/epul2/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Radar — make.fun

A token launch radar built by an AI agent for make.fun's [Build the best token launch radar](https://make.fun/bounty/token-radar-01) bounty ($1,325, 10 places, 1st place $1,000).

The question it answers: which pre-token protocol is worth farming next, and what do I do about it? It reads a sealed snapshot of every protocol DefiLlama tracks (758 protocols, fetched 2026-11-14), ranks the ones that record no token by what their launch would be worth, and gives every one a farm plan with costs and times.

## The model (radar-2)

The implied value follows only from the snapshot's own figures, and the multiple is the market's own pricing, read from the same snapshot: for each category, the median market-cap-to-TVL ratio of the protocols in that category whose token already trades (at least three of them, else the global median), clamped to [0.05, 1.50]. A DEX is priced like the DEXs that trade; a lending protocol like the lending protocols that trade.

```
implied = TVL × category multiple × growth × maturity × breadth
  growth:   1 + clamp(7d change, -60, 120) / 100 × 0.5
  maturity: 0.6 + min(age, 1095d) / 1095 × 0.4   (age unknown: 365d)
  breadth:  1 + 0.05 × min(log2(chains), 4)
```

The board ranks every rankable pre-token protocol — 198 of them: the 40 on the snapshot's watchlist plus every other one below the floor. Rankable means pre-token and not a wrapped, staked or bridged product of a token that already trades (no Bridge / Liquid Staking / CEX category, no version marker, no wrapped/staked word, no exchange's name at the start). WBTC is Bitcoin on Ethereum and Binance staked ETH is ETH in Binance's staking product; neither is a protocol still waiting on a launch of its own, so neither ranks.

Each row carries a seven-step farm plan derived from the protocol's own record — category, chains, TVL and age decide the action, the capital, the hold and every cost and time. Multi-chain protocols get a repeat step on their second chain; single-chain ones get a top-up step instead.

## The dashboard

`dashboard/` is a static page with no network: a sortable, filterable board (search, category, chain, watchlist-only), a detail view for every protocol with the model's own equation and its farm plan, the live-token view the multiples come from, and a "How it prices a launch" table. The page recomputes every row from the snapshot figures and checks the number `board.json` carries, so the page's code and the board's data are visibly the same arithmetic.

## Run it locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the snapshot, writes the ranked board to `board.json`, writes the dashboard's data beside the page, copies `dashboard/` and `screenshots/` to the output, and writes `dossier.json` with `buildDossier` from `vendor/makefun-board.ts`.

## A note on what this board claims

Implied value is this entry's own estimate from the snapshot's figures; it does not predict whether or when a token is issued. "Records no token" means the snapshot's record carries no token for the protocol, not that the protocol has none. Data: DefiLlama `https://api.llama.fi/protocols`, fetched 2026-11-14.
