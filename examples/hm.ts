import * as hm from "../src/hm";
import { Result } from "../src/utils/result";
import { traceToProofTree } from "../src/utils/traces";

const testCases: string[] = [
	// "λx.x",
	// "let x = () in x",
	"let id = (λx.x) in <id 1, id ()>",
	// "let id = (λx.x) in let y = () in id y",
	// "λf.f (f ())",
	// "λx.λf.f (f x)",
	// "(λx.λf.f (f x)) ()", //
	// "λx.x x",
];

const getHMTypeChecker = (logTraces: boolean, captureTraces: boolean) => {
	const checker = new hm.hm.TypeChecker(logTraces);
	if (!captureTraces) {
		return { checker, getTrace: undefined };
	}
	const { onStartTrace, onEndTrace, onLeafTrace, getTrace } = hm.traces.getTraceHandlers();
	checker.onStartTrace = onStartTrace;
	checker.onEndTrace = onEndTrace;
	checker.onLeafTrace = onLeafTrace;
	return { checker, getTrace };
};

const runHMInference = (expr: hm.core.Expression) => {
	const { checker, getTrace } = getHMTypeChecker(true, true);
	Result.elim(
		checker.infer(expr),
		(type) => {
			if (getTrace) {
				console.log(traceToProofTree(getTrace()));
			}
			console.log("elaborated", hm.core.expressionToString(expr));
			const exprUnelab = hm.elaborator.unelaborate(expr);
			console.log("unelaborated", hm.surface.expressionToString(exprUnelab));

			console.log(`${hm.surface.expressionToString(exprUnelab)} : ${hm.hm.schemeToString(type)}`);

			const evaled = hm.evaluate.evaluate(expr);
			console.log("evaluated", hm.surface.expressionToString(hm.elaborator.unelaborate(evaled)));
		},
		(e) => {
			console.error("inference error");
			console.error(e);
		},
	);
};

testCases.forEach((input, i) => {
	if (i > 0) {
		console.log("===");
	}
	Result.elim(
		hm.parser.parse(input),
		(surfaceExpr) => {
			console.log(hm.surface.expressionToString(surfaceExpr));
			const expr = hm.elaborator.elaborate(surfaceExpr);
			runHMInference(expr);
		},
		(e) => {
			console.error("parse error");
			console.error(e);
		},
	);
});
