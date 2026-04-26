import { Result } from "../utils/result";
import { OnTrace } from "../utils/traces";
import {
	Abstraction,
	AnnotatedAbstraction,
	AnnotatedExpression,
	Application,
	ArrowType,
	BoundVariable,
	collectFreeExistentialTypeVariables,
	ExistentialTypeVariable,
	Expression,
	expressionToString,
	isMonotype,
	Kind,
	Monotype,
	occursCheck,
	open,
	TypeExpression,
	typeExpressionToString,
	UniversalType,
} from "./core";

export type TypeSynthesis = Result<TypeExpression, string>;
export type TypeCheck = Result<null, string>;
export type TypeAppSynthesize = Result<TypeExpression, string>;

export class TypeChecker {
	protected currDepth: number = 0;
	protected nextID: number = 0;
	protected solutions: Map<number, Monotype>;
	protected rigidVariables: Set<number>;
	protected existentialDepthById: Map<number, number>;
	protected existentialDeclarationOrder: number[];
	protected context: TypeExpression[];
	protected definitions: Map<string, Expression>;
	protected declarations: Map<string, TypeExpression>;

	protected traceDepth: number = 0;
	protected indentation: Map<number, string>;
	onStartTrace: OnTrace | undefined;
	onEndTrace: OnTrace | undefined;
	onLeafTrace: OnTrace | undefined;

	constructor(public logTrace = false) {
		this.solutions = new Map();
		this.rigidVariables = new Set();
		this.existentialDepthById = new Map();
		this.existentialDeclarationOrder = [];
		this.context = [];
		this.definitions = new Map();
		this.declarations = new Map();
		this.indentation = new Map([
			[0, ""],
			[1, "  "],
		]);
	}

	protected newExistentialAtDepth(depth: number): ExistentialTypeVariable {
		// NOTE does not insert into declaration order
		const id = this.nextID++;
		this.existentialDepthById.set(id, depth);
		return { kind: Kind.ExistentialTypeVariable, id, depth };
	}

	newExistential(): ExistentialTypeVariable {
		const exvar = this.newExistentialAtDepth(this.currDepth);
		this.existentialDeclarationOrder.push(exvar.id);
		return exvar;
	}

	protected newRigid(): ExistentialTypeVariable {
		const exVar = this.newExistential();
		this.rigidVariables.add(exVar.id);
		return exVar;
	}

	protected dropAboveDepth(existential: ExistentialTypeVariable) {
		const idsToDelete: number[] = [];
		this.existentialDepthById.forEach((depth, id) => {
			if (depth >= existential.depth) {
				idsToDelete.push(id);
			}
		});
		for (let i = 0; i < idsToDelete.length; i++) {
			this.existentialDepthById.delete(idsToDelete[i]);
			this.solutions.delete(idsToDelete[i]);
		}
		this.existentialDeclarationOrder = this.existentialDeclarationOrder.filter((id) => !idsToDelete.includes(id));
	}

	protected lookup(x: BoundVariable): Result<TypeExpression, string> {
		if (x.index < this.context.length) {
			return Result.Ok(this.context[this.context.length - 1 - x.index]);
		}
		return Result.Err("unknown variable");
	}

	protected isRigid(existential: ExistentialTypeVariable): boolean {
		return this.rigidVariables.has(existential.id);
	}

	protected solve(existential: ExistentialTypeVariable, solution: Monotype) {
		if (this.isRigid(existential)) {
			throw new Error("Tried to solve a rigid variable");
		}
		this.solutions.set(existential.id, solution);
		// NOTE existential declaration order keeps track of both existentials and solved existentials
	}

	protected solveAndReplace(existential: ExistentialTypeVariable, solution: Monotype, ...replacements: ExistentialTypeVariable[]) {
		if (this.isRigid(existential)) {
			throw new Error("Tried to solve a rigid variable");
		}
		this.solutions.set(existential.id, solution);
		// NOTE we don't remove replacement ids because it is assumed they were created with newExistentialAtDepth
		// The InstLArr, InstRArr, and existential App rules all follow this pattern
		// existential replaced by 2 new existentials, followed by original solved for arrow
		this.existentialDeclarationOrder.splice(this.existentialDeclarationOrder.indexOf(existential.id), 0, ...replacements.map((e) => e.id));
	}

	protected existentialDeclaredBefore(leftId: number, right: ExistentialTypeVariable) {
		const leftDepth = this.existentialDepthById.get(leftId)!;
		if (leftDepth !== right.depth) {
			return leftDepth < right.depth;
		}
		return this.existentialDeclarationOrder.indexOf(leftId) < this.existentialDeclarationOrder.indexOf(right.id);
	}

	protected isScopedFor(existential: ExistentialTypeVariable, tp: TypeExpression): boolean {
		const freeExistentials = new Set<number>();
		collectFreeExistentialTypeVariables(tp, freeExistentials);
		for (const freeId of freeExistentials) {
			if (!this.existentialDeclaredBefore(freeId, existential)) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Fig. 8
	 * apply substitutions to type
	 */
	apply(tp: TypeExpression): TypeExpression {
		switch (tp.kind) {
			case Kind.UnitType:
			case Kind.BoundTypeVariable:
			case Kind.FreeTypeVariable:
				return tp;
			case Kind.ExistentialTypeVariable: {
				const solution = this.solutions.get(tp.id);
				if (solution) {
					return this.apply(solution);
				}
				return tp;
			}
			case Kind.UniversalType:
				return {
					kind: Kind.UniversalType,
					bindingDepth: tp.bindingDepth,
					body: this.apply(tp.body),
				};
			case Kind.ArrowType:
				return {
					kind: Kind.ArrowType,
					left: this.apply(tp.left),
					right: this.apply(tp.right),
				};
		}
	}

	toString(): string {
		const existentials: string[] = [];
		for (let i = 0; i < this.existentialDeclarationOrder.length; i++) {
			const id = this.existentialDeclarationOrder[i];
			existentials.push(typeExpressionToString({ kind: Kind.ExistentialTypeVariable, id, depth: this.existentialDepthById.get(id)! }));
		}

		const subsitutions: string[] = [];
		const substitutionIds = Array.from(this.solutions.keys());
		substitutionIds.sort((a, b) => (this.existentialDeclarationOrder.indexOf(a) < this.existentialDeclarationOrder.indexOf(b) ? -1 : 1));
		for (let i = 0; i < substitutionIds.length; i++) {
			const id = substitutionIds[i];
			const l = typeExpressionToString({ kind: Kind.ExistentialTypeVariable, id, depth: this.existentialDepthById.get(id)! });
			const tau = this.solutions.get(id)!;
			const r = typeExpressionToString(tau);
			subsitutions.push(`${l} = ${r}`);
		}
		return (
			"[" + existentials.join(", ") + "], [" + subsitutions.join(", ") + "], [" + this.context.map(typeExpressionToString).join(", ") + "]"
		);
	}

	startRule(name: string, ...body: string[]) {
		if (this.logTrace) {
			console.debug(">", this.getIndentation(), name, this.toString(), "⊢", ...body, "⊣", "...");
			this.traceDepth++;
		}
		this.onStartTrace?.(name, this.toString(), ...body);
	}

	endRule(name: string, ...body: string[]) {
		if (this.logTrace) {
			this.traceDepth--;
			console.debug("<", this.getIndentation(), name, "...", "⊢", ...body, "⊣", this.toString());
		}
		this.onEndTrace?.(name, this.toString(), ...body);
		return null;
	}

	leafRule(name: string, ...body: string[]) {
		if (this.logTrace) {
			console.debug("=", this.getIndentation(), name, this.toString(), "⊢", ...body, "⊣", "...");
		}
		this.onLeafTrace?.(name, this.toString(), ...body);
		return null;
	}

	protected getIndentation() {
		if (!this.indentation.has(this.traceDepth)) {
			this.indentation.set(this.traceDepth, Array.from({ length: this.traceDepth }, () => "  ").join(""));
		}
		return this.indentation.get(this.traceDepth)!;
	}

	isSubtype(left: TypeExpression, right: TypeExpression): TypeCheck {
		// <:Var
		if (left.kind === Kind.BoundTypeVariable && right.kind === Kind.BoundTypeVariable && left.level === right.level) {
			this.leafRule("<:Var", typeExpressionToString(left), "<:", typeExpressionToString(right));
			return Result.Ok(null);
		}
		// <:Unit
		if (left.kind === Kind.UnitType && right.kind === Kind.UnitType) {
			this.leafRule("<:Unit", typeExpressionToString(left), "<:", typeExpressionToString(right));
			return Result.Ok(null);
		}
		// <:ExVar
		if (left.kind === Kind.ExistentialTypeVariable && right.kind === Kind.ExistentialTypeVariable && left.id === right.id) {
			this.leafRule("<:ExVar", typeExpressionToString(left), "<:", typeExpressionToString(right));
			return Result.Ok(null);
		}

		// <:→
		if (left.kind === Kind.ArrowType && right.kind === Kind.ArrowType) {
			this.startRule("<:→", typeExpressionToString(left), "<:", typeExpressionToString(right));
			return Result.andThen(this.isSubtype(right.left, left.left), () =>
				Result.map(this.isSubtype(this.apply(left.right), this.apply(right.right)), () =>
					this.endRule("<:→", typeExpressionToString(left), "<:", typeExpressionToString(right)),
				),
			);
		}

		// "Since <:∀R is invertible, in practice one can apply it eagerly"
		// <:∀R
		if (right.kind === Kind.UniversalType) {
			this.startRule("<:∀R", typeExpressionToString(left), "<:", typeExpressionToString(right));
			this.currDepth++;
			const rigid = this.newRigid();
			const opened = open(right.bindingDepth, right.body, rigid);
			return Result.map(this.isSubtype(left, opened), () => {
				this.dropAboveDepth(rigid);
				this.currDepth--;
				return this.endRule("<:∀R", typeExpressionToString(left), "<:", typeExpressionToString(right));
			});
		}

		// <:∀L
		if (left.kind === Kind.UniversalType) {
			this.startRule("<:∀L", typeExpressionToString(left), "<:", typeExpressionToString(right));
			this.currDepth++;
			const alphaHat = this.newExistential();
			const opened = open(left.bindingDepth, left.body, alphaHat);
			return Result.map(this.isSubtype(opened, right), () => {
				this.dropAboveDepth(alphaHat);
				this.currDepth--;
				return this.endRule("<:∀L", typeExpressionToString(left), "<:", typeExpressionToString(right));
			});
		}

		// <:InstantiateL
		if (left.kind === Kind.ExistentialTypeVariable && !this.isRigid(left)) {
			this.startRule("<:InstantiateL", typeExpressionToString(left), "<:", typeExpressionToString(right));
			if (occursCheck(left, right)) {
				return Result.Err("occurs check failed");
			}
			return Result.map(this.instantiateLeft(left, right), () =>
				this.endRule("<:InstantiateL", typeExpressionToString(left), "<:", typeExpressionToString(right)),
			);
		}

		// <:InstantiateR
		if (right.kind === Kind.ExistentialTypeVariable && !this.isRigid(right)) {
			this.startRule("<:InstantiateR", typeExpressionToString(left), "<:", typeExpressionToString(right));
			if (occursCheck(right, left)) {
				return Result.Err("occurs check failed");
			}
			return Result.map(this.instantiateRight(left, right), () =>
				this.endRule("<:InstantiateR", typeExpressionToString(left), "<:", typeExpressionToString(right)),
			);
		}

		return Result.Err("not a subtype");
	}

	// α̂ :≤ A
	protected instantiateLeft(existential: ExistentialTypeVariable, tp: TypeExpression): TypeCheck {
		// InstLReach
		if (tp.kind === Kind.ExistentialTypeVariable && !this.isRigid(tp) && this.existentialDeclaredBefore(existential.id, tp)) {
			this.startRule("InstLReach", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
			this.solve(tp, existential);
			this.endRule("InstLReach", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
			return Result.Ok(null);
		}

		// InstLSolve
		if (isMonotype(tp) && !occursCheck(existential, tp) && this.isScopedFor(existential, tp)) {
			this.startRule("InstLSolve", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
			this.solve(existential, tp);
			this.endRule("InstLSolve", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
			return Result.Ok(null);
		}

		// InstLArr
		if (tp.kind === Kind.ArrowType) {
			this.startRule("InstLArr", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
			const alpha2 = this.newExistentialAtDepth(existential.depth);
			const alpha1 = this.newExistentialAtDepth(existential.depth);
			this.solveAndReplace(existential, { kind: Kind.ArrowType, left: alpha1, right: alpha2 }, alpha2, alpha1);
			return Result.andThen(this.instantiateRight(tp.left, alpha1), () =>
				Result.map(this.instantiateLeft(alpha2, this.apply(tp.right)), () =>
					this.endRule("InstLArr", typeExpressionToString(existential), ":≤", typeExpressionToString(tp)),
				),
			);
		}

		// InstLAllR
		if (tp.kind === Kind.UniversalType) {
			this.startRule("InstLAllR", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
			this.currDepth++;
			const rigid = this.newRigid();
			const opened = open(tp.bindingDepth, tp.body, rigid);
			return Result.map(this.instantiateLeft(existential, opened), () => {
				this.dropAboveDepth(rigid);
				this.currDepth--;
				return this.endRule("InstLAllR", typeExpressionToString(existential), ":≤", typeExpressionToString(tp));
			});
		}

		return Result.Err("Failed to instantiate left");
	}

	// A ≤: α̂
	protected instantiateRight(tp: TypeExpression, existential: ExistentialTypeVariable): TypeCheck {
		// InstRReach
		if (tp.kind === Kind.ExistentialTypeVariable && !this.isRigid(tp) && this.existentialDeclaredBefore(existential.id, tp)) {
			this.startRule("InstRReach", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
			this.solve(tp, existential);
			this.endRule("InstRReach", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
			return Result.Ok(null);
		}

		// InstRSolve
		if (isMonotype(tp) && !occursCheck(existential, tp) && this.isScopedFor(existential, tp)) {
			this.startRule("InstRSolve", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
			this.solve(existential, tp);
			this.endRule("InstRSolve", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
			return Result.Ok(null);
		}

		// InstRArr
		if (tp.kind === Kind.ArrowType) {
			this.startRule("InstRArr", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
			const alpha2 = this.newExistentialAtDepth(existential.depth);
			const alpha1 = this.newExistentialAtDepth(existential.depth);
			this.solveAndReplace(existential, { kind: Kind.ArrowType, left: alpha1, right: alpha2 }, alpha2, alpha1);
			return Result.andThen(this.instantiateLeft(alpha1, tp.left), () =>
				Result.map(this.instantiateRight(this.apply(tp.right), alpha2), () =>
					this.endRule("InstRArr", typeExpressionToString(tp), "≤:", typeExpressionToString(existential)),
				),
			);
		}

		// InstRAllL
		if (tp.kind === Kind.UniversalType) {
			this.startRule("InstRAllL", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
			this.currDepth++;
			const betaHat = this.newExistential();
			const opened = open(tp.bindingDepth, tp.body, betaHat);
			return Result.map(this.instantiateRight(opened, existential), () => {
				this.dropAboveDepth(betaHat);
				this.currDepth--;
				return this.endRule("InstRAllL", typeExpressionToString(tp), "≤:", typeExpressionToString(existential));
			});
		}

		return Result.Err("Failed to instantiate right");
	}

	synthesize(expr: Expression): TypeSynthesis {
		switch (expr.kind) {
			case Kind.UnitLiteral:
				return this.ruleUnitIntroSynth();
			case Kind.BoundVariable:
				return this.ruleVar(expr);
			case Kind.FreeVariable: {
				const def = this.definitions.get(expr.name);
				if (!def) {
					return Result.Err(`Could not find definition for ${def}`);
				}
				return this.synthesize(def);
			}
			case Kind.Abstraction:
				return this.ruleArrowIntroSynth(expr);
			case Kind.Application:
				return this.ruleArrowElim(expr);
			case Kind.AnnotatedExpression:
				return this.ruleAnno(expr);
			case Kind.AnnotatedAbstraction:
				return this.ruleAnnotatedArrowIntroSynth(expr);
		}
	}

	check(expr: Expression, tp: TypeExpression): TypeCheck {
		if (expr.kind === Kind.FreeVariable && this.definitions.has(expr.name)) {
			expr = this.definitions.get(expr.name)!;
		}
		if (expr.kind === Kind.UnitLiteral && tp.kind === Kind.UnitType) {
			return this.ruleUnitIntro();
		}
		if (tp.kind === Kind.UniversalType) {
			return this.ruleForallIntro(expr, tp);
		}
		if (expr.kind === Kind.Abstraction && tp.kind === Kind.ArrowType) {
			return this.ruleArrowIntro(expr, tp);
		}
		if (expr.kind === Kind.AnnotatedAbstraction && tp.kind === Kind.ArrowType) {
			return this.ruleAnnotatedArrowIntro(expr, tp);
		}
		return this.ruleSub(expr, tp);
	}

	appSynthesize(f: TypeExpression, expr: Expression): TypeAppSynthesize {
		switch (f.kind) {
			case Kind.UniversalType:
				return this.ruleForallApp(f, expr);
			case Kind.ExistentialTypeVariable:
				if (this.isRigid(f)) {
					break;
				}
				return this.ruleExistentialApp(f, expr);
			case Kind.ArrowType:
				return this.ruleArrowApp(f, expr);
		}
		return Result.Err("Could not apply/synthesize");
	}

	/**
	 * ```
	 * ──────────────────
	 * Γ[x:A] ⊢ x ⇒ A ⊣ Γ
	 * ```
	 */
	ruleVar(x: BoundVariable): TypeSynthesis {
		this.startRule("Var", `${x.index}`, "⇒", "?");
		return Result.map(this.lookup(x), (tp) => {
			this.endRule("Var", `${x.index}`, "⇒", typeExpressionToString(tp));
			return tp;
		});
	}

	/**
	 * ```
	 * Γ ⊢ e ⇒ A ⊣ Θ  Θ ⊢ [Θ]A <: [Θ]B ⊣ Δ
	 * ────────────────────────────────────
	 *        Γ ⊢ e ⇐ B ⊣ Δ
	 * ```
	 */
	ruleSub(expr: Expression, tp: TypeExpression): TypeCheck {
		this.startRule("Sub", expressionToString(expr), "⇐", typeExpressionToString(tp));
		return Result.andThen(this.synthesize(expr), (A) =>
			Result.map(this.isSubtype(this.apply(A), this.apply(tp)), () =>
				this.endRule("Sub", expressionToString(expr), "⇐", typeExpressionToString(tp)),
			),
		);
	}

	/**
	 * ```
	 *   Γ ⊢ e ⇐ A ⊣ Δ
	 * ──────────────────
	 * Γ ⊢ (e: A) ⇒ A ⊣ Δ
	 * ```
	 */
	ruleAnno(annotated: AnnotatedExpression): TypeSynthesis {
		this.startRule("Anno", expressionToString(annotated), "⇒", "?");
		return Result.map(this.check(annotated.body, annotated.annotation), () => {
			this.endRule("Anno", expressionToString(annotated), "⇒", typeExpressionToString(annotated.annotation));
			return annotated.annotation;
		});
	}

	/**
	 * ```
	 * ───────────────
	 * Γ ⊢ () ⇐ 1 ⊣ Γ
	 * ```
	 */
	ruleUnitIntro(): TypeCheck {
		return Result.Ok(this.leafRule("1I", "()", "⇐", "1"));
	}

	/**
	 * ```
	 * ───────────────
	 * Γ ⊢ () ⇒ 1 ⊣ Γ
	 * ```
	 */
	ruleUnitIntroSynth(): TypeSynthesis {
		this.leafRule("1I⇒", "()", "⇒", "1");
		return Result.Ok({ kind: Kind.UnitType });
	}

	/**
	 * ```
	 * Γ,α ⊢ e ⇐ A ⊣ Δ,α,Θ
	 * ────────────────────
	 *  Γ ⊢ e ⇐ ∀α.A ⊣ Δ
	 * ```
	 */
	ruleForallIntro(expr: Expression, tp: UniversalType): TypeCheck {
		this.startRule("∀I", expressionToString(expr), "⇐", typeExpressionToString(tp));
		this.currDepth++;
		const rigid = this.newRigid();
		const opened = open(tp.bindingDepth, tp.body, rigid);
		return Result.map(this.check(expr, opened), () => {
			this.dropAboveDepth(rigid);
			this.currDepth--;
			return this.endRule("∀I", expressionToString(expr), "⇐", typeExpressionToString(tp));
		});
	}

	/**
	 * Γ,α̂ ⊢ [α̂/α]A • e ⇒⇒ C ⊣ Δ
	 * ──────────────────────────
	 *   Γ ⊢ ∀α.A • e ⇒⇒ C ⊣ Δ
	 */
	ruleForallApp(tp: UniversalType, expr: Expression): TypeAppSynthesize {
		this.startRule("∀App", typeExpressionToString(tp), "•", expressionToString(expr), "⇒⇒", "?");
		const alphaHat = this.newExistential();
		const opened = open(tp.bindingDepth, tp.body, alphaHat);
		return Result.map(this.appSynthesize(opened, expr), (a) => {
			this.endRule("∀App", typeExpressionToString(tp), "•", expressionToString(expr), "⇒⇒", typeExpressionToString(a));
			return a;
		});
	}

	/**
	 * Γ,x:A ⊢ e ⇐ B ⊣ Δ,x:A,Θ
	 * ────────────────────────
	 *  Γ ⊢ λx.e ⇐ A → B ⊣ Δ
	 */
	ruleArrowIntro(expr: Abstraction, tp: ArrowType): TypeCheck {
		this.startRule("→I", expressionToString(expr), "⇐", typeExpressionToString(tp));
		this.context.push(tp.left);
		return Result.map(this.check(expr.body, tp.right), () => {
			this.context.pop();
			return this.endRule("→I", expressionToString(expr), "⇐", typeExpressionToString(tp));
		});
	}

	/**
	 * Γ,α̂,β̂,x:α̂ ⊢ e ⇐ β̂ ⊣ Δ,x:α̂,Θ
	 * ─────────────────────────────
	 *    Γ ⊢ λx.e ⇒ α̂ → β̂ ⊣ Δ
	 */
	ruleArrowIntroSynth(expr: Abstraction): TypeSynthesis {
		this.startRule("→I⇒", expressionToString(expr), "⇒", "?");
		const alpha = this.newExistential();
		const beta = this.newExistential();
		this.context.push(alpha);
		return Result.map(this.check(expr.body, beta), () => {
			const tp: ArrowType = {
				kind: Kind.ArrowType,
				left: alpha,
				right: beta,
			};
			this.context.pop();
			this.endRule("→I⇒", expressionToString(expr), "⇒", typeExpressionToString(tp));
			return tp;
		});
	}

	/**
	 * ```
	 * Γ ⊢ e1 ⇒ A ⊣ Θ  Θ ⊢ [Θ]A • e2 ⇒⇒ C ⊣ Δ
	 * ───────────────────────────────────────
	 *         Γ ⊢ e1 e2 ⇒ C ⊣ Δ
	 * ```
	 */
	ruleArrowElim(expr: Application): TypeSynthesis {
		this.startRule("→E", expressionToString(expr), "⇒", "?");
		return Result.andThen(this.synthesize(expr.left), (A) =>
			Result.map(this.appSynthesize(this.apply(A), expr.right), (s) => {
				this.endRule("→E", expressionToString(expr), "⇒", typeExpressionToString(s));
				return s;
			}),
		);
	}

	/**
	 * ```
	 * Γ[α̂₂,α̂₁,α̂ = α̂₁ → α̂₂] ⊢ e ⇐ α̂₁ ⊣ Δ
	 * ──────────────────────────────────
	 *      Γ[α̂] ⊢ α̂ • e ⇒⇒ α̂₂ ⊣ Δ
	 * ```
	 */
	ruleExistentialApp(existential: ExistentialTypeVariable, expr: Expression): TypeAppSynthesize {
		this.startRule("ExApp", typeExpressionToString(existential), "•", expressionToString(expr), "⇒⇒", "?");
		const alpha2 = this.newExistentialAtDepth(existential.depth);
		const alpha1 = this.newExistentialAtDepth(existential.depth);
		this.solveAndReplace(
			existential,
			{
				kind: Kind.ArrowType,
				left: alpha1,
				right: alpha2,
			},
			alpha2,
			alpha1,
		);
		return Result.map(this.check(expr, alpha1), () => {
			this.endRule("ExApp", typeExpressionToString(existential), "•", expressionToString(expr), "⇒⇒", typeExpressionToString(alpha2));
			return alpha2;
		});
	}

	/**
	 * ```
	 *      Γ ⊢ e ⇐ A ⊣ Δ
	 * ────────────────────────
	 * Γ ⊢ A → C • e ⇒⇒ C ⊣ Δ
	 * ```
	 */
	ruleArrowApp(arrow: ArrowType, expr: Expression): TypeAppSynthesize {
		this.startRule("→App", typeExpressionToString(arrow), "•", expressionToString(expr), "⇒⇒", "?");
		return Result.map(this.check(expr, arrow.left), () => {
			this.endRule("→App", typeExpressionToString(arrow), "•", expressionToString(expr), "⇒⇒", typeExpressionToString(arrow.right));
			return arrow.right;
		});
	}

	/**
	 * CUSTOM
	 * allow annotations on parameters
	 * ```
	 * Γ ⊢ A <: T ⊣ Θ  Θ,x:T ⊢ e ⇐ B ⊣ Δ,x:T,Θ'
	 * ────────────────────────────────────────
	 *       Γ ⊢ λx:T.e ⇐ A → B ⊣ Δ
	 * ```
	 */
	ruleAnnotatedArrowIntro(expr: AnnotatedAbstraction, tp: ArrowType): TypeCheck {
		this.startRule("Anno→I", expressionToString(expr), "⇐", typeExpressionToString(tp));
		return Result.andThen(this.isSubtype(tp.left, expr.annotation), () => {
			this.context.push(expr.annotation);
			return Result.map(this.check(expr.body, tp.right), () => {
				this.context.pop();
				return this.endRule("Anno→I", expressionToString(expr), "⇐", typeExpressionToString(tp));
			});
		});
	}

	/**
	 * CUSTOM
	 * allow annotations on parameters
	 * ```
	 * Γ,β̂,x:A ⊢ e ⇐ β̂ ⊣ Δ,x:A,Θ
	 * ──────────────────────────
	 *  Γ ⊢ λx:A.e ⇒ A → β̂ ⊣ Δ
	 * ```
	 */
	ruleAnnotatedArrowIntroSynth(expr: AnnotatedAbstraction): TypeSynthesis {
		this.startRule("Anno→I⇒", expressionToString(expr), "⇒", "?");
		const A = expr.annotation;
		const beta = this.newExistential();
		this.context.push(A);
		return Result.map(this.check(expr.body, beta), () => {
			const tp: ArrowType = {
				kind: Kind.ArrowType,
				left: A,
				right: beta,
			};
			this.context.pop();
			this.endRule("Anno→I⇒", expressionToString(expr), "⇒", typeExpressionToString(tp));
			return tp;
		});
	}
}
