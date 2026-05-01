import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as hm from "../hm";
import * as paper from "../paperDK";
import * as stratified from "../stratifiedDK";
import { Result } from "../utils/result";
import { areExpressionsStructurallyEqual, areExpressionsStructurallyEqualHM } from "./utils";

describe("evaluation", () => {
	const okCases: string[] = [
		"()",
		"1",
		"1 + 2 + 3",
		"λx.x",
		"(λx.x) ()",
		"(λx.x) 1 + 2",
		"(λx.x) (λy.y)",
		"(λx.<x,x>) 1",
		"(λx.x + 1) 1",
		"let x = 1 in let y = x in x + y",
		"λy.((λx.x) y) 1",
	];

	okCases.forEach((input) => {
		it(`evaluation agrees "${input}"`, () => {
			const paperExpr = Result.elim(paper.parser.parse(input), paper.evaluate.evaluate, assert.fail);
			const stratifiedExpr = Result.elim(
				Result.map(stratified.parser.parse(input), stratified.elaborator.elaborate),
				stratified.evaluate.evaluate,
				assert.fail,
			);
			if (!areExpressionsStructurallyEqual(paperExpr, stratifiedExpr)) {
				assert.fail("evaluation results were different");
			}
			const hmExpr = Result.elim(Result.map(hm.parser.parse(input), hm.elaborator.elaborate), hm.evaluate.evaluate, assert.fail);
			if (!areExpressionsStructurallyEqualHM(paperExpr, hmExpr)) {
				assert.fail("evaluation results were different");
			}
		});
	});
});
