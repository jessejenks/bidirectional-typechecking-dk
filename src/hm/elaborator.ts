import { createVariableName } from "../utils/names";
import * as core from "./core";
import * as surface from "./surface";

export function elaborate(expr: surface.Expression): core.Expression {
	return elaborateInner([], expr);
}

function elaborateInner(termVariables: string[], expr: surface.Expression): core.Expression {
	switch (expr.kind) {
		case surface.Kind.UnitLiteral:
			return { kind: core.Kind.UnitLiteral };
		case surface.Kind.IntLiteral:
			return { kind: core.Kind.IntLiteral, value: expr.value };
		case surface.Kind.Variable: {
			const level = termVariables.lastIndexOf(expr.name);
			if (level < 0) {
				return { kind: core.Kind.FreeVariable, name: expr.name };
			}
			return { kind: core.Kind.BoundVariable, index: termVariables.length - 1 - level };
		}
		case surface.Kind.Abstraction: {
			termVariables.push(expr.variable);
			const body = elaborateInner(termVariables, expr.body);
			termVariables.pop();
			return { kind: core.Kind.Abstraction, body };
		}
		case surface.Kind.Application:
			return {
				kind: core.Kind.Application,
				left: elaborateInner(termVariables, expr.left),
				right: elaborateInner(termVariables, expr.right),
			};
		case surface.Kind.Let:
			const expression = elaborateInner(termVariables, expr.expression);
			termVariables.push(expr.variable);
			const body = elaborateInner(termVariables, expr.body);
			termVariables.pop();
			return {
				kind: core.Kind.Let,
				expression,
				body,
			};
		case surface.Kind.Addition:
			return {
				kind: core.Kind.Addition,
				left: elaborateInner(termVariables, expr.left),
				right: elaborateInner(termVariables, expr.right),
			};
		case surface.Kind.Pair:
			return {
				kind: core.Kind.Pair,
				left: elaborateInner(termVariables, expr.left),
				right: elaborateInner(termVariables, expr.right),
			};
		case surface.Kind.Projection:
			return {
				kind: core.Kind.Projection,
				expression: elaborateInner(termVariables, expr.expression),
				side: expr.side,
			};
	}
}

export function unelaborate(expr: core.Expression): surface.Expression {
	return unelaborateInner(0, expr);
}

function unelaborateInner(depth: number, expr: core.Expression): surface.Expression {
	switch (expr.kind) {
		case core.Kind.UnitLiteral:
			return { kind: surface.Kind.UnitLiteral };
		case core.Kind.IntLiteral:
			return { kind: surface.Kind.IntLiteral, value: expr.value };
		case core.Kind.BoundVariable:
			return { kind: surface.Kind.Variable, name: createVariableName(depth - 1 - expr.index) };
		case core.Kind.FreeVariable:
			return { kind: surface.Kind.Variable, name: expr.name };
		case core.Kind.Abstraction:
			return { kind: surface.Kind.Abstraction, variable: createVariableName(depth), body: unelaborateInner(depth + 1, expr.body) };
		case core.Kind.Application:
			return { kind: surface.Kind.Application, left: unelaborateInner(depth, expr.left), right: unelaborateInner(depth, expr.right) };
		case core.Kind.Addition:
			return { kind: surface.Kind.Addition, left: unelaborateInner(depth, expr.left), right: unelaborateInner(depth, expr.right) };
		case core.Kind.Pair:
			return { kind: surface.Kind.Pair, left: unelaborateInner(depth, expr.left), right: unelaborateInner(depth, expr.right) };
		case core.Kind.Projection:
			return { kind: surface.Kind.Projection, expression: unelaborateInner(depth, expr.expression), side: expr.side };
		case core.Kind.Let:
			return {
				kind: surface.Kind.Let,
				variable: createVariableName(depth),
				expression: unelaborateInner(depth, expr.expression),
				body: unelaborateInner(depth + 1, expr.body),
			};
	}
}
