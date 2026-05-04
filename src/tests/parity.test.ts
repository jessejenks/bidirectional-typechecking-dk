import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as hm from "../hm";
import * as paper from "../paperDK";
import * as stratified from "../stratifiedDK";
import { Result } from "../utils/result";
import { getTraceHandlers, traceToNames } from "../utils/traces";
import { areTypesStructurallyEqual, areTypesStructurallyEqualHM } from "./utils";

const runPaperSynthesis = (expr: paper.ast.Expression) => {
	const context = new paper.context.Context(false);
	const { onStartTrace, onEndTrace, onLeafTrace, getTrace } = getTraceHandlers();
	context.onStartTrace = onStartTrace;
	context.onEndTrace = onEndTrace;
	context.onLeafTrace = onLeafTrace;

	return Result.elim(
		paper.dk.synthesize(context, expr),
		({ type, ctx }) => {
			const appliedType = ctx.apply(type);
			return { type: appliedType, trace: getTrace() };
		},
		assert.fail,
	);
};

const runStratifiedSynthesis = (surfaceExpr: stratified.surface.Expression) => {
	const checker = new stratified.dk.TypeChecker(false);
	const { onStartTrace, onEndTrace, onLeafTrace, getTrace } = getTraceHandlers();
	checker.onStartTrace = onStartTrace;
	checker.onEndTrace = onEndTrace;
	checker.onLeafTrace = onLeafTrace;

	return Result.elim(
		checker.synthesize(stratified.elaborator.elaborate(surfaceExpr)),
		(type) => {
			const appliedType = checker.apply(type);
			return { type: appliedType, trace: getTrace() };
		},
		assert.fail,
	);
};

describe("compare DK implementations", () => {
	const okCases: string[] = [
		"()",
		"1",
		"1 + 2 + 3",
		"λx.x",
		"λx.λy.x",
		"(λx.x) 1",
		"(λx.x) (λy.y)",
		"((λx.x) : ∀α.α → α) (λy.y)",
		"(λx.x) ((λy.y) : Int → Int)",
		"(λx.x x) : (∀α.α → α) → (∀α.α → α)",
		"(λx:(∀α.α → α).x x) (λy.y)",
		"let id : ∀α.α → α = (λx.x) in <id 1, id ()>",
		"λf.f 1",
		"(λf.f 1) (λx.x + 1)",
		"((λx:Int.x) : Int → Int)",
		"((λx:(∀α.α → α).x 1) : (∀α.α → α) → Int)",
		"((<1, ()>) : Int × Unit)",
		"((λx.x) : Int × Unit → Int × Unit)",
		"λx.x + 1",
		"(λx.x) (λf:(∀α.α → α) → Int.f (λx.x))",
		"let x = ((<1, λx.x>) : Int × ∀α.α → α) in (λy.y) x",
		"(λx.x) (λp:(∀α.α → α) × Int.1)",
		"(λx.x) : ∀α.α → α",
		"fst(<1, ()>)",
		"(fst(<1, ()>)) : Int",
		"snd(<1, ()>)",
		"(snd(<1, ()>)) : Unit",
		"λx.fst(x)",
	];
	okCases.forEach((input) =>
		it(`handles "${input}"`, () => {
			const { type: paperType, trace: paperTrace } = Result.elim(paper.parser.parse(input), runPaperSynthesis, assert.fail);
			const { type: stratifiedType, trace: stratifiedTrace } = Result.elim(
				stratified.parser.parse(input),
				runStratifiedSynthesis,
				assert.fail,
			);
			if (!areTypesStructurallyEqual(paperType, stratifiedType)) {
				assert.fail("types were not structurally similar");
			}
			const paperTypeGeneralized = paper.ast.generalize(paperType);
			const stratifiedTypeGeneralized = stratified.core.generalize(stratifiedType);
			if (!areTypesStructurallyEqual(paperTypeGeneralized, stratifiedTypeGeneralized)) {
				assert.fail("generalized types were not structurally similar");
			}
			const paperTypeMiniscoped = paper.ast.miniscope(paperTypeGeneralized);
			const stratifiedTypeMiniscoped = stratified.core.miniscope(stratifiedTypeGeneralized);
			if (!areTypesStructurallyEqual(paperTypeMiniscoped, stratifiedTypeMiniscoped)) {
				assert.fail("miniscoped types were not structurally similar");
			}
			assert.strictEqual(traceToNames(paperTrace), traceToNames(stratifiedTrace));
		}),
	);

	const errCases: string[] = [
		"1 + ()",
		"((1) : Unit)",
		"((λx.x) : Int → Unit)",
		"(λx.x) (λf:∀α.α → α.f)", // can't solve existential to universal
		"(λx.x x)", // Omega term, only type-able with higher rank type
	];
	errCases.forEach((input) =>
		it(`rejects "${input}"`, () => {
			const paperExpr = Result.elim(
				paper.parser.parse(input),
				(e) => e,
				() => assert.fail("paper parse failed"),
			);
			const stratifiedExpr = Result.elim(
				stratified.parser.parse(input),
				(e) => e,
				() => assert.fail("stratified parse failed"),
			);

			const paperCtx = new paper.context.Context(false);
			const paperResult = paper.dk.synthesize(paperCtx, paperExpr);
			assert.ok(Result.isErr(paperResult), "paper should reject");

			const checker = new stratified.dk.TypeChecker(false);
			const stratifiedResult = checker.synthesize(stratified.elaborator.elaborate(stratifiedExpr));
			assert.ok(Result.isErr(stratifiedResult), "stratified should reject");
		}),
	);
});

const runHMInference = (surfaceExpr: hm.surface.Expression) => {
	const checker = new hm.hm.TypeChecker(false);
	const { onStartTrace, onEndTrace, onLeafTrace, getTrace } = hm.traces.getTraceHandlers();
	checker.onStartTrace = onStartTrace;
	checker.onEndTrace = onEndTrace;
	checker.onLeafTrace = onLeafTrace;

	return Result.elim(checker.infer(hm.elaborator.elaborate(surfaceExpr)), (type) => ({ type, trace: getTrace() }), assert.fail);
};

describe("compare DK vs HM implementations", () => {
	const okCases: ([string] | [string, string])[] = [
		["()"],
		["1"],
		["1 + 2 + 3"],
		["λx.x"],
		["λx.λy.x"],
		["(λx.x) 1"],
		["(λx.x) ()"],
		["(λx.x) (λy.y)"],
		["let id = (λx.x) in <id 1, id ()>", "let id : ∀α.α → α = (λx.x) in <id 1, id ()>"],
		["fst(<1, ()>)"],
		["snd(<1, ()>)"],
	];
	okCases.forEach(([input, paperInput]) =>
		it(`handles "${input}"`, () => {
			const { type: paperType } = Result.elim(paper.parser.parse(paperInput ?? input), runPaperSynthesis, assert.fail);
			const { type: hmType } = Result.elim(hm.parser.parse(input), runHMInference, assert.fail);
			if (!areTypesStructurallyEqualHM(paper.ast.generalize(paperType), hmType)) {
				assert.fail("types were not structurally similar");
			}
		}),
	);
});
