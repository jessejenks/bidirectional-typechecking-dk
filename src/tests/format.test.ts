import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as hm from "../hm";
import * as paper from "../paperDK";
import * as stratified from "../stratifiedDK";
import { Result } from "../utils/result";
import { areHMSurfaceExpressionsStructurallyEqual, areStratifiedSurfaceExpressionsStructurallyEqual } from "./utils";

describe("roundtrip through formatting", () => {
	const testCases: string[] = [
		"()",
		"(()) : Unit",
		"1 + 2 + 3",
		"(1 + 2 + 3) : Int",
		"λx.x",
		"λx:Unit.x",
		"(λx.x) 1 + 2",
		"(λx.x) (1 + 2)",
		"(λx.x) (λy.y) (1 + 2)",
		"(λx.x) ((λy.y) (1 + 2))",
		"let x = λy.y in x (λz.z)",
		"λx.<x, x>",
		"(λx.<x 1, x>) : ∀α.(Int → α) → α × (Int → α)",
		"(λx.<x, x 1>) : ∀α.(Int → α) → (Int → α) × α",
		"(let x = λx.x in <x, x>) : ∀α.(Int → α) → (Int → α) × α",
		"(let x = λx.x in <x, x>) : ∀α.(α → α) × (α → α)",
		"<λx.x, λx.x>",
		"(<λx.x, λx.x>) : (∀α.α → α) × ∀α.α → α",
		"(λx.x) : ∀α.(α × α × α → α × α × α) → α × α × α → α × α × α",
		"((λx.x) : ∀α.α → α) (λy.y)",
		"((λx.x) : ∀α.α × α → α × α) (λy.y)",
	];
	testCases.forEach((input) => {
		it(`paper handles "${input}"`, () => {
			const parsedExpr = Result.orElse(paper.parser.parse(input), assert.fail);
			const parsedExprAgain = Result.orElse(paper.parser.parse(paper.ast.expressionToString(parsedExpr)), assert.fail);
			assert.deepEqual(parsedExprAgain, parsedExpr);
		});
		it(`stratified handles "${input}"`, () => {
			const parsedExpr = Result.orElse(stratified.parser.parse(input), assert.fail);
			const parsedExprAgain = Result.orElse(stratified.parser.parse(stratified.surface.expressionToString(parsedExpr)), assert.fail);
			assert.deepEqual(parsedExprAgain, parsedExpr);
		});
		it(`stratified handles "${input}" through unelaboration`, () => {
			const parsedExpr = Result.orElse(stratified.parser.parse(input), assert.fail);
			const expr = stratified.elaborator.elaborate(parsedExpr);
			const unelabExpr = stratified.elaborator.unelaborate(expr);
			const parsedExprAgain = Result.orElse(stratified.parser.parse(stratified.surface.expressionToString(unelabExpr)), assert.fail);
			if (!areStratifiedSurfaceExpressionsStructurallyEqual(parsedExpr, parsedExprAgain)) {
				assert.fail();
			}
		});
	});
});

describe("roundtrip through formatting (HM)", () => {
	const testCases: string[] = [
		"()",
		"1 + 2 + 3",
		"λx.x",
		"(λx.x) 1 + 2",
		"(λx.x) (1 + 2)",
		"(λx.x) (λy.y) (1 + 2)",
		"(λx.x) ((λy.y) (1 + 2))",
		"let x = λy.y in x (λz.z)",
		"λx.<x, x>",
		"λx.<x 1, x>",
		"λx.<x, x 1>",
		"let x = λx.x in <x, x>",
		"<λx.x, λx.x>",
	];
	testCases.forEach((input) => {
		it(`hm handles "${input}"`, () => {
			const parsedExpr = Result.orElse(hm.parser.parse(input), assert.fail);
			const parsedExprAgain = Result.orElse(hm.parser.parse(hm.surface.expressionToString(parsedExpr)), assert.fail);
			assert.deepEqual(parsedExprAgain, parsedExpr);
		});
		it(`hm handles "${input}" through unelaboration`, () => {
			const parsedExpr = Result.orElse(hm.parser.parse(input), assert.fail);
			const expr = hm.elaborator.elaborate(parsedExpr);
			const unelabExpr = hm.elaborator.unelaborate(expr);
			const parsedExprAgain = Result.orElse(hm.parser.parse(hm.surface.expressionToString(unelabExpr)), assert.fail);
			if (!areHMSurfaceExpressionsStructurallyEqual(parsedExpr, parsedExprAgain)) {
				assert.fail();
			}
		});
	});
});
