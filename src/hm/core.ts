import { createExistentialVariableName, createTypeVariableName } from "../utils/names";

export const enum Kind {
	// Terms
	UnitLiteral,
	IntLiteral,
	BoundVariable,
	FreeVariable,
	Application,
	Abstraction,
	Addition,
	Pair,
	Projection,
	Let,
}

export type UnitLiteral = { kind: Kind.UnitLiteral };
export type IntLiteral = { kind: Kind.IntLiteral; value: number };
export type BoundVariable = { kind: Kind.BoundVariable; index: number };
export type FreeVariable = { kind: Kind.FreeVariable; name: string };
export type Application = {
	kind: Kind.Application;
	left: Expression;
	right: Expression;
};
export type Abstraction = {
	kind: Kind.Abstraction;
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
export type Let = {
	kind: Kind.Let;
	expression: Expression;
	body: Expression;
};

export type Expression =
	| UnitLiteral
	| IntLiteral
	| BoundVariable
	| FreeVariable
	| Application
	| Abstraction
	| Addition
	| Pair
	| Projection
	| Let;

export function expressionToString(expr: Expression): string {
	switch (expr.kind) {
		case Kind.UnitLiteral:
			return "()";
		case Kind.IntLiteral:
			return expr.value.toString();
		case Kind.BoundVariable:
			return `${expr.index}`;
		case Kind.FreeVariable:
			return expr.name;
		case Kind.Application: {
			const shouldParenLeft = shouldParenthesize(expr.left);
			const shouldParenRight = shouldParenthesize(expr.right);
			const leftString = expressionToString(expr.left);
			const rightString = expressionToString(expr.right);
			if (shouldParenLeft && shouldParenRight) {
				return `(${leftString}) (${rightString})`;
			}
			if (shouldParenLeft) {
				return `(${leftString}) ${rightString}`;
			}
			if (shouldParenRight) {
				return `${leftString} (${rightString})`;
			}
			return `${leftString} ${rightString}`;
		}
		case Kind.Abstraction:
			return `λ.${expressionToString(expr.body)}`;
		case Kind.Addition:
			return `${expressionToString(expr.left)} + ${expressionToString(expr.right)}`;
		case Kind.Pair:
			return `<${expressionToString(expr.left)}, ${expressionToString(expr.right)}>`;
		case Kind.Projection:
			return `${expr.side}(${expressionToString(expr.expression)})`;
		case Kind.Let:
			return `let = ${expressionToString(expr.expression)} in ${expressionToString(expr.body)}`;
	}
}

function shouldParenthesize(expr: Expression): boolean {
	switch (expr.kind) {
		case Kind.UnitLiteral:
		case Kind.IntLiteral:
		case Kind.BoundVariable:
		case Kind.FreeVariable:
		case Kind.Pair:
		case Kind.Projection:
			return false;
		case Kind.Application:
		case Kind.Abstraction:
		case Kind.Addition:
		case Kind.Let:
			return true;
	}
}

export const enum TypeKind {
	UnitType,
	IntType,
	TypeVariable,
	UnificationVariable,
	ArrowType,
	ProductType,
}

export type UnitType = { kind: TypeKind.UnitType };
export type IntType = { kind: TypeKind.IntType };
export type TypeVariable = { kind: TypeKind.TypeVariable; level: number };
export type UnificationVariable = { kind: TypeKind.UnificationVariable; id: number; level: number };
export type ArrowType = { kind: TypeKind.ArrowType; left: TypeExpression; right: TypeExpression };
export type ProductType = { kind: TypeKind.ProductType; left: TypeExpression; right: TypeExpression };
export type TypeExpression = UnitType | IntType | TypeVariable | UnificationVariable | ArrowType | ProductType;

export function typeExpressionToString(tp: TypeExpression): string {
	switch (tp.kind) {
		case TypeKind.UnitType:
			return "Unit";
		case TypeKind.IntType:
			return "Int";
		case TypeKind.TypeVariable:
			return createTypeVariableName(tp.level);
		case TypeKind.UnificationVariable:
			return createExistentialVariableName(tp.id);
		case TypeKind.ArrowType:
			if (tp.left.kind === TypeKind.ArrowType) {
				return `(${typeExpressionToString(tp.left)}) → ${typeExpressionToString(tp.right)}`;
			}
			return `${typeExpressionToString(tp.left)} → ${typeExpressionToString(tp.right)}`;
		case TypeKind.ProductType:
			return `${typeExpressionToString(tp.left)} × ${typeExpressionToString(tp.right)}`;
	}
}
