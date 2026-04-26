import { Result } from "../utils/result";
import {
	Abstraction,
	AnnotatedAbstraction,
	AnnotatedExpression,
	Application,
	ArrowType,
	ExistentialTypeVariable,
	Expression,
	expressionToString,
	isMonotype,
	Kind,
	occursCheck,
	substituteType,
	TypeExpression,
	typeExpressionToString,
	UniversalType,
	Variable,
} from "./ast";
import { Context, ContextItemKind } from "./context";

export type TypeSynthesis = Result<{ type: TypeExpression; ctx: Context }, string>;
export type TypeCheck = Result<Context, string>;
export type TypeAppSynthesize = Result<{ type: TypeExpression; ctx: Context }, string>;

export function isSubtype(ctx: Context, left: TypeExpression, right: TypeExpression): TypeCheck {
	// <:Var
	if (left.kind === Kind.TypeVariable && right.kind === Kind.TypeVariable && left.name === right.name) {
		ctx.leafRule("<:Var", typeExpressionToString(left), "<:", typeExpressionToString(right));
		return Result.Ok(ctx);
	}
	// <:Unit
	if (left.kind === Kind.UnitType && right.kind === Kind.UnitType) {
		ctx.leafRule("<:Unit", typeExpressionToString(left), "<:", typeExpressionToString(right));
		return Result.Ok(ctx);
	}
	// <:ExVar
	if (left.kind === Kind.ExistentialTypeVariable && right.kind === Kind.ExistentialTypeVariable && left.id === right.id) {
		ctx.leafRule("<:ExVar", typeExpressionToString(left), "<:", typeExpressionToString(right));
		return Result.Ok(ctx);
	}

	// <:→
	if (left.kind === Kind.ArrowType && right.kind === Kind.ArrowType) {
		ctx.startRule("<:→", typeExpressionToString(left), "<:", typeExpressionToString(right));
		return Result.andThen(isSubtype(ctx, right.left, left.left), (ctx) =>
			Result.map(isSubtype(ctx, ctx.apply(left.right), ctx.apply(right.right)), (ctx) =>
				ctx.endRule("<:→", typeExpressionToString(left), "<:", typeExpressionToString(right)),
			),
		);
	}

	// "Since <:∀R is invertible, in practice one can apply it eagerly"
	// <:∀R
	if (right.kind === Kind.UniversalType) {
		ctx.startRule("<:∀R", typeExpressionToString(left), "<:", typeExpressionToString(right));
		ctx.pushTypeVariable(right.variable);
		return Result.map(isSubtype(ctx, left, right.body), (ctx) =>
			ctx.dropAfterTypeVariable(right.variable).endRule("<:∀R", typeExpressionToString(left), "<:", typeExpressionToString(right)),
		);
	}

	// <:∀L
	if (left.kind === Kind.UniversalType) {
		ctx.startRule("<:∀L", typeExpressionToString(left), "<:", typeExpressionToString(right));
		const alphaHat = ctx.newExistential();
		ctx.pushMark(alphaHat);
		ctx.pushExistential(alphaHat);
		return Result.map(isSubtype(ctx, substituteType(left.variable, alphaHat, left.body), right), (ctx) =>
			ctx.dropAfterMark(alphaHat).endRule("<:∀L", typeExpressionToString(left), "<:", typeExpressionToString(right)),
		);
	}

	// <:InstantiateL
	if (left.kind === Kind.ExistentialTypeVariable) {
		ctx.startRule("<:InstantiateL", typeExpressionToString(left), "<:", typeExpressionToString(right));
		if (occursCheck(left, right)) {
			return Result.Err("occurs check failed");
		}
		return Result.map(instantiateLeft(ctx, left, right), (ctx) =>
			ctx.endRule("<:InstantiateL", typeExpressionToString(left), "<:", typeExpressionToString(right)),
		);
	}

	// <:InstantiateR
	if (right.kind === Kind.ExistentialTypeVariable) {
		ctx.startRule("<:InstantiateR", typeExpressionToString(left), "<:", typeExpressionToString(right));
		if (occursCheck(right, left)) {
			return Result.Err("occurs check failed");
		}
		return Result.map(instantiateRight(ctx, left, right), (ctx) =>
			ctx.endRule("<:InstantiateR", typeExpressionToString(left), "<:", typeExpressionToString(right)),
		);
	}

	return Result.Err("not a subtype");
}

// α̂ :≤ A
export function instantiateLeft(ctx: Context, existential: ExistentialTypeVariable, tp: TypeExpression): TypeCheck {
	// InstLReach
	if (tp.kind === Kind.ExistentialTypeVariable && ctx.existentialBefore(existential, tp)) {
		ctx.startRule("InstLReach", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
		ctx.solve(tp, existential);
		ctx.endRule("InstLReach", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
		return Result.Ok(ctx);
	}

	// InstLSolve
	if (isMonotype(tp) && !occursCheck(existential, tp) && ctx.isScopedFor(existential, tp)) {
		ctx.startRule("InstLSolve", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
		ctx.solve(existential, tp);
		ctx.endRule("InstLSolve", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
		return Result.Ok(ctx);
	}

	// InstLArr
	if (tp.kind === Kind.ArrowType) {
		ctx.startRule("InstLArr", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
		const alpha2 = ctx.newExistential();
		const alpha1 = ctx.newExistential();
		ctx.replaceExistential(
			existential,
			{
				kind: ContextItemKind.Existential,
				id: alpha2.id,
			},
			{
				kind: ContextItemKind.Existential,
				id: alpha1.id,
			},
			{
				kind: ContextItemKind.SolvedExistential,
				left: existential.id,
				right: {
					kind: Kind.ArrowType,
					left: alpha1,
					right: alpha2,
				},
			},
		);
		return Result.andThen(instantiateRight(ctx, tp.left, alpha1), (ctx) =>
			Result.map(instantiateLeft(ctx, alpha2, ctx.apply(tp.right)), (ctx) =>
				ctx.endRule("InstLArr", typeExpressionToString(existential), ":≤", typeExpressionToString(tp)),
			),
		);
	}

	// InstLAllR
	if (tp.kind === Kind.UniversalType) {
		ctx.startRule("InstLAllR", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
		ctx.pushTypeVariable(tp.variable);
		return Result.map(instantiateLeft(ctx, existential, tp.body), (ctx) =>
			ctx.dropAfterTypeVariable(tp.variable).endRule("InstLAllR", typeExpressionToString(existential), ":≤", typeExpressionToString(tp)),
		);
	}

	return Result.Err("Failed to instantiate left");
}

// A ≤: α̂
export function instantiateRight(ctx: Context, tp: TypeExpression, existential: ExistentialTypeVariable): TypeCheck {
	// InstRReach
	if (tp.kind === Kind.ExistentialTypeVariable && ctx.existentialBefore(existential, tp)) {
		ctx.startRule("InstRReach", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
		ctx.solve(tp, existential);
		ctx.endRule("InstRReach", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
		return Result.Ok(ctx);
	}

	// InstRSolve
	if (isMonotype(tp) && !occursCheck(existential, tp) && ctx.isScopedFor(existential, tp)) {
		ctx.startRule("InstRSolve", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
		ctx.solve(existential, tp);
		ctx.endRule("InstRSolve", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
		return Result.Ok(ctx);
	}

	// InstRArr
	if (tp.kind === Kind.ArrowType) {
		ctx.startRule("InstRArr", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
		const alpha2 = ctx.newExistential();
		const alpha1 = ctx.newExistential();
		ctx.replaceExistential(
			existential,
			{
				kind: ContextItemKind.Existential,
				id: alpha2.id,
			},
			{
				kind: ContextItemKind.Existential,
				id: alpha1.id,
			},
			{
				kind: ContextItemKind.SolvedExistential,
				left: existential.id,
				right: {
					kind: Kind.ArrowType,
					left: alpha1,
					right: alpha2,
				},
			},
		);
		return Result.andThen(instantiateLeft(ctx, alpha1, tp.left), (ctx) =>
			Result.map(instantiateRight(ctx, ctx.apply(tp.right), alpha2), (ctx) =>
				ctx.endRule("InstRArr", typeExpressionToString(tp), "≤:", typeExpressionToString(existential)),
			),
		);
	}

	// InstRAllL
	if (tp.kind === Kind.UniversalType) {
		ctx.startRule("InstRAllL", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
		const betaHat = ctx.newExistential();
		ctx.pushMark(betaHat);
		ctx.pushExistential(betaHat);
		return Result.map(instantiateRight(ctx, substituteType(tp.variable, betaHat, tp.body), existential), (ctx) =>
			ctx.dropAfterMark(betaHat).endRule("InstRAllL", typeExpressionToString(tp), "≤:", typeExpressionToString(existential)),
		);
	}

	return Result.Err("Failed to instantiate right");
}

export function synthesize(ctx: Context, expr: Expression): TypeSynthesis {
	switch (expr.kind) {
		case Kind.UnitLiteral:
			return ruleUnitIntroSynth(ctx);
		case Kind.Variable:
			return ruleVar(ctx, expr);
		case Kind.Abstraction:
			return ruleArrowIntroSynth(ctx, expr);
		case Kind.Application:
			return ruleArrowElim(ctx, expr);
		case Kind.AnnotatedExpression:
			return ruleAnno(ctx, expr);
		case Kind.AnnotatedAbstraction:
			return ruleAnnotatedArrowIntroSynth(ctx, expr);
	}
}

export function check(ctx: Context, expr: Expression, tp: TypeExpression): TypeCheck {
	if (expr.kind === Kind.UnitLiteral && tp.kind === Kind.UnitType) {
		return ruleUnitIntro(ctx);
	}
	if (tp.kind === Kind.UniversalType) {
		return ruleForallIntro(ctx, expr, tp);
	}
	if (expr.kind === Kind.Abstraction && tp.kind === Kind.ArrowType) {
		return ruleArrowIntro(ctx, expr, tp);
	}
	if (expr.kind === Kind.AnnotatedAbstraction && tp.kind === Kind.ArrowType) {
		return ruleAnnotatedArrowIntro(ctx, expr, tp);
	}
	return ruleSub(ctx, expr, tp);
}

export function appSynthesize(ctx: Context, f: TypeExpression, expr: Expression): TypeAppSynthesize {
	switch (f.kind) {
		case Kind.UniversalType:
			return ruleForallApp(ctx, f, expr);
		case Kind.ExistentialTypeVariable:
			return ruleExistentialApp(ctx, f, expr);
		case Kind.ArrowType:
			return ruleArrowApp(ctx, f, expr);
	}
	return Result.Err("Could not apply/synthesize");
}

/**
 * ```
 * ──────────────────
 * Γ[x:A] ⊢ x ⇒ A ⊣ Γ
 * ```
 */
export const ruleVar = (ctx: Context, x: Variable): TypeSynthesis => {
	ctx.startRule("Var", x.name, "⇒", "?");
	return Result.map(ctx.lookup(x), (tp) => {
		ctx.endRule("Var", x.name, "⇒", typeExpressionToString(tp));
		return { type: tp, ctx };
	});
};

/**
 * ```
 * Γ ⊢ e ⇒ A ⊣ Θ  Θ ⊢ [Θ]A <: [Θ]B ⊣ Δ
 * ────────────────────────────────────
 *        Γ ⊢ e ⇐ B ⊣ Δ
 * ```
 */
export const ruleSub = (ctx: Context, expr: Expression, tp: TypeExpression): TypeCheck => {
	ctx.startRule("Sub", expressionToString(expr), "⇐", typeExpressionToString(tp));
	return Result.andThen(synthesize(ctx, expr), ({ type: A, ctx }) =>
		Result.map(isSubtype(ctx, ctx.apply(A), ctx.apply(tp)), (ctx) =>
			ctx.endRule("Sub", expressionToString(expr), "⇐", typeExpressionToString(tp)),
		),
	);
};

/**
 * ```
 *   Γ ⊢ e ⇐ A ⊣ Δ
 * ──────────────────
 * Γ ⊢ (e: A) ⇒ A ⊣ Δ
 * ```
 */
export const ruleAnno = (ctx: Context, annotated: AnnotatedExpression): TypeSynthesis => {
	ctx.startRule("Anno", expressionToString(annotated), "⇒", "?");
	return Result.map(check(ctx, annotated.body, annotated.annotation), (ctx) => {
		ctx.endRule("Anno", expressionToString(annotated), "⇒", typeExpressionToString(annotated.annotation));
		return {
			type: annotated.annotation,
			ctx,
		};
	});
};

/**
 * ```
 * ───────────────
 * Γ ⊢ () ⇐ 1 ⊣ Γ
 * ```
 */
export const ruleUnitIntro = (ctx: Context): TypeCheck => Result.Ok(ctx.leafRule("1I", "()", "⇐", "1"));

/**
 * ```
 * ───────────────
 * Γ ⊢ () ⇒ 1 ⊣ Γ
 * ```
 */
export const ruleUnitIntroSynth = (ctx: Context): TypeSynthesis => {
	ctx.leafRule("1I⇒", "()", "⇒", "1");
	return Result.Ok({ type: { kind: Kind.UnitType }, ctx });
};

/**
 * ```
 * Γ,α ⊢ e ⇐ A ⊣ Δ,α,Θ
 * ────────────────────
 *  Γ ⊢ e ⇐ ∀α.A ⊣ Δ
 * ```
 */
export const ruleForallIntro = (ctx: Context, expr: Expression, tp: UniversalType): TypeCheck => {
	ctx.startRule("∀I", expressionToString(expr), "⇐", typeExpressionToString(tp));
	ctx.pushTypeVariable(tp.variable);
	return Result.map(check(ctx, expr, tp.body), (ctx) =>
		ctx.dropAfterTypeVariable(tp.variable).endRule("∀I", expressionToString(expr), "⇐", typeExpressionToString(tp)),
	);
};

/**
 * Γ,α̂ ⊢ [α̂/α]A • e ⇒⇒ C ⊣ Δ
 * ──────────────────────────
 *   Γ ⊢ ∀α.A • e ⇒⇒ C ⊣ Δ
 */
export const ruleForallApp = (ctx: Context, tp: UniversalType, expr: Expression): TypeAppSynthesize => {
	ctx.startRule("∀App", typeExpressionToString(tp), "•", expressionToString(expr), "⇒⇒", "?");
	const alphaHat = ctx.newExistential();
	ctx.pushExistential(alphaHat);
	return Result.map(appSynthesize(ctx, substituteType(tp.variable, alphaHat, tp.body), expr), (a) => {
		a.ctx.endRule("∀App", typeExpressionToString(tp), "•", expressionToString(expr), "⇒⇒", typeExpressionToString(a.type));
		return a;
	});
};

/**
 * Γ,x:A ⊢ e ⇐ B ⊣ Δ,x:A,Θ
 * ────────────────────────
 *  Γ ⊢ λx.e ⇐ A → B ⊣ Δ
 */
export const ruleArrowIntro = (ctx: Context, expr: Abstraction, tp: ArrowType): TypeCheck => {
	ctx.startRule("→I", expressionToString(expr), "⇐", typeExpressionToString(tp));
	ctx.pushBinding(expr.variable, tp.left);
	return Result.map(check(ctx, expr.body, tp.right), (ctx) =>
		ctx.dropAfterBinding(expr.variable).endRule("→I", expressionToString(expr), "⇐", typeExpressionToString(tp)),
	);
};

/**
 * Γ,α̂,β̂,x:α̂ ⊢ e ⇐ β̂ ⊣ Δ,x:α̂,Θ
 * ─────────────────────────────
 *    Γ ⊢ λx.e ⇒ α̂ → β̂ ⊣ Δ
 */
export const ruleArrowIntroSynth = (ctx: Context, expr: Abstraction): TypeSynthesis => {
	ctx.startRule("→I⇒", expressionToString(expr), "⇒", "?");
	const alpha = ctx.newExistential();
	ctx.pushExistential(alpha);
	const beta = ctx.newExistential();
	ctx.pushExistential(beta);
	ctx.pushBinding(expr.variable, alpha);
	return Result.map(check(ctx, expr.body, beta), (ctx) => {
		const tp: ArrowType = {
			kind: Kind.ArrowType,
			left: alpha,
			right: beta,
		};
		const dropped = ctx.dropAfterBinding(expr.variable);
		dropped.endRule("→I⇒", expressionToString(expr), "⇒", typeExpressionToString(tp));
		return {
			type: tp,
			ctx: dropped,
		};
	});
};

/**
 * ```
 * Γ ⊢ e1 ⇒ A ⊣ Θ  Θ ⊢ [Θ]A • e2 ⇒⇒ C ⊣ Δ
 * ───────────────────────────────────────
 *         Γ ⊢ e1 e2 ⇒ C ⊣ Δ
 * ```
 */
export const ruleArrowElim = (ctx: Context, expr: Application): TypeSynthesis => {
	ctx.startRule("→E", expressionToString(expr), "⇒", "?");
	return Result.andThen(synthesize(ctx, expr.left), ({ type: A, ctx: theta }) =>
		Result.map(appSynthesize(theta, theta.apply(A), expr.right), (s) => {
			s.ctx.endRule("→E", expressionToString(expr), "⇒", typeExpressionToString(s.type));
			return s;
		}),
	);
};

/**
 * ```
 * Γ[α̂₂,α̂₁,α̂ = α̂₁ → α̂₂] ⊢ e ⇐ α̂₁ ⊣ Δ
 * ──────────────────────────────────
 *      Γ[α̂] ⊢ α̂ • e ⇒⇒ α̂₂ ⊣ Δ
 * ```
 */
export const ruleExistentialApp = (ctx: Context, existential: ExistentialTypeVariable, expr: Expression): TypeAppSynthesize => {
	ctx.startRule("ExApp", typeExpressionToString(existential), "•", expressionToString(expr), "⇒⇒", "?");
	const alpha2 = ctx.newExistential();
	const alpha1 = ctx.newExistential();
	ctx.replaceExistential(
		existential,
		{
			kind: ContextItemKind.Existential,
			id: alpha2.id,
		},
		{
			kind: ContextItemKind.Existential,
			id: alpha1.id,
		},
		{
			kind: ContextItemKind.SolvedExistential,
			left: existential.id,
			right: {
				kind: Kind.ArrowType,
				left: alpha1,
				right: alpha2,
			},
		},
	);
	return Result.map(check(ctx, expr, alpha1), (ctx) => {
		ctx.endRule("ExApp", typeExpressionToString(existential), "•", expressionToString(expr), "⇒⇒", typeExpressionToString(alpha2));
		return { type: alpha2, ctx };
	});
};

/**
 * ```
 *      Γ ⊢ e ⇐ A ⊣ Δ
 * ───────────────────────
 * Γ ⊢ A → C • e ⇒⇒ C ⊣ Δ
 * ```
 */
export const ruleArrowApp = (ctx: Context, arrow: ArrowType, expr: Expression): TypeAppSynthesize => {
	ctx.startRule("→App", typeExpressionToString(arrow), "•", expressionToString(expr), "⇒⇒", "?");
	return Result.map(check(ctx, expr, arrow.left), (ctx) => {
		ctx.endRule("→App", typeExpressionToString(arrow), "•", expressionToString(expr), "⇒⇒", typeExpressionToString(arrow.right));
		return { type: arrow.right, ctx };
	});
};

/**
 * CUSTOM
 * allow annotations on parameters
 * ```
 * Γ,β̂,x:A ⊢ e ⇐ β̂ ⊣ Δ,x:A,Θ
 * ──────────────────────────
 *  Γ ⊢ λx:A.e ⇒ A → β̂ ⊣ Δ
 * ```
 */
export const ruleAnnotatedArrowIntroSynth = (ctx: Context, expr: AnnotatedAbstraction): TypeSynthesis => {
	ctx.startRule("Anno→I⇒", expressionToString(expr), "⇒", "?");
	const A = expr.annotation;
	const beta = ctx.newExistential();
	ctx.pushExistential(beta);
	ctx.pushBinding(expr.variable, A);
	return Result.map(check(ctx, expr.body, beta), (ctx) => {
		const tp: ArrowType = {
			kind: Kind.ArrowType,
			left: A,
			right: beta,
		};
		const dropped = ctx.dropAfterBinding(expr.variable);
		dropped.endRule("Anno→I⇒", expressionToString(expr), "⇒", typeExpressionToString(tp));
		return {
			type: tp,
			ctx: dropped,
		};
	});
};

/**
 * CUSTOM
 * allow annotations on parameters
 * ```
 * Γ ⊢ A <: T ⊣ Θ  Θ,x:T ⊢ e ⇐ B ⊣ Δ,x:T,Θ'
 * ────────────────────────────────────────
 *       Γ ⊢ λx:T.e ⇐ A → B ⊣ Δ
 * ```
 */
export const ruleAnnotatedArrowIntro = (ctx: Context, expr: AnnotatedAbstraction, tp: ArrowType): TypeCheck => {
	ctx.startRule("Anno→I", expressionToString(expr), "⇐", typeExpressionToString(tp));
	return Result.andThen(isSubtype(ctx, tp.left, expr.annotation), (ctx) => {
		ctx.pushBinding(expr.variable, expr.annotation);
		return Result.map(check(ctx, expr.body, tp.right), (ctx) =>
			ctx.dropAfterBinding(expr.variable).endRule("Anno→I", expressionToString(expr), "⇐", typeExpressionToString(tp)),
		);
	});
};
