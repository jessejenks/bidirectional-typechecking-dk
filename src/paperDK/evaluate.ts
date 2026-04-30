import { Abstraction, Expression, IntLiteral, Kind, Pair, UnitLiteral, Variable } from "./ast";

type Value = UnitLiteral | IntLiteral | Variable | Abstraction | Pair;

// Call by value
export function evaluate(expr: Expression): Value {
	switch (expr.kind) {
		case Kind.UnitLiteral:
		case Kind.IntLiteral:
		case Kind.Variable:
		case Kind.Abstraction:
			return expr;
		case Kind.AnnotatedAbstraction:
			return { kind: Kind.Abstraction, variable: expr.variable, body: expr.body };
		case Kind.AnnotatedExpression:
			return evaluate(expr.body);
		case Kind.Application: {
			const left = evaluate(expr.left);
			const right = evaluate(expr.right);
			if (left.kind === Kind.Abstraction) {
				// beta reduce
				return evaluate(substitute(left.variable, left.body, right));
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

function substitute(variable: string, inExpr: Expression, withValue: Value): Expression {
	switch (inExpr.kind) {
		case Kind.UnitLiteral:
		case Kind.IntLiteral:
			return inExpr;
		case Kind.Variable:
			if (inExpr.name === variable) {
				return withValue;
			}
			return inExpr;
		case Kind.Abstraction:
			if (inExpr.variable === variable) {
				return inExpr;
			}
			return { kind: Kind.Abstraction, variable: inExpr.variable, body: substitute(variable, inExpr.body, withValue) };
		case Kind.Application:
			return {
				kind: Kind.Application,
				left: substitute(variable, inExpr.left, withValue),
				right: substitute(variable, inExpr.right, withValue),
			};
		case Kind.AnnotatedExpression:
		case Kind.AnnotatedAbstraction:
			return substitute(variable, inExpr.body, withValue);
		case Kind.Addition:
			return {
				kind: Kind.Addition,
				left: substitute(variable, inExpr.left, withValue),
				right: substitute(variable, inExpr.right, withValue),
			};
		case Kind.Pair:
			return {
				kind: Kind.Pair,
				left: substitute(variable, inExpr.left, withValue),
				right: substitute(variable, inExpr.right, withValue),
			};
	}
}
