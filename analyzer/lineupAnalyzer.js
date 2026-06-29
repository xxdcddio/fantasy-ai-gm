// Deterministic roster-construction analysis built on the Team / Player models.
// No scoring, no AI — just counts and structural observations.

const HITTING_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF"];
const WEAK_DEPTH = 1; // <= this many eligible non-IL hitters => thin

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
  findEmptyOrWeakSlots
};
