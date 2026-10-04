import { expect, it } from "vitest";
import { dealingRangeLabel, evaluateDealingRange, savedDealingRangeStatus } from "../src/tradeSetup2DealingRange.js";
import { simulationPinStageLabel } from "../src/simulationPinPresentation.js";
import { buildTradeSetup2CandidateSnapshot, buildTradeSetup2Snapshot, restoreTradeSetup2Snapshot } from "../src/tradeSetup2Snapshot.js";
import { comparisonFilters, filterReviewGroups, rangeEntryCrossTable, runFunnel } from "../src/simulationRunComparison.js";
import { simulationPinSnapshot } from "../src/simulationPinSnapshot.js";
import { tradeSetup2HistoryItems } from "../src/tradeSetup2HistoryItems.js";
import { antiConfluenceStatus } from "../src/checklistObservationRules.js";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import SimulationComparisonFilters from "../src/components/SimulationComparisonFilters.vue";
import SimulationDrList from "../src/components/SimulationDrList.vue";
const input = (found = false) => {
	const checks = Object.fromEntries([
		"liquiditySweep",
		"reaction",
		"outerM5Trend",
		"m5Trend"
	].map((k) => [k, { status: "passed" }]));
	checks.antiConfluences = {
		ruleVersion: "checklist-observation-rules-v3",
		rules: [{
			id: "h1CounterDivergence",
			disqualifies: true,
			status: found ? "found" : "clear",
			evidence: [{ recognizedAt: 600 }]
		}]
	};
	return {
		model: "countertrend",
		ruleVersion: "countertrend-abcdef-v2",
		status: "ready",
		direction: "long",
		evaluatedAt: 600,
		checks,
		setup: { primary: {
			setupType: "countertrend",
			direction: "long",
			reactionRecognizedAt: 300,
			checks,
			targetSelection: {
				status: "passed",
				selectedAt: 300,
				target1: { price: 2 }
			},
			validity: {
				state: "ended",
				reason: "invalidation",
				recognizedAt: 600
			}
		} }
	};
};
it("new price end stays validated, while a simultaneous F finding disqualifies", () => {
	expect(evaluateDealingRange(input()).status).toBe("validated");
	expect(evaluateDealingRange(input(true))).toMatchObject({
		version: "countertrend-abcdef-v2",
		status: "disqualified",
		reason: "h1CounterDivergence"
	});
});
it("historical and unknown versions are read without touching JSON", () => {
	for (const version of [
		"countertrend-abcdef-v1",
		"countertrend-abcd-v1",
		"abc-d-targets-eg-observations-v1",
		"countertrend-abcdef-v2",
		void 0,
		"future"
	]) for (const reason of [
		"priceInvalidation",
		"h1CounterDivergence",
		"antiConfluence",
		"targetsUnavailable",
		"unknown",
		void 0
	]) {
		const snapshot = { dealingRange: {
			version,
			status: version === "countertrend-abcdef-v2" ? "disqualified" : "invalidated",
			reason
		} };
		const before = JSON.stringify(snapshot);
		restoreTradeSetup2Snapshot(snapshot);
		dealingRangeLabel(snapshot);
		savedDealingRangeStatus(snapshot);
		expect(JSON.stringify(snapshot)).toBe(before);
		if (!version || version === "future") expect(savedDealingRangeStatus(snapshot)).toBe("legacy");
		if (version === "countertrend-abcdef-v1" && ["unknown", void 0].includes(reason)) expect(dealingRangeLabel(snapshot)).toBe("Historische DR-Entscheidung · Grund nicht belegt");
	}
});
it("new pins classify only a supported stage version, old pins stay unclassified", () => {
	const context = {
		contextVersion: "simulation-pin-context-v2",
		dealingRangeVersion: "countertrend-abcdef-v2",
		stage: "disqualified",
		dealingRangeReason: "antiConfluence"
	};
	const before = JSON.stringify(context);
	expect(simulationPinStageLabel(context)).toBe("Disqualifizierte Dealing Range");
	expect(JSON.stringify(context)).toBe(before);
	expect(simulationPinStageLabel({
		...context,
		dealingRangeVersion: "future"
	})).toBe("Altstand · DR-Stufe nicht gespeichert");
});
it("G disqualifies only when its existing flag is enabled and evidence is known", () => {
	const state = input();
	const g = {
		ruleVersion: "checklist-observation-rules-v3",
		rules: [{
			id: "m5SweepDivergence",
			label: "G",
			status: "found",
			disqualifies: false,
			evidence: [{ recognizedAt: 600 }]
		}]
	};
	state.setup.primary.checks.confluences = g;
	expect(evaluateDealingRange(state).status).toBe("validated");
	g.rules[0].disqualifies = true;
	expect(evaluateDealingRange(state)).toMatchObject({
		status: "disqualified",
		reason: "antiConfluence",
		gShowstoppers: [{ recognizedAt: 600 }]
	});
	g.rules[0].evidence[0].recognizedAt = 601;
	expect(evaluateDealingRange(state).status).toBe("confirmed");
});
it("new snapshots retain price lifecycle but refuse entries after its end", () => {
	const state = input();
	state.instrument = "GBPUSD";
	state.setup.primary.id = "dr";
	state.setup.primary.knownAsOf = 600;
	const snapshot = buildTradeSetup2CandidateSnapshot({
		checklist: state,
		candidate: state.setup.primary
	});
	expect(snapshot.dealingRange).toMatchObject({
		version: "countertrend-abcdef-v2",
		status: "validated"
	});
	expect(snapshot.checklist.setup.primary.validity.reason).toBe("invalidation");
	expect(buildTradeSetup2Snapshot({
		checklist: state,
		m1Check: {
			evaluatedAt: 600,
			entry: {
				id: "e",
				direction: "long",
				setupKey: "dr",
				recognizedAt: 600
			}
		}
	})).toBeNull();
});
it("unknown observation versions never classify an old field as an enabled new rule", () => {
	const check = {
		ruleVersion: "future",
		rules: [{
			status: "found",
			invalidates: true,
			evidence: []
		}]
	};
	expect(antiConfluenceStatus(check)).toBe("unknown");
	check.ruleVersion = "checklist-observation-rules-v3";
	expect(antiConfluenceStatus(check)).toBe("clear");
	check.ruleVersion = "checklist-observation-rules-v2";
	expect(antiConfluenceStatus(check)).toBe("found");
});
it("filters disqualification separately from price outcome and retains old URLs", () => {
	const snap = (version, status, reason) => ({ dealingRange: {
		version,
		status,
		reason
	} });
	const groups = [
		{
			stage: "disqualified",
			snapshot: snap("countertrend-abcdef-v2", "disqualified", "antiConfluence"),
			outcome: { status: "unknown" },
			entries: []
		},
		{
			stage: "validated",
			wasValidated: true,
			snapshot: snap("countertrend-abcdef-v2", "validated", "noCounterDivergence"),
			outcome: { status: "invalidation" },
			entries: []
		},
		{
			stage: "invalidated",
			snapshot: snap("countertrend-abcdef-v1", "invalidated", "h1CounterDivergence"),
			outcome: { status: "unknown" },
			entries: []
		}
	];
	const before = JSON.stringify(groups);
	expect(filterReviewGroups(groups, { stage: "disqualified" })).toHaveLength(2);
	expect(filterReviewGroups(groups, { outcome: "invalidation" })).toHaveLength(1);
	expect(filterReviewGroups(groups, comparisonFilters({ stage: "invalidated" }))).toEqual([groups[2]]);
	expect(runFunnel(groups, [])).toMatchObject({
		confirmed: 3,
		disqualified: 2,
		validated: 1,
		invalidationBeforeT1: 1
	});
	expect(rangeEntryCrossTable(groups, [], "wide").find((r) => r.key === "invalidation")).toMatchObject({
		total: 1,
		without: 1
	});
	expect(JSON.stringify(groups)).toBe(before);
});
it("new pin context freezes stage version and reason without overwriting old data", () => {
	const group = {
		key: "dr",
		snapshot: {
			id: "s",
			runId: "r",
			setupKey: "dr",
			knownAt: 600,
			dealingRange: {
				version: "countertrend-abcdef-v2",
				status: "validated",
				reason: "noCounterDivergence"
			}
		},
		stage: "validated",
		features: [],
		outcome: { status: "invalidation" }
	};
	const before = JSON.stringify(group);
	const context = simulationPinSnapshot({
		kind: "simulation_dr",
		group
	}, {}, []);
	expect(context).toMatchObject({
		contextVersion: "simulation-pin-context-v2",
		dealingRangeVersion: "countertrend-abcdef-v2",
		dealingRangeReason: "noCounterDivergence",
		stage: "validated"
	});
	expect(simulationPinStageLabel(context)).toBe("Validierte Dealing Range");
	expect(JSON.stringify(group)).toBe(before);
});
it("renders separate new stage and outcome filters while keeping historical links selectable", async () => {
	const render = (stage) => renderToString(createSSRApp(SimulationComparisonFilters, {
		modelValue: comparisonFilters({ stage }),
		runs: [],
		features: []
	}));
	const current = await render("");
	expect(current).toContain("value=\"disqualified\"");
	expect(current).toContain("DR-Ausgang");
	expect(current).toContain("Invalidation vor T1");
	expect(current).not.toContain("value=\"invalidated\"");
	expect(await render("invalidated")).toContain("value=\"invalidated\"");
});
it("renders valid price-ended cards and history without a disqualified stage", async () => {
	const snapshot = {
		id: "s",
		runId: "r",
		setupKey: "dr",
		instrument: "GBPUSD",
		direction: "long",
		knownAt: 600,
		dealingRange: {
			version: "countertrend-abcdef-v2",
			status: "validated",
			reason: "noCounterDivergence"
		},
		checklist: { setup: { primary: { validity: {
			state: "ended",
			reason: "invalidation",
			recognizedAt: 600
		} } } }
	};
	const app = createSSRApp(SimulationDrList, {
		groups: [{
			key: "dr",
			snapshot,
			recognizedAt: 300,
			instrument: "GBPUSD",
			direction: "long",
			setupType: "countertrend",
			entries: [],
			features: [],
			outcome: {
				status: "invalidation",
				label: "Invalidation vor T1"
			}
		}],
		results: []
	}).component("RouterLink", { render() {
		return this.$slots.default?.();
	} });
	const before = JSON.stringify(snapshot);
	const html = await renderToString(app);
	expect(html).toContain("Validierte Dealing Range");
	expect(html).toContain("Invalidation vor T1");
	expect(html).not.toContain("Disqualifizierte Dealing Range");
	expect(tradeSetup2HistoryItems([], [{
		...snapshot,
		snapshot
	}], {
		instrument: "GBPUSD",
		asOf: 700,
		historyCount: 10
	})[0].candidateStatus).toContain("Validierte Dealing Range");
	expect(JSON.stringify(snapshot)).toBe(before);
});
it("uses only the flag belonging to an explicitly saved rule version", () => {
	const rules = [{
		status: "found",
		invalidates: false,
		disqualifies: true,
		evidence: []
	}];
	expect(antiConfluenceStatus({
		ruleVersion: "checklist-observation-rules-v2",
		rules
	})).toBe("clear");
	expect(antiConfluenceStatus({
		ruleVersion: "checklist-observation-rules-v3",
		rules
	})).toBe("found");
});
import {evaluateCountertrendChecklist} from '../src/countertrendChecklist.js';
it('new pending F/G checks already persist only v3 rule fields',()=>{const result=evaluateCountertrendChecklist({instrument:'GBPUSD',evaluatedAt:600,dataStatus:'missing'});for(const key of ['antiConfluences','confluences']){expect(result.checks[key].ruleVersion).toBe('checklist-observation-rules-v3');expect(result.checks[key].rules[0]).toHaveProperty('disqualifies',false);expect(result.checks[key].rules[0]).not.toHaveProperty('invalidates');}});
import {isVersionedDealingRangeRun} from '../src/tradeSetup2DealingRange.js';
it('keeps complete serialized historical run and pin fixtures byte-identical after all readers',()=>{const fixture={run:{version:'countertrend-entry-model-1-v12',configuration:{dealingRangeVersion:'countertrend-abcdef-v1'},snapshots:[{id:'s',runId:'r',setupKey:'dr',instrument:'GBPUSD',knownAt:600,entry:null,dealingRange:{version:'countertrend-abcdef-v1',status:'invalidated',reason:'priceInvalidation'}}]},pins:[{stage:'invalidated',outcome:{status:'invalidation',label:'Alter Text'}}]};const serialized=JSON.stringify(fixture,null,2);const saved=JSON.parse(serialized);expect(isVersionedDealingRangeRun(saved.run)).toBe(true);for(const snapshot of saved.run.snapshots){restoreTradeSetup2Snapshot(snapshot);dealingRangeLabel(snapshot);}for(const pin of saved.pins){simulationPinStageLabel(pin);}expect(JSON.stringify(saved,null,2)).toBe(serialized);});
