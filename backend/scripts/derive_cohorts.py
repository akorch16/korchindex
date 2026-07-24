"""Recover per-person cohort membership from groups.json's pre-averaged series.

Every published cohort series is the equal-weight mean of its members' quarterly
cumulative-change vectors, and all 41 member vectors are in year2.json — so
membership is *solvable*, not guessable: for each cohort and candidate size k,
search for the subset whose 4-quarter mean reproduces the published series.
Four simultaneous constraints prune the search hard; name/gender priors narrow
it further; large cohorts are searched via their complement inside the
candidate set (choosing who's excluded instead of who's included).

Established numerically before/while writing this solver:
  - KORCH == mean of all 41 picks (6-dp exact) — the fund is the roster mean.
  - "Everyone" == all 41 minus one CRWD holder; two people picked CRWD, so the
    excluded member is mathematically interchangeable → served as fallback.
  - "Men" == the 20 participants tagged/inferred male (6-dp exact).

People who picked the same ticker have identical change vectors and are
mathematically interchangeable — solutions are only auto-accepted when the
member set is unique, or when a domain prior (`prefer`) collapses the
interchangeable choices to one. Anything still ambiguous or unmatched falls
back to serving the published series verbatim (cohorts.derived = false); the
API output is numerically identical either way, since derived cohorts are
validated against the published numbers.

Output: derived/cohort_memberships.json + a human-readable report on stdout.
"""
import json
import pathlib
from collections import defaultdict

HERE = pathlib.Path(__file__).parent
DATA = HERE / ".." / ".." / "src" / "data"
OUT = HERE / "derived"

SCALE = 1_000_000  # integer micro-units to avoid float drift in the search

year2 = json.loads((DATA / "year2.json").read_text())
groups = json.loads((DATA / "groups.json").read_text())
year1 = json.loads((DATA / "year1.json").read_text())

people = [
    {"name": p["name"], "ticker": p["ticker"].strip(), "vec": tuple(round(c * SCALE) for c in p["changes"])}
    for p in year2["people"]
    if all(c is not None for c in p["changes"])
]
N = len(people)
NAME_TO_IDX = {p["name"]: i for i, p in enumerate(people)}

# ---------------------------------------------------------------- priors ----
# Gender: year1 carries M/W per person; map year1 names to year2 names where
# the drift is unambiguous, hand-fill people new in year2, leave true unknowns
# out so the solver decides them.
Y1_TO_Y2 = {
    "Alex Armstrong": "Alexander Armstrong",
    "Karen Korchinski": "Karin Korchinski",
    "Natalie Tran": "Natalie Lee",
    "Theo Lee": "Theodore Lee",
    "Tim": "Tim Morris",
    "Brit": "Brittany Buckley",
    "Jamie": "Jamie Armstrong",
    "Leala": "Leala Wong",
    "Buckley": "Scott Buckley",
    "Chris Morris": "Christopher Morris",
}
GENDER = {}
for p in year1["people"]:
    if p.get("gender"):
        GENDER[Y1_TO_Y2.get(p["name"], p["name"])] = p["gender"]
GENDER.update({
    "Suzy Walker": "W", "Julia Korchinski": "W", "Michelle Sullivan": "W",
    "Ana Sarmiento": "W", "Jason Feder": "M", "Kevin Perko": "M",
    "Hector Sarmiento": "M", "Jim Korchinski": "M",
    # 'Brenley' deliberately absent — unknown, resolved by the solver.
})

# ------------------------------------------------------------ search core ----
# People with identical change vectors (same ticker) are collapsed into
# equivalence classes: the DFS chooses a COUNT per class, which removes the
# duplicate branches that made per-person search blow up, and makes
# interchangeability explicit — a solution taking 1 of a 2-person class is
# underdetermined membership by construction.

def _class_subset_sum(cvecs, mults, k, tgt, tol, node_cap, sol_cap):
    """All count-assignments over classes (sum of counts = k) with sum≈tgt/dim.
    Bounds: exact r-smallest/r-largest suffix sums per dim over the expanded
    multiset of remaining values."""
    n = len(cvecs)
    order = sorted(range(n), key=lambda i: cvecs[i][0])
    v = [cvecs[i] for i in order]
    m = [mults[i] for i in order]
    min_sum = [None] * (n + 1)
    max_sum = [None] * (n + 1)
    empty = [[0], [0], [0], [0]]
    min_sum[n] = max_sum[n] = empty
    for i in range(n - 1, -1, -1):
        min_sum[i], max_sum[i] = [], []
        for d in range(4):
            expanded = sorted(x for j in range(i, n) for x in [v[j][d]] * m[j])
            lo, hi, alo, ahi = [0], [0], 0, 0
            for r in range(len(expanded)):
                alo += expanded[r]
                ahi += expanded[-1 - r]
                lo.append(alo)
                hi.append(ahi)
            min_sum[i].append(lo)
            max_sum[i].append(hi)

    sols, nodes = [], 0
    counts = [0] * n

    def dfs(i, r, acc):
        nonlocal nodes
        nodes += 1
        if nodes > node_cap or len(sols) >= sol_cap:
            return
        if r == 0:
            if all(abs(acc[d] - tgt[d]) <= tol for d in range(4)):
                sols.append(tuple((order[j], counts[j]) for j in range(n) if counts[j]))
            return
        if i == n or sum(m[i:]) < r:
            return
        for d in range(4):
            if acc[d] + min_sum[i][d][r] > tgt[d] + tol:
                return
            if acc[d] + max_sum[i][d][r] < tgt[d] - tol:
                return
        for c in range(min(m[i], r), -1, -1):
            counts[i] = c
            dfs(i + 1, r - c, tuple(acc[d] + c * v[i][d] for d in range(4)))
        counts[i] = 0

    dfs(0, k, (0, 0, 0, 0))
    return sols, nodes > node_cap


def solve(target, k, candidates, tol_per_member=1, node_cap=40_000_000, sol_cap=64):
    """All class-count solutions over `candidates` of size k whose mean ≈ target.
    Returns (solutions, capped); each solution is a tuple of (class_id, count)
    where class_id keys CLASS_MEMBERS below. Searches the complement when k is
    more than half the pool."""
    cand = list(candidates)
    n = len(cand)
    if k > n:
        return [], False, {}
    by_vec = {}
    for i in cand:
        by_vec.setdefault(people[i]["vec"], []).append(i)
    cvecs = list(by_vec.keys())
    members = {ci: idxs for ci, idxs in enumerate(by_vec.values())}
    mults = [len(members[ci]) for ci in range(len(cvecs))]
    tol = k * tol_per_member + 3
    if k <= n / 2 or k == n:
        tgt = tuple(round(t * SCALE * k) for t in target)
        sols, capped = _class_subset_sum(cvecs, mults, k, tgt, tol, node_cap, sol_cap)
        return sols, capped, members
    total = tuple(sum(v[d]) if False else sum(cvecs[ci][d] * mults[ci] for ci in range(len(cvecs))) for d in range(4))
    tgt = tuple(total[d] - round(target[d] * SCALE * k) for d in range(4))
    sols, capped = _class_subset_sum(cvecs, mults, n - k, tgt, tol, node_cap, sol_cap)
    inverted = []
    for s in sols:
        taken = dict(s)
        inverted.append(tuple((ci, mults[ci] - taken.get(ci, 0)) for ci in range(len(cvecs)) if mults[ci] - taken.get(ci, 0)))
    return inverted, capped, members


CANDIDATES = {}  # cohort name -> list of (class-count solution, members_map)


def search(name, target, k_range, candidates=None, prefer=(), tol_per_member=1):
    """Try each k; accept when exactly one class-count solution exists AND its
    membership is fully determined (every taken class is taken whole), or when
    `prefer` domain priors resolve the interchangeable choices."""
    candidates = list(candidates) if candidates is not None else list(range(N))
    found = []  # (solution, members_map)
    for k in k_range:
        sols, capped, members = solve(target, k, candidates, tol_per_member=tol_per_member)
        if capped:
            return None, f"search capped at k={k}"
        found.extend((s, members) for s in sols)
    CANDIDATES[name] = list(found)
    if not found:
        return None, "no subset reproduces the series"
    if prefer and len(found) > 1:
        pref_idx = {NAME_TO_IDX[n] for n in prefer}
        def contains_pref(item):
            s, members = item
            covered = set()
            for ci, cnt in s:
                covered |= set(members[ci]) if cnt == len(members[ci]) else (pref_idx & set(members[ci]))
            return pref_idx <= covered
        preferred = [f for f in found if contains_pref(f)]
        if preferred:
            found = sorted(preferred, key=lambda f: sum(c for _, c in f[0]))[:1]
    if len(found) > 1:
        return None, f"ambiguous: {len(found)} class-count solutions"
    sol, members = found[0]
    out, pref_idx = set(), {NAME_TO_IDX[n] for n in prefer}
    for ci, cnt in sol:
        cls = members[ci]
        if cnt == len(cls):
            out |= set(cls)
        else:
            chosen_pref = [i for i in cls if i in pref_idx]
            if len(chosen_pref) == cnt:
                out |= set(chosen_pref)
            else:
                names = ", ".join(people[i]["name"] for i in cls)
                return None, f"underdetermined: takes {cnt} of interchangeable {{{names}}}"
    return frozenset(out), None


def mean_of(indices):
    k = len(indices)
    return [sum(people[i]["vec"][d] for i in indices) / (SCALE * k) for d in range(4)]


def validate(indices, target):
    if not indices:
        return False
    got = mean_of(indices)
    return all(abs(g - t) <= 1e-4 for g, t in zip(got, target))


# --------------------------------------------------------------- cohorts ----
results = {}
series4 = {name: vals[1:] for name, vals in groups.items()}  # drop leading 0.0


def record(name, category, members=None, note=None):
    ok = members is not None and validate(members, series4[name])
    results[name] = {
        "category": category,
        "derived": bool(ok),
        "members": sorted(people[i]["name"] for i in members) if ok else [],
        "note": note if not ok else None,
    }


def solve_and_record(name, category, k_range, candidates=None, prefer=(), tol_per_member=1):
    sol, err = search(name, series4[name], k_range, candidates, prefer, tol_per_member)
    record(name, category, sol, err)
    return set(sol) if sol else None


def class_sig(indices):
    return tuple(sorted(people[i]["ticker"] for i in indices))


def resolve_partition(big_name, small_names, category):
    """Partition constraint: the small cohorts plus the big one must tile the
    roster, so the big one's published series discriminates between ambiguous
    small-cohort solutions (e.g. one-vs-both LMT holders in 'English').
    Identical-vector member swaps can't be distinguished this way — a small
    cohort is only re-recorded when its membership is fully determined."""
    def expansions(name):
        r = results.get(name)
        if r and r["derived"]:
            return [(frozenset(NAME_TO_IDX[n] for n in r["members"]), True)]
        out = []
        for sol, members in CANDIDATES.get(name, []):
            rep, det = set(), True
            for ci, cnt in sol:
                cls = members[ci]
                rep |= set(cls[:cnt])
                if cnt != len(cls):
                    det = False
            out.append((frozenset(rep), det))
        return out

    import itertools as it
    option_lists = [expansions(n) for n in small_names]
    if not all(option_lists):
        return
    valid = []
    for combo in it.product(*option_lists):
        sets = [c[0] for c in combo]
        union = set().union(*sets)
        if len(union) != sum(len(s) for s in sets):
            continue
        rest = frozenset(all_idx - union)
        if rest and validate(rest, series4[big_name]):
            valid.append((combo, rest))
    if not valid:
        return
    # Re-record each small whose chosen set is identical and determined in every valid combo.
    for pos, name in enumerate(small_names):
        choices = {(combo[pos][0], combo[pos][1]) for combo, _ in valid}
        if len(choices) == 1:
            chosen, det = next(iter(choices))
            if det and not results[name]["derived"]:
                record(name, category, chosen)
    rests = {rest for _, rest in valid}
    all_det = all(all(c[1] for c in combo) for combo, _ in valid)
    if len(rests) == 1 and all_det:
        record(big_name, category, next(iter(rests)))
    elif len({class_sig(rest) for rest in rests}) == 1:
        results[big_name] = {
            "category": category, "derived": False, "members": [],
            "note": "complement composition known by ticker multiset, exact members interchangeable",
        }


# Benchmarks: published-series only, never person cohorts.
for bname in ("S&P 500", "Warren Buffett"):
    results[bname] = {"category": "benchmark", "derived": False, "members": [], "note": "market benchmark series"}

# Fund aggregates (established numerically, validated here):
all_idx = frozenset(range(N))
record("KORCH", "fund", all_idx, "roster mean does not match")  # KORCH = mean of all 41
# "Everyone" = all 41 minus one of the two CRWD holders — interchangeable, so fallback.
record("Everyone", "fund", None,
       "equals the roster minus one CRWD holder; two people picked CRWD, exclusion is interchangeable")

# Names.
scotts = frozenset(i for i, p in enumerate(people) if p["name"].split()[0] == "Scott")
record("Scott", "name", scotts, "the three Scotts do not average to the series")
alex_cand = [i for i, p in enumerate(people) if p["name"].split()[0] in ("Alex", "Alexander", "Alejandra")]
solve_and_record("Alex", "name", range(1, len(alex_cand) + 1), alex_cand)

# Gender. Men == tagged males (verified). Women is NOT the complement of Men
# (verified numerically), so search it over the whole roster — the sheet's
# split may use a different-but-interchangeable member of a shared-ticker pair.
males = frozenset(i for i, p in enumerate(people) if GENDER.get(p["name"]) == "M")
record("Men", "gender", males, "gender-prior male set does not reproduce the series")
# Women is close to the female-prior set but not equal (verified) — a blind
# k≈20 search over 41 people is intractable, so search local edits instead:
# start from the tagged females and try removing up to 2 / adding up to 2.
import itertools as _it

females = frozenset(i for i, p in enumerate(people) if GENDER.get(p["name"]) == "W")
_others = sorted(all_idx - females)
_women_hits = []
for n_rem in (0, 1, 2):
    for rem in _it.combinations(sorted(females), n_rem):
        base = females - set(rem)
        for n_add in (0, 1, 2):
            for add in _it.combinations(_others, n_add):
                s = frozenset(base | set(add))
                if s and validate(s, series4["Women"]):
                    _women_hits.append(s)
_women_hits = list(dict.fromkeys(_women_hits))
if len(_women_hits) == 1:
    record("Women", "gender", _women_hits[0])
elif _women_hits and len({class_sig(s) for s in _women_hits}) == 1:
    record("Women", "gender", None,
           f"composition known by ticker multiset ({len(_women_hits)} interchangeable member sets)")
else:
    record("Women", "gender", None,
           f"local-edit search found {len(_women_hits)} distinct solutions" if _women_hits
           else "no ±2-edit variant of the female-prior set reproduces the series")

females = frozenset(i for i, p in enumerate(people) if GENDER.get(p["name"]) == "W")

# Wife (of the fund manager) — newsletter: he married a Mexican; wife picked CRWD.
solve_and_record("Wife", "family", (1, 2), sorted(females), prefer=("Alejandra Orozco",))

# Countries: solve the small ones (Mexicans prior: the wife). The Americans
# complement then arbitrates any remaining ambiguity via resolve_partition —
# e.g. whether 'English' is one or both LMT holders changes the complement's
# size and mean, which the published Americans series must reproduce.
solve_and_record("Mexicans", "country", range(1, 4), prefer=("Alejandra Orozco",))
solve_and_record("English", "country", range(1, 5))
solve_and_record("Canadians", "country", range(1, 11), tol_per_member=3)
record("Americans", "country", None, "pending partition resolution")
resolve_partition("Americans", ["Mexicans", "English", "Canadians"], "country")

# Generations: solve three, Millennials arbitrated as the partition complement.
solve_and_record("Gen Z", "generation", range(1, 8))
solve_and_record("Gen X", "generation", range(1, 10))
solve_and_record("Boomers", "generation", range(1, 14))
record("Millennials", "generation", None, "pending partition resolution")
resolve_partition("Millennials", ["Gen Z", "Gen X", "Boomers"], "generation")

# Family: uncles are male, aunts female; cousins get a Withers family-name
# prior over the interchangeable BYDDY pair (Adriana Withers vs Kevin Perko).
solve_and_record("Uncles", "family", range(1, 9), sorted(males))
aunt_cand = sorted(females | (all_idx - males - females))  # women + unknown-gender
solve_and_record("Aunts", "family", range(1, 11), aunt_cand)
solve_and_record("Cousins", "family", range(1, 13), prefer=("Adriana Withers",))

# Schools. Cross-referenced couple priors resolve the interchangeable picks:
# Alexander Armstrong is a matched SBHS grad → his wife Jamie Armstrong is the
# HD-holding "Wife of SBHS"; the Buckleys pair the same way on the UCLA side
# (Scott Buckley the CRWD-holding grad, Brittany Buckley the HD-holding wife).
solve_and_record("Santa Barbara High Grad", "school", range(1, 7))
solve_and_record("Wife of SBHS", "school", range(1, 7), aunt_cand, prefer=("Jamie Armstrong",))
solve_and_record("UCLA Grad", "school", range(1, 11), prefer=("Scott Buckley",))
solve_and_record("Wife of UCLA Grad", "school", range(1, 8), aunt_cand, prefer=("Brittany Buckley",))

# ---------------------------------------------------------------- output ----
OUT.mkdir(exist_ok=True)
(OUT / "cohort_memberships.json").write_text(json.dumps(results, indent=1) + "\n")

matched = sum(1 for r in results.values() if r["derived"])
print(f"=== Cohort derivation report: {matched}/{len(results)} derived ===\n")
by_cat = defaultdict(list)
for name, r in results.items():
    by_cat[r["category"]].append((name, r))
for cat in sorted(by_cat):
    for name, r in sorted(by_cat[cat]):
        if r["derived"]:
            print(f"[MATCHED]   {name} ({cat}, k={len(r['members'])}): {', '.join(r['members'])}")
        else:
            print(f"[FALLBACK]  {name} ({cat}): {r['note']}")
    print()
