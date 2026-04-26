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

export type TypeExpression = UnitType | TypeVariable | UniversalType | ArrowType;

export function typeExpressionToString(tp: TypeExpression): string {
	switch (tp.kind) {
		case Kind.UnitType:
			return "1";
		case Kind.TypeVariable:
			return tp.name;
		case Kind.UniversalType:
			return `(∀${tp.variable}.${typeExpressionToString(tp.body)})`;
		case Kind.ArrowType:
			if (tp.left.kind === Kind.ArrowType) {
				return `(${typeExpressionToString(tp.left)}) → ${typeExpressionToString(tp.right)}`;
			}
			return `${typeExpressionToString(tp.left)} → ${typeExpressionToString(tp.right)}`;
	}
}
