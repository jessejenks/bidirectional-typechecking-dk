import { createTypeVariableName } from "../utils/names";
import { Result } from "../utils/result";
import type { OnTrace } from "../utils/traces";
import {
	Abstraction,
	Addition,
	Application,
	BoundVariable,
	Expression,
	expressionToString,
	FreeVariable,
	IntLiteral,
	Kind,
	Let,
	Pair,
	Projection,
	TypeExpression,
	typeExpressionToString,
	TypeKind,
	UnificationVariable,
	UnitLiteral,
} from "./core";

export type Scheme = {
	arity: number;
	type: TypeExpression;
};

export function schemeToString(sch: Scheme) {
	if (sch.arity === 0) {
		return typeExpressionToString(sch.type);
	}
	const maxLevel = maxTypeVariableLevel(sch.type);
	return (
		"(" +
		Array.from({ length: maxLevel + 1 })
			.map((_, id) => `∀${createTypeVariableName(id)}.`)
			.join("") +
		typeExpressionToString(sch.type) +
		")"
	);
}

function maxTypeVariableLevel(tp: TypeExpression): number {
	switch (tp.kind) {
		case TypeKind.UnitType:
		case TypeKind.IntType:
		case TypeKind.UnificationVariable:
			return -1;
		case TypeKind.TypeVariable:
			return tp.level;
		case TypeKind.ArrowType:
		case TypeKind.ProductType:
			return Math.max(maxTypeVariableLevel(tp.left), maxTypeVariableLevel(tp.right));
	}
}

export type TypeInference = Result<TypeExpression, string>;

export class TypeChecker {
	protected nextId: number;
	protected currLevel: number;
	protected env: Map<string, Scheme>;
	protected context: Scheme[];
	protected substitution: Map<number, TypeExpression>;
	protected traceDepth: number = 0;
	protected indentation: Map<number, string>;
	onStartTrace: OnTrace | undefined;
	onEndTrace: OnTrace | undefined;
	onLeafTrace: OnTrace | undefined;

	constructor(public logTrace = false) {
		this.nextId = 0;
		this.currLevel = 0;
		this.env = new Map();
		this.context = [];
		this.substitution = new Map();
		this.indentation = new Map([
			[0, ""],
			[1, "  "],
		]);
	}

	protected asMonotype(tp: TypeExpression): Scheme {
		return { arity: 0, type: tp };
	}

	newUnificationVariable(): UnificationVariable {
		return { kind: TypeKind.UnificationVariable, id: this.nextId++, level: this.currLevel };
	}

	infer(expr: Expression): Result<Scheme, string> {
		return Result.map(this.algorithmJ(expr), (tp) => this.generalizeAtLevel(this.resolve(tp), -1));
	}

	protected algorithmJ(expr: Expression): TypeInference {
		switch (expr.kind) {
			case Kind.UnitLiteral:
				return this.ruleUnit(expr);
			case Kind.IntLiteral:
				return this.ruleInt(expr);
			case Kind.BoundVariable:
				return this.ruleVar(expr);
			case Kind.FreeVariable:
				return this.ruleFreeVar(expr);
			case Kind.Application:
				return this.ruleApp(expr);
			case Kind.Abstraction:
				return this.ruleAbs(expr);
			case Kind.Addition:
				return this.ruleAddition(expr);
			case Kind.Pair:
				return this.rulePair(expr);
			case Kind.Projection:
				return this.ruleProjection(expr);
			case Kind.Let:
				return this.ruleLet(expr);
		}
	}

	/**
	 * ────────── Unit
	 * Γ ⊢ () : 1
	 */
	protected ruleUnit(expr: UnitLiteral): TypeInference {
		const tp: TypeExpression = { kind: TypeKind.UnitType };
		this.leafRule("Unit", expressionToString(expr), ":", typeExpressionToString(tp));
		return Result.Ok(tp);
	}

	/**
	 * ─────────── Int
	 * Γ ⊢ n : Int
	 */
	protected ruleInt(expr: IntLiteral): TypeInference {
		const tp: TypeExpression = { kind: TypeKind.IntType };
		this.leafRule("Int", expressionToString(expr), ":", typeExpressionToString(tp));
		return Result.Ok(tp);
	}

	/**
	 * x:σ ∈ Γ    τ = inst(σ)
	 * ────────────────────── Var
	 *      Γ ⊢ x : τ
	 */
	protected ruleVar(expr: BoundVariable): TypeInference {
		if (expr.index < this.context.length) {
			const tp = this.instantiate(this.context[this.context.length - 1 - expr.index]);
			this.leafRule("Var", expressionToString(expr), ":", typeExpressionToString(tp));
			return Result.Ok(tp);
		}
		return Result.Err(`Could not infer type for variable x${expr.index}`);
	}

	protected ruleFreeVar(expr: FreeVariable): TypeInference {
		if (this.env.has(expr.name)) {
			const tp = this.instantiate(this.env.get(expr.name)!);
			this.leafRule("FreeVar", expressionToString(expr), ":", typeExpressionToString(tp));
			return Result.Ok(tp);
		}
		return Result.Err(`Could not infer type for ${expr.name}`);
	}

	/**
	 * Γ ⊢ e₁ : τ₁    Γ ⊢ e₂ : τ₂    unify(τ₁, τ₂ → τ̂)
	 * ──────────────────────────────────────────────── App
	 *                Γ ⊢ e₁ e₂ : τ̂
	 */
	protected ruleApp(expr: Application): TypeInference {
		this.startRule("App", expressionToString(expr), ":", "?");
		return Result.andThen(this.algorithmJ(expr.left), (tau1) =>
			Result.andThen(this.algorithmJ(expr.right), (tau2) => {
				const tauprime = this.newUnificationVariable();
				return Result.map(this.unify(tau1, { kind: TypeKind.ArrowType, left: tau2, right: tauprime }), () => {
					this.endRule("App", expressionToString(expr), ":", typeExpressionToString(tauprime));
					return tauprime;
				});
			}),
		);
	}

	/**
	 *  Γ, x:τ̂ ⊢ e : τ
	 * ──────────────── Abs
	 * Γ ⊢ λx.e : τ̂ → τ
	 */
	protected ruleAbs(expr: Abstraction): TypeInference {
		this.startRule("Abs", expressionToString(expr), ":", "?");
		const tau = this.newUnificationVariable();
		this.context.push(this.asMonotype(tau));
		return Result.map(this.algorithmJ(expr.body), (tauprime) => {
			this.context.pop();
			const tp: TypeExpression = { kind: TypeKind.ArrowType, left: tau, right: tauprime };
			this.endRule("Abs", expressionToString(expr), ":", typeExpressionToString(tp));
			return tp;
		});
	}

	/**
	 * Γ ⊢ n : τ    unify(τ, Int)    Γ ⊢ m : τ'    unify(τ', Int)
	 * ────────────────────────────────────────────────────────── Add
	 *                       Γ ⊢ n + m : Int
	 */
	protected ruleAddition(expr: Addition): TypeInference {
		this.startRule("Add", expressionToString(expr), ":", "?");
		const intType: TypeExpression = { kind: TypeKind.IntType };
		return Result.andThen(this.algorithmJ(expr.left), (tau) =>
			Result.andThen(this.unify(tau, intType), () =>
				Result.andThen(this.algorithmJ(expr.right), (tauprime) =>
					Result.map(this.unify(tauprime, intType), (): TypeExpression => {
						this.endRule("Add", expressionToString(expr), ":", typeExpressionToString(intType));
						return intType;
					}),
				),
			),
		);
	}

	/**
	 * Γ ⊢ e1 : A    Γ ⊢ e2 : B
	 * ───────────────────────── Pair
	 *   Γ ⊢ <e1, e2> : A × B
	 */
	protected rulePair(expr: Pair): TypeInference {
		this.startRule("Pair", expressionToString(expr), ":", "?");
		return Result.andThen(this.algorithmJ(expr.left), (left) =>
			Result.map(this.algorithmJ(expr.right), (right) => {
				const tp: TypeExpression = { kind: TypeKind.ProductType, left, right };
				this.endRule("Pair", expressionToString(expr), ":", typeExpressionToString(tp));
				return tp;
			}),
		);
	}

	/**
	 * Γ ⊢ e : τ    unify(τ, τ̂₁ × τ̂₂)
	 * ────────────────────────────── Projection fst
	 *       Γ ⊢ fst(e) : τ̂₁
	 *
	 * Γ ⊢ e : τ    unify(τ, τ̂₁ × τ̂₂)
	 * ────────────────────────────── Projection snd
	 *       Γ ⊢ snd(e) : τ̂₂
	 */
	protected ruleProjection(expr: Projection): TypeInference {
		this.startRule(`Projection ${expr.side}`, expressionToString(expr), ":", "?");
		const tau1 = this.newUnificationVariable();
		const tau2 = this.newUnificationVariable();
		return Result.andThen(this.algorithmJ(expr.expression), (tau) =>
			Result.map(this.unify(tau, { kind: TypeKind.ProductType, left: tau1, right: tau2 }), () => {
				const tp = expr.side === "fst" ? tau1 : tau2;
				this.endRule(`Projection ${expr.side}`, expressionToString(expr), ":", typeExpressionToString(tp));
				return tp;
			}),
		);
	}

	/**
	 * Γ ⊢ e' : τ'    Γ, x:gen(Γ,τ') ⊢ e : τ
	 * ────────────────────────────────────── Let
	 *       Γ ⊢ let x = e' in e : τ
	 */
	protected ruleLet(expr: Let): TypeInference {
		this.startRule("Let", expressionToString(expr), ":", "?");
		this.currLevel++;
		return Result.andThen(this.algorithmJ(expr.expression), (tauprime) => {
			this.currLevel--;
			this.context.push(this.generalize(tauprime));
			return Result.map(this.algorithmJ(expr.body), (tau) => {
				this.context.pop();
				this.endRule("Let", expressionToString(expr), ":", typeExpressionToString(tau));
				return tau;
			});
		});
	}

	protected resolve(tp: TypeExpression): TypeExpression {
		if (tp.kind !== TypeKind.UnificationVariable) {
			return tp;
		}
		if (this.substitution.has(tp.id)) {
			const fully = this.resolve(this.substitution.get(tp.id)!);
			this.substitution.set(tp.id, fully);
			return fully;
		}
		return tp;
	}

	protected unify(left: TypeExpression, right: TypeExpression): Result<null, string> {
		left = this.resolve(left);
		right = this.resolve(right);

		if (
			left === right ||
			(left.kind === TypeKind.UnitType && right.kind === TypeKind.UnitType) ||
			(left.kind === TypeKind.IntType && right.kind === TypeKind.IntType)
		) {
			return Result.Ok(null);
		}

		if (left.kind === TypeKind.UnificationVariable && right.kind === TypeKind.UnificationVariable) {
			if (left.id === right.id) {
				return Result.Ok(null);
			}
			if (left.level <= right.level) {
				right.level = left.level;
				this.substitution.set(left.id, right);
			} else {
				left.level = right.level;
				this.substitution.set(right.id, left);
			}
			return Result.Ok(null);
		}
		if (left.kind === TypeKind.UnificationVariable) {
			if (this.occurs(left.id, right)) {
				return Result.Err("occurs check failed");
			}
			this.lowerLevels(right, left.level);
			this.substitution.set(left.id, right);
			return Result.Ok(null);
		}
		if (right.kind === TypeKind.UnificationVariable) {
			if (this.occurs(right.id, left)) {
				return Result.Err("occurs check failed");
			}
			this.lowerLevels(left, right.level);
			this.substitution.set(right.id, left);
			return Result.Ok(null);
		}
		if (left.kind === TypeKind.ArrowType && right.kind === TypeKind.ArrowType) {
			return Result.andThen(this.unify(left.left, right.left), () => this.unify(left.right, right.right));
		}
		if (left.kind === TypeKind.ProductType && right.kind === TypeKind.ProductType) {
			return Result.andThen(this.unify(left.left, right.left), () => this.unify(left.right, right.right));
		}
		return Result.Err(`Could not unify ${typeExpressionToString(left)} with ${typeExpressionToString(right)}`);
	}

	// open
	protected instantiate(sch: Scheme): TypeExpression {
		if (sch.arity === 0) {
			return sch.type;
		}
		const fresh = Array.from({ length: sch.arity }, () => this.newUnificationVariable());
		const instantiateInner = (tp: TypeExpression): TypeExpression => {
			switch (tp.kind) {
				case TypeKind.UnitType:
				case TypeKind.IntType:
				case TypeKind.UnificationVariable:
					return tp;
				case TypeKind.TypeVariable:
					return fresh[tp.level];
				case TypeKind.ArrowType:
					return { kind: TypeKind.ArrowType, left: instantiateInner(tp.left), right: instantiateInner(tp.right) };
				case TypeKind.ProductType:
					return { kind: TypeKind.ProductType, left: instantiateInner(tp.left), right: instantiateInner(tp.right) };
			}
		};
		return instantiateInner(sch.type);
	}

	protected generalizeAtLevel(tp: TypeExpression, level: number): Scheme {
		let arity = 0;
		const generalizedVars = new Map<number, number>();
		const generalizeInner = (tp: TypeExpression): TypeExpression => {
			tp = this.resolve(tp);
			switch (tp.kind) {
				case TypeKind.UnitType:
				case TypeKind.IntType:
				case TypeKind.TypeVariable:
					return tp;
				case TypeKind.UnificationVariable:
					if (tp.level > level) {
						if (!generalizedVars.has(tp.id)) {
							generalizedVars.set(tp.id, arity++);
						}
						return { kind: TypeKind.TypeVariable, level: generalizedVars.get(tp.id)! };
					}
					return tp;
				case TypeKind.ArrowType:
					return { kind: TypeKind.ArrowType, left: generalizeInner(tp.left), right: generalizeInner(tp.right) };
				case TypeKind.ProductType:
					return { kind: TypeKind.ProductType, left: generalizeInner(tp.left), right: generalizeInner(tp.right) };
			}
		};
		const generalized = generalizeInner(tp);
		return { arity, type: generalized };
	}

	// close
	protected generalize(tp: TypeExpression): Scheme {
		return this.generalizeAtLevel(tp, this.currLevel);
	}

	protected lowerLevels(tp: TypeExpression, maxLevel: number): void {
		tp = this.resolve(tp);
		switch (tp.kind) {
			case TypeKind.UnitType:
			case TypeKind.IntType:
			case TypeKind.TypeVariable:
				return;
			case TypeKind.UnificationVariable:
				if (tp.level > maxLevel) {
					tp.level = maxLevel;
				}
				return;
			case TypeKind.ArrowType:
			case TypeKind.ProductType:
				this.lowerLevels(tp.left, maxLevel);
				this.lowerLevels(tp.right, maxLevel);
				return;
		}
	}

	protected occurs(id: number, tp: TypeExpression): boolean {
		switch (tp.kind) {
			case TypeKind.UnitType:
			case TypeKind.IntType:
			case TypeKind.TypeVariable:
				return false;
			case TypeKind.UnificationVariable:
				return id === tp.id;
			case TypeKind.ArrowType:
			case TypeKind.ProductType:
				return this.occurs(id, tp.left) || this.occurs(id, tp.right);
		}
	}

	protected startRule(name: string, ...body: string[]) {
		if (this.logTrace) {
			console.debug(">", this.getIndentation(), name, this.toString(), "⊢", ...body, "⊣", "...");
			this.traceDepth++;
		}
		this.onStartTrace?.(name, this.toString(), ...body);
	}

	protected endRule(name: string, ...body: string[]) {
		if (this.logTrace) {
			this.traceDepth--;
			console.debug("<", this.getIndentation(), name, "...", "⊢", ...body, "⊣", this.substitutionToString());
		}
		this.onEndTrace?.(name, this.substitutionToString(), ...body);
	}

	protected leafRule(name: string, ...body: string[]) {
		if (this.logTrace) {
			console.debug("=", this.getIndentation(), name, this.toString(), "⊢", ...body, "⊣", this.substitutionToString());
		}
		this.onLeafTrace?.(name, this.toString(), ...body);
	}

	protected getIndentation() {
		if (!this.indentation.has(this.traceDepth)) {
			this.indentation.set(this.traceDepth, Array.from({ length: this.traceDepth }, () => "  ").join(""));
		}
		return this.indentation.get(this.traceDepth)!;
	}

	protected substitutionToString(): string {
		const subsitutions: string[] = [];
		const substitutionIds = Array.from(this.substitution.keys());
		substitutionIds.sort();
		for (let i = 0; i < substitutionIds.length; i++) {
			const id = substitutionIds[i];
			const l = typeExpressionToString({ kind: TypeKind.UnificationVariable, id, level: -1 });
			const tau = this.substitution.get(id)!;
			const r = typeExpressionToString(tau);
			subsitutions.push(`${l} = ${r}`);
		}
		return "[" + subsitutions.join(", ") + "]";
	}

	protected contextToString(): string {
		return "[" + this.context.map(schemeToString).join(", ") + "]";
	}

	toString(): string {
		return this.substitutionToString() + " " + this.contextToString();
	}
}
