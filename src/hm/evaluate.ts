import { Abstraction, Expression, FreeVariable, Kind, UnitLiteral } from "./core";

type Value = UnitLiteral | FreeVariable | Abstraction;

// Call by value
export function evaluate(expr: Expression): Value {
	switch (expr.kind) {
		case Kind.UnitLiteral:
		case Kind.FreeVariable:
		case Kind.Abstraction:
			return expr;
		case Kind.Application: {
			const left = evaluate(expr.left);
			const right = evaluate(expr.right);
			if (left.kind === Kind.Abstraction) {
				// beta reduce
				return evaluate(substitute(0, left.body, right));
			}
			throw new Error("evalutation error");
		}
		case Kind.BoundVariable:
			throw new Error("evalutation error");
		case Kind.Let:
			return evaluate({ kind: Kind.Application, left: { kind: Kind.Abstraction, body: expr.body }, right: expr.expression });
	}
}

function substitute(index: number, inExpr: Expression, withValue: Value): Expression {
	switch (inExpr.kind) {
		case Kind.UnitLiteral:
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
		case Kind.Let:
			return {
				kind: Kind.Let,
				expression: substitute(index, inExpr.expression, withValue),
				body: substitute(index + 1, inExpr.body, withValue),
			};
	}
}
