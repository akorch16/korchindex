// One-off, idempotent: some FY26 tickers undergo stock splits mid-season.
// Yahoo's live price always reflects the current share count, but our
// recorded openingPrice/checkpointPrices are snapshots from before any
// split happened -- so a reverse split makes a ticker look like it gained
// hundreds of percent when it didn't (and vice versa for a forward split).
// This rescales historical reference prices to match the current share
// basis. Extend SPLITS as new events are discovered; each entry is applied
// only once (guarded by the marker below).
import { readFile, writeFile } from 'node:fs/promises'

const YEAR3_PATH = new URL('../src/data/year3.json', import.meta.url)
const year3 = JSON.parse(await readFile(YEAR3_PATH, 'utf8'))

// ratio: multiply pre-split prices by this to express them in post-split
// share terms. A 1:30 reverse split (1 new share per 30 old) -> ratio 30.
const SPLITS = [{ ticker: 'BYND', ratio: 30, note: '1:30 reverse split, 2026-08-14' }]

let applied = 0
for (const { ticker, ratio, note } of SPLITS) {
  for (const p of year3.people) {
    if (p.ticker !== ticker || p.splitAdjusted?.includes(note)) continue
    if (p.openingPrice != null) p.openingPrice = Math.round(p.openingPrice * ratio * 10000) / 10000
    if (p.checkpointPrices) p.checkpointPrices = p.checkpointPrices.map((v) => (v == null ? null : Math.round(v * ratio * 10000) / 10000))
    p.splitAdjusted = [...(p.splitAdjusted ?? []), note]
    applied++
  }
}

await writeFile(YEAR3_PATH, JSON.stringify(year3, null, 1) + '\n')
console.log(`Applied ${applied} split adjustment(s).`)
