(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FlankRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ROUTES = new Set(["road", "pike", "rr", "trail"]);
  const RIVER_CROSSINGS = new Set(["bridge", "dam", "ferry", "ford"]);
  const DIFFICULT = new Set(["mountain", "swamp"]);

  function n(value) { const x = Number(value); return Number.isFinite(x) ? x : 0; }
  function hasRoute(edge) { return ROUTES.has(edge?.crossing); }
  function hasRiverCrossing(edge) { return RIVER_CROSSINGS.has(edge?.crossing); }
  function isDifficult(terrain, conditions) { return DIFFICULT.has(terrain) || (terrain === "provisional-swamp" && !!conditions?.rain); }

  function zocAcross(source, target, edge, conditions = {}) {
    if (!source || source.occupancy !== "attacker" || source.demoralized) return "none";
    if (edge?.barrier === "all-water") return "none";
    if (["major-river", "minor-river"].includes(edge?.barrier) && !hasRiverCrossing(edge)) return "none";
    if ((isDifficult(source.terrain, conditions) || isDifficult(target.terrain, conditions)) && !hasRoute(edge)) return "none";
    if (["woods", "loess"].includes(edge?.barrier) && !hasRoute(edge)) return "restricted";
    return "normal";
  }

  function obstacleReasons(hex, centerTerrain, conditions) {
    const edge = hex.centerEdge || {};
    const reasons = [];
    const difficult = isDifficult(hex.terrain, conditions) || isDifficult(centerTerrain, conditions);
    if (difficult && !hasRoute(edge)) reasons.push("mountain/swamp without a route");
    const riverBlocked = ["major-river", "minor-river"].includes(edge.barrier) && !hasRiverCrossing(edge);
    const fordBlocked = conditions.riversUnfordable && ["major-river", "minor-river"].includes(edge.barrier) && edge.crossing === "ford";
    const rainCreek = conditions.rain && edge.barrier === "creek" && !hasRoute(edge);
    if (riverBlocked) reasons.push("river without bridge, dam, ferry, or ford");
    if (fordBlocked) reasons.push("unfordable river at a ford");
    if (rainCreek) reasons.push("creek without a route in rain");
    if (edge.barrier === "all-water") reasons.push("all-water / impassable hexside");
    return reasons;
  }

  function evaluateHex(index, hexes, centerTerrain, conditions, defenderCV) {
    const hex = hexes[index];
    const prev = (index + 5) % 6;
    const next = (index + 1) % 6;
    const sources = [];

    if (hex.occupancy === "attacker" && !hex.demoralized) sources.push({ from: "occupying attacker", type: "normal", cv: n(hex.unitCV) });
    const fromPrev = zocAcross(hexes[prev], hex, hexes[prev].clockwiseEdge, conditions);
    if (fromPrev !== "none") sources.push({ from: `${prev} ZOC`, type: fromPrev, cv: n(hexes[prev].unitCV) });
    const fromNext = zocAcross(hexes[next], hex, hex.clockwiseEdge, conditions);
    if (fromNext !== "none") sources.push({ from: `${next} ZOC`, type: fromNext, cv: n(hexes[next].unitCV) });
    if (["normal", "restricted"].includes(hex.externalZoc)) sources.push({ from: "external ZOC", type: hex.externalZoc, cv: n(hex.externalCV) });

    const sourceCV = sources.reduce((sum, source) => sum + source.cv, 0);
    const threshold = Math.max(0, n(defenderCV) / 4);
    const strengthQualified = sources.length > 0 && sourceCV >= threshold;
    const obstacles = obstacleReasons(hex, centerTerrain, conditions);
    const offMap = hex.occupancy === "offmap";
    const coveredReasons = [];
    if (strengthQualified) coveredReasons.push(`${sources.some(s => s.from === "occupying attacker") ? "attacker unit / " : ""}qualifying ZOC (${sourceCV} CV)`);
    else if (sources.length) coveredReasons.push(`ZOC too weak (${sourceCV} CV; ${threshold} required)`);
    obstacles.forEach(reason => coveredReasons.push(reason));
    if (offMap) coveredReasons.push("off-map hex");
    const covered = strengthQualified || obstacles.length > 0 || offMap;

    const reductionReasons = [];
    if (covered && hex.occupancy === "defender" && !hex.demoralized) reductionReasons.push("undemoralized defender unit");
    const allRestricted = sources.length > 0 && sources.every(source => source.type === "restricted");
    if (covered && hex.occupancy === "empty" && strengthQualified && allRestricted) reductionReasons.push("only restricted ZOC reaches this empty hex");
    obstacles.forEach(reason => reductionReasons.push(reason));
    if (offMap) reductionReasons.push("off-map hex");

    return { index, covered, coveredReasons, reduction: covered && reductionReasons.length > 0, reductionReasons, sources, sourceCV, threshold, strengthQualified };
  }

  function computeFlank(input) {
    const hexes = input.hexes;
    const conditions = { rain: !!input.conditions?.rain, riversUnfordable: !!input.conditions?.riversUnfordable };
    const evaluations = hexes.map((_, index) => evaluateHex(index, hexes, input.centerTerrain, conditions, input.defenderCV));
    const coveredCount = evaluations.filter(x => x.covered).length;
    const basic = coveredCount === 6 ? 4 : coveredCount === 5 ? 2 : 0;
    const eligibleReductions = evaluations.filter(x => x.covered && x.reduction).length;
    const reduction = basic ? Math.min(3, eligibleReductions) : 0;
    const afterStep3 = Math.max(0, basic - reduction);
    let final = afterStep3;
    let special = "none";
    if (input.flanksRefused) {
      final = afterStep3 === 4 ? 2 : afterStep3 > 0 ? 1 : 0;
      special = "flanks-refused";
    } else if (input.cavalryAdjusted) {
      final = afterStep3 === 4 ? 2 : afterStep3 >= 2 ? 1 : 0;
      special = "cavalry";
    }
    return { evaluations, coveredCount, basic, eligibleReductions, reduction, afterStep3, final, special };
  }

  return { computeFlank, zocAcross, obstacleReasons };
});
