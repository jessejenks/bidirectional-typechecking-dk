import { createExistentialVariableName, createTypeVariableName } from "../utils/names";

export const enum Kind {
	// Terms
	UnitLiteral,
	Variable,
	Abstraction,
	Application,
	AnnotatedExpression,
	AnnotatedAbstraction,
	// Types
	UnitType,
	TypeVariable,
	ExistentialTypeVariable,
	UniversalType,
	ArrowType,
}

export type UnitLiteral = { kind: Kind.UnitLiteral };
export type Variable = { kind: Kind.Variable; name: string };
export type Abstraction = {
	kind: Kind.Abstraction;
	variable: string;
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

// Extension
export type AnnotatedAbstraction = {
	kind: Kind.AnnotatedAbstraction;
	variable: string;
	annotation: TypeExpression;
	body: Expression;
};

export type Expression = UnitLiteral | Variable | Abstraction | Application | AnnotatedExpression | AnnotatedAbstraction;

export function expressionToString(expr: Expression): string {
	switch (expr.kind) {
		case Kind.UnitLiteral:
			return "()";
		case Kind.Variable:
			return expr.name;
		case Kind.Abstraction:
			return `λ${expr.variable}.${expressionToString(expr.body)}`;
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
			return `λ${expr.variable}:${typeExpressionToString(expr.annotation)}.${expressionToString(expr.body)}`;
	}
}

function shouldParenthesize(expr: Expression): boolean {
	switch (expr.kind) {
		case Kind.UnitLiteral:
		case Kind.Variable:
			return false;
		case Kind.Abstraction:
		case Kind.Application:
		case Kind.AnnotatedExpression:
		case Kind.AnnotatedAbstraction:
			return true;
	}
}

export type UnitType = { kind: Kind.UnitType };
export type TypeVariable = { kind: Kind.TypeVariable; name: string };
export type ExistentialTypeVariable = {
	kind: Kind.ExistentialTypeVariable;
	id: number;
};
export type UniversalType = {
	kind: Kind.UniversalType;
	variable: string;
	body: TypeExpression;
};
export type ArrowType = {
	kind: Kind.ArrowType;
	left: TypeExpression;
	right: TypeExpression;
};

export type TypeExpression = UnitType | TypeVariable | ExistentialTypeVariable | UniversalType | ArrowType;

export type Monotype =
	| UnitType
	| TypeVariable
	| ExistentialTypeVariable
	| {
			kind: Kind.ArrowType;
			left: Monotype;
			right: Monotype;
	  };

export function isMonotype(tp: TypeExpression): tp is Monotype {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.TypeVariable:
		case Kind.ExistentialTypeVariable:
			return true;
		case Kind.UniversalType:
			return false;
		case Kind.ArrowType:
			return isMonotype(tp.left) && isMonotype(tp.right);
	}
}

export function typeExpressionToString(tp: TypeExpression): string {
	switch (tp.kind) {
		case Kind.UnitType:
			return "1";
		case Kind.TypeVariable:
			return tp.name;
		case Kind.ExistentialTypeVariable:
			return createExistentialVariableName(tp.id);
		case Kind.UniversalType:
			return `(∀${tp.variable}.${typeExpressionToString(tp.body)})`;
		case Kind.ArrowType:
			if (tp.left.kind === Kind.ArrowType) {
				return `(${typeExpressionToString(tp.left)}) → ${typeExpressionToString(tp.right)}`;
			}
			return `${typeExpressionToString(tp.left)} → ${typeExpressionToString(tp.right)}`;
	}
}

export function collectFreeExistentialTypeVariables(tp: TypeExpression, free: Set<number>) {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.TypeVariable:
			return;
		case Kind.ExistentialTypeVariable:
			free.add(tp.id);
			return;
		case Kind.UniversalType:
			collectFreeExistentialTypeVariables(tp.body, free);
			return;
		case Kind.ArrowType:
			collectFreeExistentialTypeVariables(tp.left, free);
			collectFreeExistentialTypeVariables(tp.right, free);
			return;
	}
}

export function collectFreeTypeVariables(tp: TypeExpression, free: Set<string>) {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.ExistentialTypeVariable:
			return;
		case Kind.TypeVariable:
			free.add(tp.name);
			return;
		case Kind.UniversalType:
			collectFreeTypeVariables(tp.body, free);
			return;
		case Kind.ArrowType:
			collectFreeTypeVariables(tp.left, free);
			collectFreeTypeVariables(tp.right, free);
			return;
	}
}

export function collectBoundTypeVariables(tp: TypeExpression, bound: Set<string>) {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.TypeVariable:
		case Kind.ExistentialTypeVariable:
			return;
		case Kind.UniversalType:
			bound.add(tp.variable);
			collectBoundTypeVariables(tp.body, bound);
			return;
		case Kind.ArrowType:
			collectBoundTypeVariables(tp.left, bound);
			collectBoundTypeVariables(tp.right, bound);
			return;
	}
}

export function substituteType(name: string, withType: TypeExpression, inType: TypeExpression): TypeExpression {
	switch (inType.kind) {
		case Kind.UnitType:
		case Kind.ExistentialTypeVariable:
			return inType;
		case Kind.TypeVariable:
			if (inType.name === name) {
				return withType;
			}
			return inType;
		case Kind.UniversalType:
			if (inType.variable === name) {
				return inType;
			}
			return {
				kind: Kind.UniversalType,
				variable: inType.variable,
				body: substituteType(name, withType, inType.body),
			};
		case Kind.ArrowType:
			return {
				kind: Kind.ArrowType,
				left: substituteType(name, withType, inType.left),
				right: substituteType(name, withType, inType.right),
			};
	}
}

export function occursCheck(existential: ExistentialTypeVariable, tp: TypeExpression): boolean {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.TypeVariable:
			return false;
		case Kind.ExistentialTypeVariable:
			return tp.id === existential.id;
		case Kind.UniversalType:
			return occursCheck(existential, tp.body);
		case Kind.ArrowType:
			return occursCheck(existential, tp.left) || occursCheck(existential, tp.right);
	}
}

export function generalize(tp: TypeExpression): TypeExpression {
	const usedNames = new Set<string>();
	collectBoundTypeVariables(tp, usedNames);

	const freeExVars = new Set<number>();
	collectFreeExistentialTypeVariables(tp, freeExVars);

	const nameMap = new Map<number, string>();
	const names: string[] = [];
	let candidate = 0;
	for (const id of freeExVars) {
		let name = createTypeVariableName(candidate);
		while (usedNames.has(name)) {
			name = createTypeVariableName(++candidate);
		}
		nameMap.set(id, name);
		names.push(name);
		candidate++;
	}

	const body = generalizeInner(tp, nameMap);
	let curr = body;
	for (let i = names.length - 1; i >= 0; i--) {
		curr = {
			kind: Kind.UniversalType,
			variable: names[i],
			body: curr,
		};
	}
	return curr;
}

function generalizeInner(tp: TypeExpression, nameMap: Map<number, string>): TypeExpression {
	switch (tp.kind) {
		case Kind.UnitType:
		case Kind.TypeVariable:
			return tp;
		case Kind.ExistentialTypeVariable:
			return {
				kind: Kind.TypeVariable,
				name: nameMap.get(tp.id)!,
			};
		case Kind.UniversalType:
			return {
				kind: Kind.UniversalType,
				variable: tp.variable,
				body: generalizeInner(tp.body, nameMap),
			};
		case Kind.ArrowType:
			return {
				kind: Kind.ArrowType,
				left: generalizeInner(tp.left, nameMap),
				right: generalizeInner(tp.right, nameMap),
			};
	}
}

export function miniscope(tp: TypeExpression): TypeExpression {
	if (tp.kind !== Kind.UniversalType) {
		return tp;
	}

	const vars: string[] = [];
	let body: TypeExpression = tp;
	while (body.kind === Kind.UniversalType) {
		vars.push(body.variable);
		body = body.body;
	}

	// ∀α.(A → T(α)) => A → (∀α.T(α)), if α does not appear in A and T(α) != α
	// semantically this is just currying f : ∀α.(A → T(α)) => λx:A.f(x) : A → ∀α.T(α)
	if (body.kind === Kind.ArrowType && body.right.kind !== Kind.TypeVariable) {
		const leftVars: string[] = [];
		const rightVars: string[] = [];

		for (let i = 0; i < vars.length; i++) {
			if (appearsIn(vars[i], body.left)) {
				leftVars.push(vars[i]);
			} else {
				rightVars.push(vars[i]);
			}
		}

		let right = rightVars.reduceRight((body, variable): TypeExpression => ({ kind: Kind.UniversalType, variable, body }), body.right);
		right = miniscope(right);

		return leftVars.reduceRight((acc, variable): TypeExpression => ({ kind: Kind.UniversalType, variable, body: acc }), {
			kind: Kind.ArrowType,
			left: body.left,
			right,
		});
	}

	return vars.reduceRight((body, variable): TypeExpression => ({ kind: Kind.UniversalType, variable, body }), miniscope(body));
}

function appearsIn(name: string, tp: TypeExpression): boolean {
	switch (tp.kind) {
		case Kind.UnitType:
			return false;
		case Kind.TypeVariable:
			return name === tp.name;
		case Kind.ExistentialTypeVariable:
			return false;
		case Kind.UniversalType:
			if (tp.variable === name) {
				return false;
			}
			return appearsIn(name, tp.body);
		case Kind.ArrowType:
			return appearsIn(name, tp.left) || appearsIn(name, tp.right);
	}
}
