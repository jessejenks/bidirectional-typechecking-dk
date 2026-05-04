export const enum Kind {
	// Terms
	UnitLiteral,
	IntLiteral,
	Variable,
	Abstraction,
	Application,
	AnnotatedExpression,
	AnnotatedAbstraction,
	Addition,
	Pair,
	Projection,
	// Types
	UnitType,
	IntType,
	TypeVariable,
	UniversalType,
	ArrowType,
	ProductType,
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

// Extensions
export type IntLiteral = { kind: Kind.IntLiteral; value: number };
export type AnnotatedAbstraction = {
	kind: Kind.AnnotatedAbstraction;
	variable: string;
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
export type Projection = {
	kind: Kind.Projection;
	expression: Expression;
	side: "fst" | "snd";
};

export type Expression =
	| UnitLiteral
	| IntLiteral
	| Variable
	| Abstraction
	| Application
	| AnnotatedExpression
	| AnnotatedAbstraction
	| Addition
	| Pair
	| Projection;

export function expressionToString(expr: Expression): string {
	switch (expr.kind) {
		case Kind.UnitLiteral:
			return "()";
		case Kind.IntLiteral:
			return expr.value.toString();
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
		case Kind.Addition:
			return `${expressionToString(expr.left)} + ${expressionToString(expr.right)}`;
		case Kind.Pair:
			return `<${expressionToString(expr.left)}, ${expressionToString(expr.right)}>`;
		case Kind.Projection:
			return `${expr.side}(${expressionToString(expr.expression)})`;
	}
}

function shouldParenthesize(expr: Expression): boolean {
	switch (expr.kind) {
		case Kind.UnitLiteral:
		case Kind.IntLiteral:
		case Kind.Variable:
		case Kind.Pair:
		case Kind.Projection:
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

// Extensions
export type IntType = { kind: Kind.IntType };
export type ProductType = {
	kind: Kind.ProductType;
	left: TypeExpression;
	right: TypeExpression;
};

export type TypeExpression = UnitType | IntType | TypeVariable | UniversalType | ArrowType | ProductType;

export function typeExpressionToString(tp: TypeExpression): string {
	switch (tp.kind) {
		case Kind.UnitType:
			return "Unit";
		case Kind.IntType:
			return "Int";
		case Kind.TypeVariable:
			return tp.name;
		case Kind.UniversalType:
			return `(∀${tp.variable}.${typeExpressionToString(tp.body)})`;
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
