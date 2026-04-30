import { Abstraction, Expression, FreeVariable, IntLiteral, Kind, Pair, UnitLiteral } from "./core";

type Value = UnitLiteral | IntLiteral | FreeVariable | Abstraction | Pair;

// Call by value
export function evaluate(expr: Expression): Value {
	switch (expr.kind) {
		case Kind.UnitLiteral:
		case Kind.IntLiteral:
		case Kind.FreeVariable:
		case Kind.Abstraction:
			return expr;
		case Kind.BoundVariable:
			throw new Error("evalutation error");
		case Kind.AnnotatedAbstraction:
			return { kind: Kind.Abstraction, body: expr.body };
		case Kind.AnnotatedExpression:
			return evaluate(expr.body);
		case Kind.Application: {
			const left = evaluate(expr.left);
			const right = evaluate(expr.right);
			if (left.kind === Kind.Abstraction) {
				// beta reduce
				return evaluate(substitute(0, left.body, right));
			}
			throw new Error("evalutation error");
		}
		case Kind.Addition: {
			const left = evaluate(expr.left);
			if (left.kind !== Kind.IntLiteral) {
				throw new Error("evalutation error");
			}
			const right = evaluate(expr.right);
			if (right.kind !== Kind.IntLiteral) {
				throw new Error("evalutation error");
			}
			return { kind: Kind.IntLiteral, value: left.value + right.value };
		}
		case Kind.Pair:
			return { kind: Kind.Pair, left: evaluate(expr.left), right: evaluate(expr.right) };
	}
}

function substitute(index: number, inExpr: Expression, withValue: Value): Expression {
	switch (inExpr.kind) {
		case Kind.UnitLiteral:
		case Kind.IntLiteral:
		case Kind.FreeVariable:
			return inExpr;
		case Kind.BoundVariable:
			if (inExpr.index === index) {
				return withValue;
			}
			return inExpr;
		case Kind.Abstraction:
			return { kind: Kind.Abstraction, body: substitute(index + 1, inExpr.body, withValue) };
		case Kind.Application:
			return {
				kind: Kind.Application,
				left: substitute(index, inExpr.left, withValue),
				right: substitute(index, inExpr.right, withValue),
			};
		case Kind.AnnotatedExpression:
		case Kind.AnnotatedAbstraction:
			return substitute(index, inExpr.body, withValue);
		case Kind.Addition:
			return {
				kind: Kind.Addition,
				left: substitute(index, inExpr.left, withValue),
				right: substitute(index, inExpr.right, withValue),
			};
		case Kind.Pair:
			return {
				kind: Kind.Pair,
				left: substitute(index, inExpr.left, withValue),
				right: substitute(index, inExpr.right, withValue),
			};
	}
}
