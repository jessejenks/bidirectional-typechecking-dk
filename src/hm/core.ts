import { createExistentialVariableName, createTypeVariableName } from "../utils/names";

export const enum Kind {
	// Terms
	UnitLiteral,
	BoundVariable,
	FreeVariable,
	Application,
	Abstraction,
	Let,
}

export type UnitLiteral = { kind: Kind.UnitLiteral };
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
export type Let = {
	kind: Kind.Let;
	expression: Expression;
	body: Expression;
};

export type Expression = UnitLiteral | BoundVariable | FreeVariable | Application | Abstraction | Let;

export function expressionToString(expr: Expression): string {
	switch (expr.kind) {
		case Kind.UnitLiteral:
			return "()";
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
		case Kind.Let:
			return `let = ${expressionToString(expr.expression)} in ${expressionToString(expr.body)}`;
	}
}

function shouldParenthesize(expr: Expression): boolean {
	switch (expr.kind) {
		case Kind.UnitLiteral:
		case Kind.BoundVariable:
		case Kind.FreeVariable:
			return false;
		case Kind.Application:
		case Kind.Abstraction:
		case Kind.Let:
			return true;
	}
}

export const enum TypeKind {
	UnitType,
	TypeVariable,
	UnificationVariable,
	ArrowType,
}

export type UnitType = { kind: TypeKind.UnitType };
export type TypeVariable = { kind: TypeKind.TypeVariable; level: number };
export type UnificationVariable = { kind: TypeKind.UnificationVariable; id: number; level: number };
export type ArrowType = { kind: TypeKind.ArrowType; left: TypeExpression; right: TypeExpression };
export type TypeExpression = UnitType | TypeVariable | UnificationVariable | ArrowType;

export function typeExpressionToString(tp: TypeExpression): string {
	switch (tp.kind) {
		case TypeKind.UnitType:
			return "1";
		case TypeKind.TypeVariable:
			return createTypeVariableName(tp.level);
		case TypeKind.UnificationVariable:
			return createExistentialVariableName(tp.id);
		case TypeKind.ArrowType:
			if (tp.left.kind === TypeKind.ArrowType) {
				return `(${typeExpressionToString(tp.left)}) → ${typeExpressionToString(tp.right)}`;
			}
			return `${typeExpressionToString(tp.left)} → ${typeExpressionToString(tp.right)}`;
	}
}
