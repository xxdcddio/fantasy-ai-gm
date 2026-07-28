// Deterministic roster-construction analysis built on the Team / Player models.
// No scoring, no AI — just counts and structural observations.

const HITTING_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF"];
const WEAK_DEPTH = 1; // <= this many eligible non-IL hitters => thin

// P2 — Replacement Cost: positions where the league-wide free-agent pool is
// thin, so losing your only option here is harder to fix via streaming than
// at a deep position like OF. RP/SP scarcity isn't roster-depth-checked (no
// pitcher depth chart yet, see findEmptyOrWeakSlots) -- scarcity there is a
// flat bonus wherever it's consumed, not a weak-slot classification.
const SCARCE_POSITIONS = new Set(["C", "SS", "RP", "SP"]);
const SCARCE_HITTING_POSITIONS = new Set(["C", "SS"]);

const byName = (a, b) => a.name.localeCompare(b.name);

// Depth chart: each defensive position -> sorted names of non-IL hitters
// eligible there. Multi-position players appear under every slot they cover.
const getPositionDepth = (team) => {
  const available = team.hitters().filter((p) => !p.isIL());
  const depth = {};
  HITTING_POSITIONS.forEach((pos) => {
    depth[pos] = available
      .filter((p) => p.canPlay(pos))
      .map((p) => p.name)
      .sort();
  });
  return depth;
};

// Bench (slot BN) players — the pool of drop candidates.
const getBenchCandidates = (team) =>
  team
    .getBench()
    .map((p) => ({
      name: p.name,
      slot: p.slot,
      eligiblePositions: [...p.eligiblePositions],
      isPitcher: p.isPitcher()
    }))
    .sort(byName);

const getILSummary = (team) =>
  team
    .getIL()
    .map((p) => ({
      name: p.name,
      status: p.status,
      eligiblePositions: [...p.eligiblePositions]
    }))
    .sort(byName);

// Positions with too few eligible non-IL hitters to cover comfortably.
const findEmptyOrWeakSlots = (team) => {
  const depth = getPositionDepth(team);
  return HITTING_POSITIONS.filter((pos) => depth[pos].length <= WEAK_DEPTH);
};

// P2 — Weak Position Bonus reclassification: *why* a slot is weak matters.
// A star on a short IL stint isn't the same problem as never having rostered
// a backup there at all.
//   - 0 eligible, someone on IL there  -> "Temporary injury" (resolves itself)
//   - 0 eligible, nobody on IL there   -> "No starter"
//   - 1 eligible, scarce position      -> "Permanent weakness" (hard to fix)
//   - 1 eligible, not scarce           -> "No backup"
const classifyWeakSlots = (team) => {
  const depth = getPositionDepth(team);
  const ilPositions = new Set(team.getIL().flatMap((p) => p.eligiblePositions || []));
  const classification = {};

  HITTING_POSITIONS.forEach((pos) => {
    const count = depth[pos].length;
    if (count > WEAK_DEPTH) return;

    if (count === 0) {
      classification[pos] = ilPositions.has(pos) ? "Temporary injury" : "No starter";
    } else {
      classification[pos] = SCARCE_HITTING_POSITIONS.has(pos) ? "Permanent weakness" : "No backup";
    }
  });

  return classification;
};

const analyzeLineup = (team) => {
  const positionDepth = getPositionDepth(team);
  const bench = getBenchCandidates(team);
  const IL = getILSummary(team);
  const weakSlots = findEmptyOrWeakSlots(team);

  const notes = [
    ...weakSlots.map(
      (pos) => `${pos} is thin (${positionDepth[pos].length} eligible)`
    )
  ];
  if (IL.length) notes.push(`${IL.length} players on IL`);

  return { positionDepth, bench, IL, weakSlots, notes };
};

module.exports = {
  analyzeLineup,
  getPositionDepth,
  getBenchCandidates,
  getILSummary,
  findEmptyOrWeakSlots,
  classifyWeakSlots,
  SCARCE_POSITIONS
};
