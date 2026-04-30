import * as paper from "../src/paperDK";
import * as stratified from "../src/stratifiedDK";
import { Result } from "../src/utils/result";
import { getTraceHandlers, traceToProofTree, traceToSimpleString } from "../src/utils/traces";

const testCases: string[] = [
	// "()",
	// "(()) : Unit",
	// "λx.x",
	// "λx.((λy.y) x)",
	// "λx.((λx.x) x)",
	// "λx.λy.x",
	// "λx.λy:1.x",
	// "λx:1.λy.x",
	// "λx:(∀ α.α → α).x",
	// "λx:∀ α.∀ β.β → 1 → α.x",
	// "λx:∀ A.∀ B. B → Unit → A. x",
	// "(λx.x) ()",
	// "(λx.x) (λy.y)",
	// "(λx.x) (λy:1.y)",
	// "(λx.x) (λy:∀ β.β → β.y)",
	// "(λy:∀ α.α → α.y) (λx.x)",
	// "(λy:∀ β.β → β.y) (λx.x)",
	// "λx:(∀ T.T → T). x",
	// "(λx.x) (λy:∀ T.T → T.y)",
	// "(λy:∀ T.T → T.y) (λx.x)",
	// "(λy:∀ T.T → T. y (λx.x))",
	// "(λy:∀ T.T → T. (λx.x) y)",
	// "λx.λf.f (f x)",
	// "(λx.λf.f (f x)) ()",
	// "λf. λg. λx. f (g x)",
	// "(λx. λk. k x) : ∀α. α → (α → ∀β.β) → ∀β.β",
	// "(λx. λk. k x) : ∀α. α → (α → ∀β.β) → ∀β.β",
	// "λf.λx.f () x",
	// "λf.λg. f (g f) ",
	// "(λy:∀ α.∀ β.α → β → α. y () ())",
	// "λx:∀ α.α → α.(x x)",
	// "(λx.(x x)) : (∀α.α → α) → (∀β.β → β)",
	// "(λx.(x x)) : (∀T.T → T) → (∀T.T → T)",
	// "(λf:∀ α.α → α. λx. f (f x))",
	// "(λx.x) : (∀α.α → α) → (∀α.α → α)",
	// "λg:∀ α.α → α. (g ()) (g (λx.x))", // failure case
	// "λx:∀ α.∀ β.∀ γ.α → β → γ → α. x () () ()",
	// "λf:∀ α.α → α. f (f ())",
	// "(λf.λx. f x) : (∀α.α → α) → ∀β.β → β",
	// "(λx.x) : (∀α.∀β.α → β → α) → (∀γ.∀δ.γ → δ → γ)",
	// "(λx.λy.x) : ∀α.∀β.α → β → α", // TRUE
	// "(λx.λy.y) : ∀α.∀β.α → β → β", // FALSE
	// "(λf.λx.x) : ∀α.∀β.α → β → β", // ZERO == FALSE
	// "(λn.λf.λx.f ((n f) x)) : ∀α.∀β.∀γ.((α → β) → γ → α) → (α → β) → γ → β", // SUCC
	// "(λn.λf.λx.f ((n f) x)) (λf.λx.x)", // SUCC ZERO
	// "1 + 2 + 3",
	// "λn.n + 1",
	// "let x = 1 in let y = 2 in <x, y>",
	// "(λx.λy.λz.<x, <y + 2, z>>) 1",
	// "(λx.λy.λz.z) : ∀α.∀β.∀γ.α → β → γ → γ",
	// "<1, λx.x>",
	// "(<1, λx.x>) : Int × (Unit → Unit)",
	// "let x = <1, λx.x> in (x): Int × (Unit → Unit)",
	// "let x = ((<1, λx.x>) : Int × ∀α.α → α) in (x) : Int × (Unit → Unit)",
	// "let id = (λx.x) in <id 1, id ()>",
	"let id : ∀α.α → α = (λx.x) in <id 1, id ()>",
];

const getPaperContext = (logTraces: boolean, captureTraces: boolean) => {
	const context = new paper.context.Context(logTraces);
	if (!captureTraces) {
		return { context, getTrace: undefined };
	}
	const { onStartTrace, onEndTrace, onLeafTrace, getTrace } = getTraceHandlers();
	context.onStartTrace = onStartTrace;
	context.onEndTrace = onEndTrace;
	context.onLeafTrace = onLeafTrace;
	return { context, getTrace };
};

const runReferenceSynthesis = (expr: paper.ast.Expression) => {
	const { context, getTrace } = getPaperContext(true, true);
	Result.elim(
		paper.dk.synthesize(context, expr),
		({ type, ctx }) => {
			if (getTrace) {
				console.log(traceToSimpleString(getTrace()));
			}
			const appliedType = ctx.apply(type);
			console.log(paper.ast.typeExpressionToString(appliedType));
			const generalized = paper.ast.generalize(appliedType);
			const miniscoped = paper.ast.miniscope(generalized);
			if (expr.kind === paper.ast.Kind.AnnotatedExpression) {
				console.log(`(${paper.ast.expressionToString(expr)}) : ${paper.ast.typeExpressionToString(miniscoped)}`);
			} else {
				console.log(`${paper.ast.expressionToString(expr)} : ${paper.ast.typeExpressionToString(miniscoped)}`);
			}

			console.log("evaluated", paper.ast.expressionToString(paper.evaluate.evaluate(expr)));
		},
		(e) => {
			console.error("synthesis error");
			console.error(e);
		},
	);
};

const getStratifiedTypeChecker = (logTraces: boolean, captureTraces: boolean) => {
	const checker = new stratified.dk.TypeChecker(logTraces);
	if (!captureTraces) {
		return { checker, getTrace: undefined };
	}
	const { onStartTrace, onEndTrace, onLeafTrace, getTrace } = getTraceHandlers();
	checker.onStartTrace = onStartTrace;
	checker.onEndTrace = onEndTrace;
	checker.onLeafTrace = onLeafTrace;
	return { checker, getTrace };
};

const runStratifiedSynthesis = (expr: stratified.core.Expression) => {
	const { checker, getTrace } = getStratifiedTypeChecker(true, true);
	Result.elim(
		checker.synthesize(expr),
		(type) => {
			if (getTrace) {
				console.log(traceToSimpleString(getTrace()));
			}
			console.log("elaborated", stratified.core.expressionToString(expr));
			const exprUnelab = stratified.elaborator.unelaborate(expr);
			console.log("unelaborated", stratified.surface.expressionToString(exprUnelab));

			const appliedType = checker.apply(type);
			const generalized = stratified.core.generalize(appliedType);
			const miniscoped = stratified.core.miniscope(generalized);
			if (expr.kind === stratified.core.Kind.AnnotatedExpression) {
				console.log(
					`(${stratified.surface.expressionToString(exprUnelab)}) : ${stratified.surface.typeExpressionToString(stratified.elaborator.unelaborateType(miniscoped))}`,
				);
			} else {
				console.log(
					`${stratified.surface.expressionToString(exprUnelab)} : ${stratified.surface.typeExpressionToString(stratified.elaborator.unelaborateType(miniscoped))}`,
				);
			}

			const evaled = stratified.evaluate.evaluate(expr);
			console.log("evaluated", stratified.surface.expressionToString(stratified.elaborator.unelaborate(evaled)));
		},
		(e) => {
			console.error("synthesis error");
			console.error(e);
		},
	);
};

testCases.forEach((input, i) => {
	if (i > 0) {
		console.log("===");
	}
	console.log("REFERENCE");
	Result.elim(
		paper.parser.parse(input),
		(expr) => {
			console.log(paper.ast.expressionToString(expr));
			runReferenceSynthesis(expr);
		},
		(e) => {
			console.error("parse error");
			console.error(e);
		},
	);
	console.log("---");
	console.log("SCOPE-STRATIFIED");
	Result.elim(
		stratified.parser.parse(input),
		(surfaceExpr) => {
			console.log(stratified.surface.expressionToString(surfaceExpr));
			const expr = stratified.elaborator.elaborate(surfaceExpr);
			runStratifiedSynthesis(expr);
		},
		(e) => {
			console.error("parse error");
			console.error(e);
		},
	);
});

function example() {
	// Example
	console.log("Example");
	const context = new paper.context.Context(true);
	const alphaHat = context.newExistential();
	context.pushExistential(alphaHat);
	// Note, α and β are reversed relative to the paper, because they are enumerating from top to bottom,
	// while this is solving from bottom to top
	// ∀β.β ≤: α̂
	paper.dk.instantiateRight(
		context,
		{
			kind: paper.ast.Kind.UniversalType,
			variable: "β",
			body: { kind: paper.ast.Kind.TypeVariable, name: "β" },
		},
		alphaHat,
	);
}

function fig12() {
	console.log("Fig 12 (corrected)");
	// ∀β.β → β ≤: α̂
	const { context, getTrace } = getPaperContext(false, true);
	const alphaHat = context.newExistential();
	context.pushExistential(alphaHat);

	Result.elim(
		Result.andThen(
			paper.parser.parseType("∀β.β → β"), //
			(tp) => paper.dk.instantiateRight(context, tp, alphaHat),
		),
		(ctx) => {
			if (getTrace) {
				console.log(traceToProofTree(getTrace()));
			}
			const applied = ctx.apply(alphaHat);
			console.log(paper.ast.typeExpressionToString(applied));
			const generalized = paper.ast.generalize(applied);
			console.log(paper.ast.typeExpressionToString(generalized));
		},
		console.error,
	);
}

function fig12Alt() {
	// Fig 12
	console.log("Fig 12 (alternative)");
	const { context, getTrace } = getPaperContext(false, true);
	const alphaHat = context.newExistential();
	context.pushExistential(alphaHat);
	Result.elim(
		paper.parser.parseType("∀β.β → (∀γ.γ → β)"),
		(tp) => {
			Result.elim(
				paper.dk.instantiateRight(context, tp, alphaHat),
				(ctx) => {
					if (getTrace) {
						console.log(traceToProofTree(getTrace()));
					}
					const applied = ctx.apply(alphaHat);
					console.log(paper.ast.typeExpressionToString(applied));
					const generalized = paper.ast.generalize(applied);
					console.log(paper.ast.typeExpressionToString(generalized));
				},
				console.error,
			);
		},
		console.error,
	);
}

function thesis29() {
	console.log("Thesis pg. 29");
	const { context, getTrace } = getPaperContext(false, true);
	Result.elim(
		Result.andThen(paper.parser.parseType("∀α.α → α"), (left) =>
			Result.andThen(paper.parser.parseType("1 → 1"), (right) => paper.dk.isSubtype(context, left, right)),
		),
		() => {
			if (getTrace) {
				console.log(traceToProofTree(getTrace()));
			}
		},
		(e) => {
			console.error(e);
		},
	);
}
