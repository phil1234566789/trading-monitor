import {
	Pivot,
	PivotHigh,
	PivotLow,
	MarketStructureState,
} from '../../../src/range.type';
import { Candle } from '../../../src/marketStructureAnalysis';

/** GBPUSD H1-Periode-5 Pivots ab 13.07.2026 10:00 bis 23.07.2026 06:00 (test/fixtures/
 * gbpusd-h1-trend.json, exakt wie detectLiquidityLevels/buildLevel in src/liquidity.js
 * erkannt+getoucht) — 1:1 aus einem echten .debug/metadata.json-Snapshot vom 23.07.2026, ~21:47
 * übernommen (Chat: "nimm den snapshot und schreib ne neue TDD Datei"), touchedTime dabei aus dem
 * angezeigten touchedAt zurückgerechnet (Europe/Berlin, UTC+2 im Sommer, keine DST-Umstellung in
 * diesem Fenster -> UTC = lokal - 2h; die Metadaten-Panels zeigen touchedTime selbst nicht an,
 * siehe range.type.ts: PivotTouched). */
const pivot1: PivotHigh = {
	type: 'high',
	price: 1.34122,
	pivotAt: '13.07.2026 10:00',
	pivotTime: 1783929600,
	touched: {
		price: 1.34122,
		touchedAt: '14.07.2026 14:00',
		touchedTime: 1784030400,
	},
};
const pivot2: PivotLow = {
	type: 'low',
	price: 1.33408,
	pivotAt: '13.07.2026 23:00',
	pivotTime: 1783976400,
	touched: {
		price: 1.33408,
		touchedAt: '23.07.2026 14:00',
		touchedTime: 1784808000,
	},
};
const pivot3: PivotLow = {
	type: 'low',
	price: 1.33513,
	pivotAt: '14.07.2026 09:00',
	pivotTime: 1784012400,
	touched: {
		price: 1.33513,
		touchedAt: '23.07.2026 13:00',
		touchedTime: 1784804400,
	},
};
const pivot4: PivotHigh = {
	type: 'high',
	price: 1.34382,
	pivotAt: '14.07.2026 14:00',
	pivotTime: 1784030400,
	touched: {
		price: 1.34382,
		touchedAt: '15.07.2026 15:00',
		touchedTime: 1784120400,
	},
};
const pivot5: PivotLow = {
	type: 'low',
	price: 1.33688,
	pivotAt: '14.07.2026 19:00',
	pivotTime: 1784048400,
	touched: {
		price: 1.33688,
		touchedAt: '21.07.2026 15:00',
		touchedTime: 1784638800,
	},
};
const pivot6: PivotLow = {
	type: 'low',
	price: 1.33806,
	pivotAt: '15.07.2026 12:00',
	pivotTime: 1784109600,
	touched: {
		price: 1.33806,
		touchedAt: '21.07.2026 15:00',
		touchedTime: 1784638800,
	},
};
const pivot7: PivotHigh = {
	type: 'high',
	price: 1.35583,
	pivotAt: '15.07.2026 20:00',
	pivotTime: 1784138400,
	touched: false,
};
const pivot8: PivotLow = {
	type: 'low',
	price: 1.35206,
	pivotAt: '16.07.2026 04:00',
	pivotTime: 1784167200,
	touched: {
		price: 1.35206,
		touchedAt: '16.07.2026 10:00',
		touchedTime: 1784188800,
	},
};
const pivot9: PivotHigh = {
	type: 'high',
	price: 1.35429,
	pivotAt: '16.07.2026 09:00',
	pivotTime: 1784185200,
	touched: false,
};
const pivot10: PivotLow = {
	type: 'low',
	price: 1.34601,
	pivotAt: '16.07.2026 19:00',
	pivotTime: 1784221200,
	touched: {
		price: 1.34601,
		touchedAt: '17.07.2026 06:00',
		touchedTime: 1784260800,
	},
};
const pivot11: PivotHigh = {
	type: 'high',
	price: 1.34845,
	pivotAt: '16.07.2026 23:00',
	pivotTime: 1784235600,
	touched: false,
};
const pivot12: PivotHigh = {
	type: 'high',
	price: 1.34804,
	pivotAt: '17.07.2026 09:00',
	pivotTime: 1784271600,
	touched: {
		price: 1.34804,
		touchedAt: '20.07.2026 09:00',
		touchedTime: 1784530800,
	},
};
const pivot13: PivotLow = {
	type: 'low',
	price: 1.34245,
	pivotAt: '17.07.2026 12:00',
	pivotTime: 1784282400,
	touched: {
		price: 1.34245,
		touchedAt: '20.07.2026 17:00',
		touchedTime: 1784559600,
	},
};
const pivot14: PivotHigh = {
	type: 'high',
	price: 1.34602,
	pivotAt: '17.07.2026 22:00',
	pivotTime: 1784318400,
	touched: {
		price: 1.34602,
		touchedAt: '19.07.2026 21:00',
		touchedTime: 1784487600,
	},
};
const pivot15: PivotHigh = {
	type: 'high',
	price: 1.34542,
	pivotAt: '18.07.2026 21:00',
	pivotTime: 1784401200,
	touched: {
		price: 1.34542,
		touchedAt: '19.07.2026 16:00',
		touchedTime: 1784469600,
	},
};
const pivot16: PivotLow = {
	type: 'low',
	price: 1.34481,
	pivotAt: '19.07.2026 00:00',
	pivotTime: 1784412000,
	touched: {
		price: 1.34481,
		touchedAt: '19.07.2026 19:00',
		touchedTime: 1784480400,
	},
};
const pivot17: PivotHigh = {
	type: 'high',
	price: 1.34533,
	pivotAt: '19.07.2026 05:00',
	pivotTime: 1784430000,
	touched: {
		price: 1.34533,
		touchedAt: '19.07.2026 16:00',
		touchedTime: 1784469600,
	},
};
const pivot18: PivotHigh = {
	type: 'high',
	price: 1.34646,
	pivotAt: '19.07.2026 21:00',
	pivotTime: 1784487600,
	touched: {
		price: 1.34646,
		touchedAt: '20.07.2026 06:00',
		touchedTime: 1784520000,
	},
};
const pivot19: PivotLow = {
	type: 'low',
	price: 1.34358,
	pivotAt: '19.07.2026 22:00',
	pivotTime: 1784491200,
	touched: {
		price: 1.34358,
		touchedAt: '20.07.2026 16:00',
		touchedTime: 1784556000,
	},
};
const pivot20: PivotHigh = {
	type: 'high',
	price: 1.34804,
	pivotAt: '20.07.2026 09:00',
	pivotTime: 1784530800,
	touched: false,
};
const pivot21: PivotLow = {
	type: 'low',
	price: 1.34153,
	pivotAt: '20.07.2026 17:00',
	pivotTime: 1784559600,
	touched: {
		price: 1.34153,
		touchedAt: '21.07.2026 12:00',
		touchedTime: 1784628000,
	},
};
const pivot22: PivotHigh = {
	type: 'high',
	price: 1.34562,
	pivotAt: '21.07.2026 09:00',
	pivotTime: 1784617200,
	touched: false,
};
const pivot23: PivotLow = {
	type: 'low',
	price: 1.336,
	pivotAt: '21.07.2026 15:00',
	pivotTime: 1784638800,
	touched: {
		price: 1.336,
		touchedAt: '22.07.2026 14:00',
		touchedTime: 1784721600,
	},
};
const pivot24: PivotLow = {
	type: 'low',
	price: 1.33684,
	pivotAt: '21.07.2026 23:00',
	pivotTime: 1784667600,
	touched: {
		price: 1.33684,
		touchedAt: '22.07.2026 11:00',
		touchedTime: 1784710800,
	},
};
const pivot25: PivotHigh = {
	type: 'high',
	price: 1.33949,
	pivotAt: '22.07.2026 09:00',
	pivotTime: 1784703600,
	touched: false,
};
const pivot26: PivotLow = {
	type: 'low',
	price: 1.33553,
	pivotAt: '22.07.2026 14:00',
	pivotTime: 1784721600,
	touched: {
		price: 1.33553,
		touchedAt: '23.07.2026 13:00',
		touchedTime: 1784804400,
	},
};
const pivot27: PivotHigh = {
	type: 'high',
	price: 1.33907,
	pivotAt: '22.07.2026 16:00',
	pivotTime: 1784728800,
	touched: {
		price: 1.33907,
		touchedAt: '23.07.2026 05:00',
		touchedTime: 1784775600,
	},
};
const pivot28: PivotLow = {
	type: 'low',
	price: 1.3368,
	pivotAt: '23.07.2026 00:00',
	pivotTime: 1784757600,
	touched: {
		price: 1.3368,
		touchedAt: '23.07.2026 09:00',
		touchedTime: 1784790000,
	},
};
const pivot29: PivotHigh = {
	type: 'high',
	price: 1.33937,
	pivotAt: '23.07.2026 06:00',
	pivotTime: 1784779200,
	touched: false,
};

/** GBPUSD H1-Periode-2 Pivots (eingebettete Struktur) im selben Fenster, 13.07.2026 08:00 bis
 * 23.07.2026 17:00 — ebenfalls 1:1 aus demselben Snapshot. p2Pivot66 (1.33003, 23.07. 17:00) ist
 * der aktuell einzige innerStructurePivot und der Aufhänger für diese Datei: er liegt PREIS-
 * LICH SCHON UNTER currRange.low (1.33408/pivot2) — genau der spiegelbildliche Fall zu einem
 * Inner-High-Bruch (siehe applyInnerMarketStructurePivot in marketStructureAnalysis.ts: "NICHT
 * implementiert: der spiegelbildliche Fall (innerer Pivot bricht currRange.low)"). Aktuell landet
 * er deshalb einfach unkommentiert in innerStructurePivots (letzter return-Zweig), OHNE dass
 * irgendeine Bruch-/Sweep-/Bestätigungslogik dafür existiert — das ist die Lücke, die diese Datei
 * Schritt für Schritt mit einem "Break of Structure + Trendumkehr"-Regelwerk füllen soll. */
const p2Pivot1: PivotLow = {
	type: 'low',
	price: 1.33754,
	pivotAt: '13.07.2026 08:00',
	pivotTime: 1783922400,
	touched: {
		price: 1.33754,
		touchedAt: '13.07.2026 16:00',
		touchedTime: 1783951200,
	},
};
const p2Pivot2: PivotHigh = {
	type: 'high',
	price: 1.34122,
	pivotAt: '13.07.2026 10:00',
	pivotTime: 1783929600,
	touched: {
		price: 1.34122,
		touchedAt: '14.07.2026 14:00',
		touchedTime: 1784030400,
	},
};
const p2Pivot3: PivotLow = {
	type: 'low',
	price: 1.33823,
	pivotAt: '13.07.2026 12:00',
	pivotTime: 1783936800,
	touched: {
		price: 1.33823,
		touchedAt: '13.07.2026 16:00',
		touchedTime: 1783951200,
	},
};
const p2Pivot4: PivotHigh = {
	type: 'high',
	price: 1.34023,
	pivotAt: '13.07.2026 13:00',
	pivotTime: 1783940400,
	touched: {
		price: 1.34023,
		touchedAt: '14.07.2026 14:00',
		touchedTime: 1784030400,
	},
};
const p2Pivot5: PivotLow = {
	type: 'low',
	price: 1.33408,
	pivotAt: '13.07.2026 23:00',
	pivotTime: 1783976400,
	touched: {
		price: 1.33408,
		touchedAt: '23.07.2026 14:00',
		touchedTime: 1784808000,
	},
};
const p2Pivot6: PivotLow = {
	type: 'low',
	price: 1.33435,
	pivotAt: '14.07.2026 02:00',
	pivotTime: 1783987200,
	touched: {
		price: 1.33435,
		touchedAt: '23.07.2026 13:00',
		touchedTime: 1784804400,
	},
};
const p2Pivot7: PivotHigh = {
	type: 'high',
	price: 1.33697,
	pivotAt: '14.07.2026 07:00',
	pivotTime: 1784005200,
	touched: {
		price: 1.33697,
		touchedAt: '14.07.2026 10:00',
		touchedTime: 1784016000,
	},
};
const p2Pivot8: PivotLow = {
	type: 'low',
	price: 1.33513,
	pivotAt: '14.07.2026 09:00',
	pivotTime: 1784012400,
	touched: {
		price: 1.33513,
		touchedAt: '23.07.2026 13:00',
		touchedTime: 1784804400,
	},
};
const p2Pivot9: PivotLow = {
	type: 'low',
	price: 1.33669,
	pivotAt: '14.07.2026 13:00',
	pivotTime: 1784026800,
	touched: {
		price: 1.33669,
		touchedAt: '21.07.2026 15:00',
		touchedTime: 1784638800,
	},
};
const p2Pivot10: PivotHigh = {
	type: 'high',
	price: 1.34382,
	pivotAt: '14.07.2026 14:00',
	pivotTime: 1784030400,
	touched: {
		price: 1.34382,
		touchedAt: '15.07.2026 15:00',
		touchedTime: 1784120400,
	},
};
const p2Pivot11: PivotLow = {
	type: 'low',
	price: 1.33688,
	pivotAt: '14.07.2026 19:00',
	pivotTime: 1784048400,
	touched: {
		price: 1.33688,
		touchedAt: '21.07.2026 15:00',
		touchedTime: 1784638800,
	},
};
const p2Pivot12: PivotLow = {
	type: 'low',
	price: 1.33784,
	pivotAt: '14.07.2026 23:00',
	pivotTime: 1784062800,
	touched: {
		price: 1.33784,
		touchedAt: '21.07.2026 15:00',
		touchedTime: 1784638800,
	},
};
const p2Pivot13: PivotHigh = {
	type: 'high',
	price: 1.34099,
	pivotAt: '15.07.2026 04:00',
	pivotTime: 1784080800,
	touched: {
		price: 1.34099,
		touchedAt: '15.07.2026 07:00',
		touchedTime: 1784091600,
	},
};
const p2Pivot14: PivotLow = {
	type: 'low',
	price: 1.3399,
	pivotAt: '15.07.2026 05:00',
	pivotTime: 1784084400,
	touched: {
		price: 1.3399,
		touchedAt: '15.07.2026 10:00',
		touchedTime: 1784102400,
	},
};
const p2Pivot15: PivotHigh = {
	type: 'high',
	price: 1.34203,
	pivotAt: '15.07.2026 09:00',
	pivotTime: 1784098800,
	touched: {
		price: 1.34203,
		touchedAt: '15.07.2026 14:00',
		touchedTime: 1784116800,
	},
};
const p2Pivot16: PivotLow = {
	type: 'low',
	price: 1.33806,
	pivotAt: '15.07.2026 12:00',
	pivotTime: 1784109600,
	touched: {
		price: 1.33806,
		touchedAt: '21.07.2026 15:00',
		touchedTime: 1784638800,
	},
};
const p2Pivot17: PivotHigh = {
	type: 'high',
	price: 1.35583,
	pivotAt: '15.07.2026 20:00',
	pivotTime: 1784138400,
	touched: false,
};
const p2Pivot18: PivotHigh = {
	type: 'high',
	price: 1.3546,
	pivotAt: '15.07.2026 23:00',
	pivotTime: 1784149200,
	touched: false,
};
const p2Pivot19: PivotLow = {
	type: 'low',
	price: 1.3521,
	pivotAt: '15.07.2026 23:00',
	pivotTime: 1784149200,
	touched: {
		price: 1.3521,
		touchedAt: '16.07.2026 04:00',
		touchedTime: 1784167200,
	},
};
const p2Pivot20: PivotHigh = {
	type: 'high',
	price: 1.35448,
	pivotAt: '16.07.2026 02:00',
	pivotTime: 1784160000,
	touched: false,
};
const p2Pivot21: PivotLow = {
	type: 'low',
	price: 1.35206,
	pivotAt: '16.07.2026 04:00',
	pivotTime: 1784167200,
	touched: {
		price: 1.35206,
		touchedAt: '16.07.2026 10:00',
		touchedTime: 1784188800,
	},
};
const p2Pivot22: PivotHigh = {
	type: 'high',
	price: 1.35429,
	pivotAt: '16.07.2026 09:00',
	pivotTime: 1784185200,
	touched: false,
};
const p2Pivot23: PivotLow = {
	type: 'low',
	price: 1.34949,
	pivotAt: '16.07.2026 13:00',
	pivotTime: 1784199600,
	touched: {
		price: 1.34949,
		touchedAt: '16.07.2026 16:00',
		touchedTime: 1784210400,
	},
};
const p2Pivot24: PivotHigh = {
	type: 'high',
	price: 1.35178,
	pivotAt: '16.07.2026 15:00',
	pivotTime: 1784206800,
	touched: false,
};
const p2Pivot25: PivotLow = {
	type: 'low',
	price: 1.34601,
	pivotAt: '16.07.2026 19:00',
	pivotTime: 1784221200,
	touched: {
		price: 1.34601,
		touchedAt: '17.07.2026 06:00',
		touchedTime: 1784260800,
	},
};
const p2Pivot26: PivotHigh = {
	type: 'high',
	price: 1.34845,
	pivotAt: '16.07.2026 23:00',
	pivotTime: 1784235600,
	touched: false,
};
const p2Pivot27: PivotHigh = {
	type: 'high',
	price: 1.34808,
	pivotAt: '17.07.2026 03:00',
	pivotTime: 1784250000,
	touched: false,
};
const p2Pivot28: PivotLow = {
	type: 'low',
	price: 1.34573,
	pivotAt: '17.07.2026 06:00',
	pivotTime: 1784260800,
	touched: {
		price: 1.34573,
		touchedAt: '17.07.2026 10:00',
		touchedTime: 1784275200,
	},
};
const p2Pivot29: PivotHigh = {
	type: 'high',
	price: 1.34804,
	pivotAt: '17.07.2026 09:00',
	pivotTime: 1784271600,
	touched: {
		price: 1.34804,
		touchedAt: '20.07.2026 09:00',
		touchedTime: 1784530800,
	},
};
const p2Pivot30: PivotLow = {
	type: 'low',
	price: 1.34245,
	pivotAt: '17.07.2026 12:00',
	pivotTime: 1784282400,
	touched: {
		price: 1.34245,
		touchedAt: '20.07.2026 17:00',
		touchedTime: 1784559600,
	},
};
const p2Pivot31: PivotLow = {
	type: 'low',
	price: 1.34389,
	pivotAt: '17.07.2026 18:00',
	pivotTime: 1784304000,
	touched: {
		price: 1.34389,
		touchedAt: '19.07.2026 22:00',
		touchedTime: 1784491200,
	},
};
const p2Pivot32: PivotHigh = {
	type: 'high',
	price: 1.34601,
	pivotAt: '17.07.2026 19:00',
	pivotTime: 1784307600,
	touched: {
		price: 1.34601,
		touchedAt: '17.07.2026 22:00',
		touchedTime: 1784318400,
	},
};
const p2Pivot33: PivotHigh = {
	type: 'high',
	price: 1.34602,
	pivotAt: '17.07.2026 22:00',
	pivotTime: 1784318400,
	touched: {
		price: 1.34602,
		touchedAt: '19.07.2026 21:00',
		touchedTime: 1784487600,
	},
};
const p2Pivot34: PivotLow = {
	type: 'low',
	price: 1.34469,
	pivotAt: '17.07.2026 23:00',
	pivotTime: 1784322000,
	touched: {
		price: 1.34469,
		touchedAt: '19.07.2026 19:00',
		touchedTime: 1784480400,
	},
};
const p2Pivot35: PivotLow = {
	type: 'low',
	price: 1.34506,
	pivotAt: '18.07.2026 07:00',
	pivotTime: 1784350800,
	touched: {
		price: 1.34506,
		touchedAt: '18.07.2026 13:00',
		touchedTime: 1784372400,
	},
};
const p2Pivot36: PivotHigh = {
	type: 'high',
	price: 1.34534,
	pivotAt: '18.07.2026 11:00',
	pivotTime: 1784365200,
	touched: {
		price: 1.34534,
		touchedAt: '18.07.2026 15:00',
		touchedTime: 1784379600,
	},
};
const p2Pivot37: PivotLow = {
	type: 'low',
	price: 1.34504,
	pivotAt: '18.07.2026 13:00',
	pivotTime: 1784372400,
	touched: {
		price: 1.34504,
		touchedAt: '18.07.2026 18:00',
		touchedTime: 1784390400,
	},
};
const p2Pivot38: PivotHigh = {
	type: 'high',
	price: 1.34534,
	pivotAt: '18.07.2026 15:00',
	pivotTime: 1784379600,
	touched: {
		price: 1.34534,
		touchedAt: '18.07.2026 18:00',
		touchedTime: 1784390400,
	},
};
const p2Pivot39: PivotHigh = {
	type: 'high',
	price: 1.34542,
	pivotAt: '18.07.2026 21:00',
	pivotTime: 1784401200,
	touched: {
		price: 1.34542,
		touchedAt: '19.07.2026 16:00',
		touchedTime: 1784469600,
	},
};
const p2Pivot40: PivotLow = {
	type: 'low',
	price: 1.34481,
	pivotAt: '19.07.2026 00:00',
	pivotTime: 1784412000,
	touched: {
		price: 1.34481,
		touchedAt: '19.07.2026 19:00',
		touchedTime: 1784480400,
	},
};
const p2Pivot41: PivotHigh = {
	type: 'high',
	price: 1.34533,
	pivotAt: '19.07.2026 05:00',
	pivotTime: 1784430000,
	touched: {
		price: 1.34533,
		touchedAt: '19.07.2026 16:00',
		touchedTime: 1784469600,
	},
};
const p2Pivot42: PivotLow = {
	type: 'low',
	price: 1.34512,
	pivotAt: '19.07.2026 09:00',
	pivotTime: 1784444400,
	touched: {
		price: 1.34512,
		touchedAt: '19.07.2026 13:00',
		touchedTime: 1784458800,
	},
};
const p2Pivot43: PivotHigh = {
	type: 'high',
	price: 1.34529,
	pivotAt: '19.07.2026 11:00',
	pivotTime: 1784451600,
	touched: {
		price: 1.34529,
		touchedAt: '19.07.2026 15:00',
		touchedTime: 1784466000,
	},
};
const p2Pivot44: PivotHigh = {
	type: 'high',
	price: 1.34646,
	pivotAt: '19.07.2026 21:00',
	pivotTime: 1784487600,
	touched: {
		price: 1.34646,
		touchedAt: '20.07.2026 06:00',
		touchedTime: 1784520000,
	},
};
const p2Pivot45: PivotLow = {
	type: 'low',
	price: 1.34358,
	pivotAt: '19.07.2026 22:00',
	pivotTime: 1784491200,
	touched: {
		price: 1.34358,
		touchedAt: '20.07.2026 16:00',
		touchedTime: 1784556000,
	},
};
const p2Pivot46: PivotHigh = {
	type: 'high',
	price: 1.34804,
	pivotAt: '20.07.2026 09:00',
	pivotTime: 1784530800,
	touched: false,
};
const p2Pivot47: PivotLow = {
	type: 'low',
	price: 1.34567,
	pivotAt: '20.07.2026 09:00',
	pivotTime: 1784530800,
	touched: {
		price: 1.34567,
		touchedAt: '20.07.2026 14:00',
		touchedTime: 1784548800,
	},
};
const p2Pivot48: PivotHigh = {
	type: 'high',
	price: 1.34765,
	pivotAt: '20.07.2026 13:00',
	pivotTime: 1784545200,
	touched: false,
};
const p2Pivot49: PivotLow = {
	type: 'low',
	price: 1.34153,
	pivotAt: '20.07.2026 17:00',
	pivotTime: 1784559600,
	touched: {
		price: 1.34153,
		touchedAt: '21.07.2026 12:00',
		touchedTime: 1784628000,
	},
};
const p2Pivot50: PivotHigh = {
	type: 'high',
	price: 1.34397,
	pivotAt: '20.07.2026 20:00',
	pivotTime: 1784570400,
	touched: {
		price: 1.34397,
		touchedAt: '21.07.2026 05:00',
		touchedTime: 1784602800,
	},
};
const p2Pivot51: PivotLow = {
	type: 'low',
	price: 1.34223,
	pivotAt: '21.07.2026 00:00',
	pivotTime: 1784584800,
	touched: {
		price: 1.34223,
		touchedAt: '21.07.2026 12:00',
		touchedTime: 1784628000,
	},
};
const p2Pivot52: PivotLow = {
	type: 'low',
	price: 1.34302,
	pivotAt: '21.07.2026 05:00',
	pivotTime: 1784602800,
	touched: {
		price: 1.34302,
		touchedAt: '21.07.2026 10:00',
		touchedTime: 1784620800,
	},
};
const p2Pivot53: PivotHigh = {
	type: 'high',
	price: 1.34562,
	pivotAt: '21.07.2026 09:00',
	pivotTime: 1784617200,
	touched: false,
};
const p2Pivot54: PivotLow = {
	type: 'low',
	price: 1.336,
	pivotAt: '21.07.2026 15:00',
	pivotTime: 1784638800,
	touched: {
		price: 1.336,
		touchedAt: '22.07.2026 14:00',
		touchedTime: 1784721600,
	},
};
const p2Pivot55: PivotHigh = {
	type: 'high',
	price: 1.33875,
	pivotAt: '21.07.2026 19:00',
	pivotTime: 1784653200,
	touched: {
		price: 1.33875,
		touchedAt: '22.07.2026 03:00',
		touchedTime: 1784682000,
	},
};
const p2Pivot56: PivotLow = {
	type: 'low',
	price: 1.33684,
	pivotAt: '21.07.2026 23:00',
	pivotTime: 1784667600,
	touched: {
		price: 1.33684,
		touchedAt: '22.07.2026 11:00',
		touchedTime: 1784710800,
	},
};
const p2Pivot57: PivotHigh = {
	type: 'high',
	price: 1.33892,
	pivotAt: '22.07.2026 04:00',
	pivotTime: 1784685600,
	touched: {
		price: 1.33892,
		touchedAt: '22.07.2026 08:00',
		touchedTime: 1784700000,
	},
};
const p2Pivot58: PivotLow = {
	type: 'low',
	price: 1.33701,
	pivotAt: '22.07.2026 08:00',
	pivotTime: 1784700000,
	touched: {
		price: 1.33701,
		touchedAt: '22.07.2026 11:00',
		touchedTime: 1784710800,
	},
};
const p2Pivot59: PivotHigh = {
	type: 'high',
	price: 1.33949,
	pivotAt: '22.07.2026 09:00',
	pivotTime: 1784703600,
	touched: false,
};
const p2Pivot60: PivotLow = {
	type: 'low',
	price: 1.33553,
	pivotAt: '22.07.2026 14:00',
	pivotTime: 1784721600,
	touched: {
		price: 1.33553,
		touchedAt: '23.07.2026 13:00',
		touchedTime: 1784804400,
	},
};
const p2Pivot61: PivotHigh = {
	type: 'high',
	price: 1.33907,
	pivotAt: '22.07.2026 16:00',
	pivotTime: 1784728800,
	touched: {
		price: 1.33907,
		touchedAt: '23.07.2026 05:00',
		touchedTime: 1784775600,
	},
};
const p2Pivot62: PivotLow = {
	type: 'low',
	price: 1.33661,
	pivotAt: '22.07.2026 18:00',
	pivotTime: 1784736000,
	touched: {
		price: 1.33661,
		touchedAt: '23.07.2026 10:00',
		touchedTime: 1784793600,
	},
};
const p2Pivot63: PivotHigh = {
	type: 'high',
	price: 1.33789,
	pivotAt: '22.07.2026 23:00',
	pivotTime: 1784754000,
	touched: {
		price: 1.33789,
		touchedAt: '23.07.2026 02:00',
		touchedTime: 1784764800,
	},
};
const p2Pivot64: PivotLow = {
	type: 'low',
	price: 1.3368,
	pivotAt: '23.07.2026 00:00',
	pivotTime: 1784757600,
	touched: {
		price: 1.3368,
		touchedAt: '23.07.2026 09:00',
		touchedTime: 1784790000,
	},
};
const p2Pivot65: PivotHigh = {
	type: 'high',
	price: 1.33937,
	pivotAt: '23.07.2026 06:00',
	pivotTime: 1784779200,
	touched: false,
};
const p2Pivot66: PivotLow = {
	type: 'low',
	price: 1.33003,
	pivotAt: '23.07.2026 17:00',
	pivotTime: 1784818800,
	touched: false,
};

/**
 * Zwischenstand VOR dem Break of Structure, 21.07.2026 14:00 — mehrere Tage vor rangeStateCurrent/
 * rangeStateAfterBreak unten, extra weit zurückgespult, weil der BOS selbst zeitlich VOR der
 * eigentlichen Trendumkehr passiert (Philip: "vorher passiert nämlich ein Break of Structure des
 * 1h-uptrends"). touched-Felder zeigen bewusst den Stand ZU DIESEM ZEITPUNKT, nicht den globalen
 * Fixture-Endstand (gleiches Muster wie rangeState1 in gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts) —
 * z.B. ist pivot3 hier noch `touched:false`, obwohl es global irgendwann (23.07.) getoucht wird.
 *
 * pivot6 (1.33806) ist hier bereits `protected-low` — der Rolling-Fix vom 2026-07-23 hat es
 * korrekt dorthin nachgezogen (jüngster ungetouchter Pullback zum jeweiligen Bestätigungsmoment).
 * GENAU DIESES protected-low ist der Aufhänger für den Break of Structure unten. pivot21 ist schon
 * `LQ-sweep` (getoucht, aber zu diesem Zeitpunkt noch keine Kerze drunter geschlossen).
 */
const stateBeforeBOS: MarketStructureState = {
	trend: 'uptrend',
	currRange: {
		high: pivot7,
		low: { ...pivot2, touched: false },
	},
	structurePivots: [
		{ ...pivot3, touched: false },
		{ ...pivot5, touched: false },
		{ ...pivot6, type: 'protected-low', touched: false },
		pivot7,
		pivot8,
		pivot9,
		pivot10,
		pivot11,
		pivot12,
		pivot13,
		pivot14,
		pivot15,
		pivot16,
		pivot17,
		pivot18,
		pivot19,
		pivot20,
		{ ...pivot21, type: 'LQ-sweep' },
		pivot22,
	],
	innerStructurePivots: [],
	appliedPivots: [
		pivot1,
		{ ...pivot2, touched: false },
		{ ...pivot3, touched: false },
		pivot4,
		{ ...pivot5, touched: false },
		{ ...pivot6, touched: false }, // appliedPivots hält immer den ROHEN Typ, nie 'protected-low'
		pivot7,
		pivot8,
		pivot9,
		pivot10,
		pivot11,
		pivot12,
		pivot13,
		pivot14,
		pivot15,
		pivot16,
		pivot17,
		pivot18,
		pivot19,
		pivot20,
		pivot21, // appliedPivots hält immer den ROHEN Typ, nie 'LQ-sweep'
		pivot22,
	],
};

/** Echte 1H-Kerzen zwischen pivot6 (15.07. 12:00) und p2Pivot55 (21.07. 19:00) — genauer: die
 * paar Kerzen um pivot23 (21.07. 15:00) herum, das reicht für closesBelowLevel. 12:00/13:00 UTC
 * schließen noch knapp ÜBER 1.33806 (pivot6), ab 14:00 UTC (1.33708) klar drunter. */
const candlesAroundBOS: Candle[] = [
	{ time: 1784635200, open: 1.34047, high: 1.34072, low: 1.33837, close: 1.33914 },
	{ time: 1784638800, open: 1.33908, high: 1.33962, low: 1.336, close: 1.3381 },
	{ time: 1784642400, open: 1.33807, high: 1.33991, low: 1.33655, close: 1.33708 },
	{ time: 1784646000, open: 1.33698, high: 1.33805, low: 1.33693, close: 1.33724 },
];

/**
 * Zwischenstand NACH dem bestätigten Break of Structure — AUSGEFÜLLT + GEGENGECHECKT (Claude,
 * 2026-07-24): tatsächlich `applyMarketStructurePivot(stateBeforeBOS, pivot23)` gefolgt von
 * `applyInnerMarketStructurePivot(..., p2Pivot55, { candles: candlesAroundBOS })` laufen lassen
 * (nicht von Hand hergeleitet). p2Pivot55 selbst bricht nichts (1.33875 liegt innerhalb der
 * Range) — sein einziger Zweck hier ist, markLqSweeps mit einem `toTime` NACH dem echten
 * Close-drunter (14:00 UTC) auszulösen, das pivot23 alleine (13:00 UTC, Close noch drüber) noch
 * nicht hätte sehen können.
 *
 * KORREKTUR (Claude, Bug-Report Philip 2026-07-24: "sehe kein BOS bei Replay 21.07. 20:00"):
 * p2Pivot55 selbst hat pivotTime 21.07. 19:00 (Anzeige, = 17:00 UTC), wird aber wegen der
 * Periode-2-Bestätigungsverzögerung (+2h, siehe confirmationTime in PriceChart.vue) erst ab
 * 19:00 UTC = **21:00 Berlin** überhaupt gelesen — NICHT schon um 19:00 Berlin, wie der Name
 * suggeriert. Dieser State wird im echten Replay also erst ab ~21:00 Uhr sichtbar, nicht früher.
 *
 * Ergebnis, exakt wie von Philip beschrieben:
 * - trend: 'uptrend' — UNVERÄNDERT, kein Reset (anders als bei der Trendumkehr in
 *   rangeStateAfterBreak unten — dort bricht currRange.low SELBST, hier nur ein protected-low
 *   INNERHALB der Range)
 * - currRange: unverändert (high=pivot7, low=pivot2)
 * - pivot6 wird 'break-of-structure' (statt nur 'low', weil es vorher 'protected-low' war —
 *   siehe markLqSweeps in marketStructureAnalysis.ts)
 * - pivot21 bleibt unabhängig davon weiterhin 'LQ-sweep' (kein Close je drunter geschlossen)
 * - pivot23 landet ganz normal als 'low' in structurePivots/appliedPivots (kein Sonderfall für
 *   sich selbst, es ist ja nur der AUSLÖSER für den Bruch von pivot6)
 * - innerStructurePivots: [p2Pivot55] (unverändert vom Aufruf, kein Reset)
 */
const rangeStateAfterBOS: MarketStructureState = {
	trend: 'uptrend',
	currRange: {
		high: pivot7,
		low: pivot2,
	},
	structurePivots: [
		pivot3,
		pivot5,
		{ ...pivot6, type: 'break-of-structure' },
		pivot7,
		pivot8,
		pivot9,
		pivot10,
		pivot11,
		pivot12,
		pivot13,
		pivot14,
		pivot15,
		pivot16,
		pivot17,
		pivot18,
		pivot19,
		pivot20,
		{ ...pivot21, type: 'LQ-sweep' },
		pivot22,
		pivot23,
	],
	innerStructurePivots: [p2Pivot55],
	appliedPivots: [
		pivot1,
		pivot2,
		pivot3,
		pivot4,
		pivot5,
		pivot6,
		pivot7,
		pivot8,
		pivot9,
		pivot10,
		pivot11,
		pivot12,
		pivot13,
		pivot14,
		pivot15,
		pivot16,
		pivot17,
		pivot18,
		pivot19,
		pivot20,
		pivot21,
		pivot22,
		pivot23,
	],
};

/**
 * LOS GEHTS
 * Aktueller Live-Stand (23.07.2026, ~21:47), 1:1 aus dem State-Panel kopiert — kein von Hand
 * hergeleiteter Zwischenschritt wie in den anderen TDD-Dateien, sondern der tatsächliche
 * Algorithmus-Output an genau diesem Snapshot-Zeitpunkt. Dient hier als STARTPUNKT für alles
 * Weitere, nicht als zu verifizierendes Ergebnis.
 *
 * trend: 'uptrend' (bestätigt, aktuell mit protected-low-Kandidat siehe pivot3 unten NICHT
 * markiert — zum jeweiligen Bestätigungsmoment gab es dafür jüngere Kandidaten, siehe
 * tryConfirmUptrend-Regeln in marketStructureAnalysis.rules.md).
 *
 * pivot7 (1.35583) taucht bewusst SOWOHL in currRange.high ALS AUCH in structurePivots auf —
 * kein Kopierfehler: p2Pivot17 (Periode 2, 2h-Bestätigungsverzug) hat exakt denselben Extremwert
 * bereits FRÜHER bestätigt und currRange.high daraufhin gesetzt (siehe applyInnerMarketStructure-
 * Pivot); als pivot7 (Periode 5, 5h-Bestätigungsverzug) danach mit identischem Preis eintrifft,
 * ist die `pivot.price > currRange.high.price`-Prüfung in applyMarketStructurePivot NICHT mehr
 * erfüllt (gleich, nicht größer) -> es fällt in den generischen Pullback-Zweig und landet
 * zusätzlich in structurePivots. Eine bereits vorher bestehende Eigenheit des Algorithmus, keine
 * neue — hier einfach wahrheitsgetreu übernommen.
 *
 * DIE EIGENTLICHE LÜCKE für diese Datei: p2Pivot66 (1.33003, 23.07. 17:00) liegt bereits UNTER
 * currRange.low (1.33408) — landet aktuell trotzdem nur als stinknormaler Pullback in
 * innerStructurePivots, weil applyInnerMarketStructurePivot für "innerer Pivot bricht
 * currRange.low" schlicht keine Regel hat (siehe Kommentar dort: "NICHT implementiert: der
 * spiegelbildliche Fall"). Genau hier soll das Break-of-Structure/Trendumkehr-Regelwerk ansetzen.
 */
const rangeStateCurrent: MarketStructureState = {
	trend: 'uptrend',
	currRange: {
		high: pivot7,
		low: pivot2,
	},
	structurePivots: [
		pivot3,
		pivot5,
		pivot6,
		pivot7,
		pivot8,
		pivot9,
		pivot10,
		pivot11,
		pivot12,
		pivot13,
		pivot14,
		pivot15,
		pivot16,
		pivot17,
		pivot18,
		pivot19,
		pivot20,
		pivot21,
		pivot22,
		pivot23,
		pivot24,
		pivot25,
		pivot26,
		pivot27,
		pivot28,
		pivot29,
	],
	innerStructurePivots: [p2Pivot66],
	appliedPivots: [
		pivot1,
		pivot2,
		pivot3,
		pivot4,
		pivot5,
		pivot6,
		pivot7,
		pivot8,
		pivot9,
		pivot10,
		pivot11,
		pivot12,
		pivot13,
		pivot14,
		pivot15,
		pivot16,
		pivot17,
		pivot18,
		pivot19,
		pivot20,
		pivot21,
		pivot22,
		pivot23,
		pivot24,
		pivot25,
		pivot26,
		pivot27,
		pivot28,
		pivot29,
	],
};

/** Echte 1H-Kerzen zwischen currRange.low (pivot2, 13.07. 23:00) und p2Pivot66 (23.07. 17:00) —
 * genauer: die letzten 5 vor/um p2Pivot66 herum, das reicht für closesBelowLevel (braucht nur
 * IRGENDEINE Kerze im Fenster, die drunter schließt). Aus demselben Live-Snapshot wie die Pivots
 * oben (forex-candles/Twelve Data, UTC-Zeitstempel). Erste Kerze (11:00 UTC) schließt noch über
 * currRange.low (1.33562 > 1.33408), ab 13:00 UTC (1.33306) schließt es klar drunter — kein
 * bloßer Docht mehr. */
const candlesAroundBreak: Candle[] = [
	{
		time: 1784804400,
		open: 1.33679,
		high: 1.33688,
		low: 1.33424,
		close: 1.33562,
	},
	{
		time: 1784808000,
		open: 1.33559,
		high: 1.33565,
		low: 1.33356,
		close: 1.33441,
	},
	{
		time: 1784811600,
		open: 1.33434,
		high: 1.33456,
		low: 1.33262,
		close: 1.33306,
	},
	{
		time: 1784815200,
		open: 1.33325,
		high: 1.33325,
		low: 1.33127,
		close: 1.33182,
	},
	{
		time: 1784818800,
		open: 1.33169,
		high: 1.33237,
		low: 1.33003,
		close: 1.33103,
	},
];

/**
 * AUSGEFÜLLT + GEGENGECHECKT (Claude, 2026-07-24): tatsächlich
 * `applyInnerMarketStructurePivot(rangeStateCurrent, p2Pivot66, { candles: candlesAroundBreak })`
 * laufen lassen (nicht von Hand hergeleitet) — Ergebnis ist genau das, was Philip beschrieben hat:
 * - trend: 'unknown' (der Uptrend ist komplett invalidiert, kein direkter Sprung zu 'downtrend')
 * - currRange.high bleibt pivot7 (1.35583) — WEITERVERWENDET, nicht verworfen
 * - currRange.low wird p2Pivot66 (1.33003) — der brechende Pivot selbst
 * - High (15.07.) liegt zeitlich VOR Low (23.07.) -> gespiegelte, bärische Origin-Konstellation
 *   (Uptrend bräuchte High NACH Low; hier ist es umgekehrt)
 * - structurePivots/innerStructurePivots: komplett leer — der Algo fängt wirklich von vorne an
 * - appliedPivots: nur noch die zwei neuen Origin-Pivots, die 29 alten sind weg
 *
 * NICHT Teil dieser Datei: die eigentliche Downtrend-BESTÄTIGUNG (ein "protected-high" als
 * Pendant zum protected-low, siehe marketStructureAnalysis.rules.md) — dafür braucht es erst
 * eine neue bestätigende Struktur NACH diesem Reset, die es zum Zeitpunkt des Snapshots noch
 * nicht gibt ("Bildet sich nächste Woche eine Bestätigung des downtrends...", Philip).
 */
const rangeStateAfterBreak: MarketStructureState = {
	trend: 'unknown',
	currRange: {
		high: pivot7,
		low: { ...p2Pivot66, type: 'low' },
	},
	structurePivots: [],
	innerStructurePivots: [],
	appliedPivots: [pivot7, { ...p2Pivot66, type: 'low' }],
};
