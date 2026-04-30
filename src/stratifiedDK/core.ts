import { createExistentialVariableName, createTypeVariableName } from "../utils/names";

export const enum Kind {
	// Terms
	UnitLiteral,
	IntLiteral,
	BoundVariable,
	FreeVariable,
	Abstraction,
	Application,
	AnnotatedExpression,
	AnnotatedAbstraction,
	Addition,
	Pair,
	// Types
	UnitType,
	IntType,
	BoundTypeVariable,
	FreeTypeVariable,
	ExistentialTypeVariable,
	UniversalType,
	ArrowType,
	ProductType,
}

export type UnitLiteral = { kind: Kind.UnitLiteral };
export type BoundVariable = { kind: Kind.BoundVariable; index: number };
export type FreeVariable = { kind: Kind.FreeVariable; name: string };
export type Abstraction = {
	kind: Kind.Abstraction;
	body: Expression;
};
export type Application = {
	kind: Kind.Application;
	left: Expression;
	right: Expression;
};
export type AnnotatedExpression = {
	kind: Kind.AnnotatedExpression;
	body: Expression;
	annotation: TypeExpression;
};

// Extensions
export type IntLiteral = { kind: Kind.IntLiteral; value: number };
export type AnnotatedAbstraction = {
	kind: Kind.AnnotatedAbstraction;
	annotation: TypeExpression;
	body: Expression;
};
export type Addition = {
	kind: Kind.Addition;
	left: Expression;
	right: Expression;
};
export type Pair = {
	kind: Kind.Pair;
	left: Expression;
	right: Expression;
};

export type Expression =
	| UnitLiteral
	| IntLiteral
	| BoundVariable
	| FreeVariable
	| Abstraction
	| Application
	| AnnotatedExpression
	| AnnotatedAbstraction
	| Addition
	| Pair;

export function expressionToString(expr: Expression): string {
	switch (expr.kind) {
		case Kind.UnitLiteral:
			return "()";
		case Kind.IntLiteral:
			return expr.value.toString();
		case Kind.BoundVariable:
			return expr.index.toString();
		case Kind.FreeVariable:
			return expr.name;
		case Kind.Abstraction:
			return `λ.${expressionToString(expr.body)}`;
		case Kind.Application: {
			const shouldParenLeft = shouldParenthesize(expr.left);
			const shouldParenRight = shouldParenthesize(expr.right);
			if (shouldParenLeft && shouldParenRight) {
				return `(${expressionToString(expr.left)}) (${expressionToString(expr.right)})`;
			}
			if (shouldParenLeft) {
				return `(${expressionToString(expr.left)}) ${expressionToString(expr.right)}`;
			}
			if (shouldParenRight) {
				return `${expressionToString(expr.left)} (${expressionToString(expr.right)})`;
			}
			return `${expressionToString(expr.left)} ${expressionToString(expr.right)}`;
		}
		case Kind.AnnotatedExpression:
			return `(${expressionToString(expr.body)}) : ${typeExpressionToString(expr.annotation)}`;
		case Kind.AnnotatedAbstraction:
			return `λ${typeExpressionToString(expr.annotation)}.${expressionToString(expr.body)}`;
		case Kind.Addition:
			return `${expressionToString(expr.left)} + ${expressionToString(expr.right)}`;
		case Kind.Pair:
			return `<${expressionToString(expr.left)}, ${expressionToString(expr.right)}>`;
	}
}

function shouldParenthesize(expr: Expression): boolean {
	switch (expr.kind) {
		case Kind.UnitLiteral:
		case Kind.IntLiteral:
		case Kind.BoundVariable:
		case Kind.FreeVariable:
		case Kind.Pair:
			return false;
		case Kind.Abstraction:
		case Kind.Application:
		case Kind.AnnotatedExpression:
		case Kind.AnnotatedAbstraction:
		case Kind.Addition:
			return true;
	}
}

export type UnitType = { kind: Kind.UnitType };
export type BoundTypeVariable = { kind: Kind.BoundTypeVariable; level: number };
export type FreeTypeVariable = { kind: Kind.FreeTypeVariable; name: string };
export type ExistentialTypeVariable = {
	kind: Kind.ExistentialTypeVariable;
	id: number;
	depth: number;
};
export type UniversalType = {
	kind: Kind.UniversalType;
	bindingDepth: number;
	body: TypeExpression;
};
export type ArrowType = {
	kind: Kind.ArrowType;
	left: TypeExpression;
	right: TypeExpression;
};

// Extensions
export type IntType = { kind: Kind.IntType };
export type ProductType = {
	kind: Kind.ProductType;
	left: TypeExpression;
	right: TypeExpression;
};

export type TypeExpression =
	| UnitType
	| IntType
	| BoundTypeVariable
	| FreeTypeVariable
	| ExistentialTypeVariable
	| UniversalType
	| ArrowType
	| ProductType;

export type Monotype =
	| UnitType
	| IntType
	| BoundTypeVariable
	| ExistentialTypeVariable
	| {
			kind: Kind.ArrowType;
			left: Monotype;
			right: Monotype;
	  }
	| {
			kind: Kind.ProductType;
			left: Monotype;
			right: Monotype;
	  };

export function isMonotype(tp: TypeExpression): tp is Monotype {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.IntType:
		case Kind.BoundTypeVariable:
		case Kind.ExistentialTypeVariable:
			return true;
		case Kind.FreeTypeVariable: // technically could be?
		case Kind.UniversalType:
			return false;
		case Kind.ArrowType:
		case Kind.ProductType:
			return isMonotype(tp.left) && isMonotype(tp.right);
	}
}

export function typeExpressionToString(tp: TypeExpression): string {
	switch (tp.kind) {
		case Kind.UnitType:
			return "Unit";
		case Kind.IntType:
			return "Int";
		case Kind.BoundTypeVariable:
			return createTypeVariableName(tp.level);
		case Kind.FreeTypeVariable:
			return tp.name;
		case Kind.ExistentialTypeVariable:
			return createExistentialVariableName(tp.id);
		case Kind.UniversalType:
			return `(∀.${typeExpressionToString(tp.body)})`;
		case Kind.ArrowType:
			if (tp.left.kind === Kind.ArrowType) {
				return `(${typeExpressionToString(tp.left)}) → ${typeExpressionToString(tp.right)}`;
			}
			return `${typeExpressionToString(tp.left)} → ${typeExpressionToString(tp.right)}`;
		case Kind.ProductType: {
			const parenLeft = tp.left.kind === Kind.ArrowType;
			const parenRight = tp.right.kind === Kind.ArrowType;
			if (parenLeft && parenRight) {
				return `(${typeExpressionToString(tp.left)}) × (${typeExpressionToString(tp.right)})`;
			}
			if (parenLeft) {
				return `(${typeExpressionToString(tp.left)}) × ${typeExpressionToString(tp.right)}`;
			}
			if (parenRight) {
				return `${typeExpressionToString(tp.left)} × (${typeExpressionToString(tp.right)})`;
			}
			return `${typeExpressionToString(tp.left)} × ${typeExpressionToString(tp.right)}`;
		}
	}
}

export function collectFreeExistentialTypeVariables(tp: TypeExpression, free: Set<number>) {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.IntType:
		case Kind.BoundTypeVariable:
			return;
		case Kind.ExistentialTypeVariable:
			free.add(tp.id);
			return;
		case Kind.UniversalType:
			collectFreeExistentialTypeVariables(tp.body, free);
			return;
		case Kind.ArrowType:
		case Kind.ProductType:
			collectFreeExistentialTypeVariables(tp.left, free);
			collectFreeExistentialTypeVariables(tp.right, free);
			return;
	}
}

export function occursCheck(existential: ExistentialTypeVariable, tp: TypeExpression): boolean {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.IntType:
		case Kind.BoundTypeVariable:
		case Kind.FreeTypeVariable:
			return false;
		case Kind.ExistentialTypeVariable:
			return tp.id === existential.id;
		case Kind.UniversalType:
			return occursCheck(existential, tp.body);
		case Kind.ArrowType:
		case Kind.ProductType:
			return occursCheck(existential, tp.left) || occursCheck(existential, tp.right);
	}
}

export function open(level: number, tp: TypeExpression, replacement: TypeExpression): TypeExpression {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.IntType:
		case Kind.FreeTypeVariable: // TODO
		case Kind.ExistentialTypeVariable:
			return tp;
		case Kind.BoundTypeVariable:
			if (tp.level === level) {
				return replacement;
			}
			return tp;
		case Kind.UniversalType:
			return { kind: Kind.UniversalType, bindingDepth: tp.bindingDepth, body: open(level, tp.body, replacement) };
		case Kind.ArrowType:
			return {
				kind: Kind.ArrowType,
				left: open(level, tp.left, replacement),
				right: open(level, tp.right, replacement),
			};
		case Kind.ProductType:
			return {
				kind: Kind.ProductType,
				left: open(level, tp.left, replacement),
				right: open(level, tp.right, replacement),
			};
	}
}

export function generalize(tp: TypeExpression): TypeExpression {
	const free = new Set<number>();
	collectFreeExistentialTypeVariables(tp, free);
	const idToLevel = new Map<number, number>();
	let nextLevel = 0;
	for (const id of free) {
		idToLevel.set(id, nextLevel++);
	}
	let body = generalizeInner(shiftBoundTypeVariables(tp, free.size), idToLevel);
	for (let i = free.size - 1; i >= 0; i--) {
		body = { kind: Kind.UniversalType, bindingDepth: i, body };
	}
	return body;
}

function generalizeInner(tp: TypeExpression, idToLevel: Map<number, number>): TypeExpression {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.IntType:
		case Kind.BoundTypeVariable:
		case Kind.FreeTypeVariable:
			return tp;
		case Kind.ExistentialTypeVariable: {
			const level = idToLevel.get(tp.id);
			if (level === undefined) {
				return tp;
			}
			return { kind: Kind.BoundTypeVariable, level: level };
		}
		case Kind.UniversalType:
			return { kind: Kind.UniversalType, bindingDepth: tp.bindingDepth, body: generalizeInner(tp.body, idToLevel) };
		case Kind.ArrowType:
			return {
				kind: Kind.ArrowType,
				left: generalizeInner(tp.left, idToLevel),
				right: generalizeInner(tp.right, idToLevel),
			};
		case Kind.ProductType:
			return {
				kind: Kind.ProductType,
				left: generalizeInner(tp.left, idToLevel),
				right: generalizeInner(tp.right, idToLevel),
			};
	}
}

function shiftBoundTypeVariables(tp: TypeExpression, amount: number): TypeExpression {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.IntType:
		case Kind.FreeTypeVariable:
		case Kind.ExistentialTypeVariable:
			return tp;
		case Kind.BoundTypeVariable:
			return { kind: Kind.BoundTypeVariable, level: tp.level + amount };
		case Kind.UniversalType:
			return { kind: Kind.UniversalType, bindingDepth: tp.bindingDepth + amount, body: shiftBoundTypeVariables(tp.body, amount) };
		case Kind.ArrowType:
			return {
				kind: Kind.ArrowType,
				left: shiftBoundTypeVariables(tp.left, amount),
				right: shiftBoundTypeVariables(tp.right, amount),
			};
		case Kind.ProductType:
			return {
				kind: Kind.ProductType,
				left: shiftBoundTypeVariables(tp.left, amount),
				right: shiftBoundTypeVariables(tp.right, amount),
			};
	}
}

export function miniscope(tp: TypeExpression): TypeExpression {
	if (tp.kind !== Kind.UniversalType) {
		return tp;
	}

	const depths: number[] = [];
	let body: TypeExpression = tp;
	while (body.kind === Kind.UniversalType) {
		depths.push(body.bindingDepth);
		body = body.body;
	}

	// ∀α.(A → T(α)) => A → (∀α.T(α)), if α does not appear in A and T(α) != α
	// semantically this is just currying f : ∀α.(A → T(α)) => λx:A.f(x) : A → ∀α.T(α)
	if (body.kind === Kind.ArrowType && body.right.kind !== Kind.BoundTypeVariable) {
		const leftVars: number[] = [];
		const rightVars: number[] = [];

		for (let i = 0; i < depths.length; i++) {
			if (appearsIn(depths[i], body.left)) {
				leftVars.push(depths[i]);
			} else {
				rightVars.push(depths[i]);
			}
		}

		let right = rightVars.reduceRight(
			(body, bindingDepth): TypeExpression => ({ kind: Kind.UniversalType, bindingDepth, body }),
			body.right,
		);
		right = miniscope(right);

		return leftVars.reduceRight((body, bindingDepth): TypeExpression => ({ kind: Kind.UniversalType, bindingDepth, body }), {
			kind: Kind.ArrowType,
			left: body.left,
			right,
		});
	}

	if (body.kind === Kind.ProductType && !(body.left.kind === Kind.BoundTypeVariable && body.right.kind === Kind.BoundTypeVariable)) {
		const leftVars: number[] = [];
		const rightVars: number[] = [];

		for (let i = 0; i < depths.length; i++) {
			if (appearsIn(i, body.left)) {
				leftVars.push(depths[i]);
			} else {
				rightVars.push(depths[i]);
			}
		}

		if (body.left.kind === Kind.BoundTypeVariable) {
			let right = rightVars.reduceRight(
				(body, bindingDepth): TypeExpression => ({ kind: Kind.UniversalType, bindingDepth, body }),
				body.right,
			);
			right = miniscope(right);
			return leftVars.reduceRight((acc, bindingDepth): TypeExpression => ({ kind: Kind.UniversalType, bindingDepth, body: acc }), {
				kind: Kind.ProductType,
				left: body.left,
				right,
			});
		} else if (body.right.kind === Kind.BoundTypeVariable) {
			let left = leftVars.reduceRight(
				(body, bindingDepth): TypeExpression => ({ kind: Kind.UniversalType, bindingDepth, body }),
				body.left,
			);
			left = miniscope(left);
			return rightVars.reduceRight((acc, bindingDepth): TypeExpression => ({ kind: Kind.UniversalType, bindingDepth, body: acc }), {
				kind: Kind.ProductType,
				left,
				right: body.right,
			});
		} else {
			let left = leftVars.reduceRight(
				(body, bindingDepth): TypeExpression => ({ kind: Kind.UniversalType, bindingDepth, body }),
				body.left,
			);
			left = miniscope(left);

			let right = rightVars.reduceRight(
				(body, bindingDepth): TypeExpression => ({ kind: Kind.UniversalType, bindingDepth, body }),
				body.right,
			);
			right = miniscope(right);

			return {
				kind: Kind.ProductType,
				left,
				right,
			};
		}
	}

	return depths.reduceRight((body, bindingDepth): TypeExpression => ({ kind: Kind.UniversalType, bindingDepth, body }), miniscope(body));
}

function appearsIn(level: number, tp: TypeExpression): boolean {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.IntType:
		case Kind.FreeTypeVariable:
			return false;
		case Kind.BoundTypeVariable:
			return level === tp.level;
		case Kind.ExistentialTypeVariable:
			return false;
		case Kind.UniversalType:
			return appearsIn(level, tp.body);
		case Kind.ArrowType:
		case Kind.ProductType:
			return appearsIn(level, tp.left) || appearsIn(level, tp.right);
	}
}
