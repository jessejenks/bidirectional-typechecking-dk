import { createExistentialVariableName, createTypeVariableName, createVariableName } from "../utils/names";
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
		case surface.Kind.AnnotatedExpression:
			return {
				kind: core.Kind.AnnotatedExpression,
				body: elaborateInner(termVariables, expr.body),
				annotation: elaborateType(expr.annotation),
			};
		case surface.Kind.AnnotatedAbstraction: {
			termVariables.push(expr.variable);
			const body = elaborateInner(termVariables, expr.body);
			termVariables.pop();
			const annotation = elaborateType(expr.annotation);
			return { kind: core.Kind.AnnotatedAbstraction, annotation, body };
		}
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
	}
}

export function elaborateType(tp: surface.TypeExpression): core.TypeExpression {
	return elaborateTypeInner([], tp);
}

function elaborateTypeInner(typeVariables: string[], tp: surface.TypeExpression): core.TypeExpression {
	switch (tp.kind) {
		case surface.Kind.UnitType:
			return { kind: core.Kind.UnitType };
		case surface.Kind.IntType:
			return { kind: core.Kind.IntType };
		case surface.Kind.TypeVariable: {
			const level = typeVariables.lastIndexOf(tp.name);
			if (level < 0) {
				return { kind: core.Kind.FreeTypeVariable, name: tp.name };
			}
			return { kind: core.Kind.BoundTypeVariable, level: level };
		}
		case surface.Kind.UniversalType: {
			typeVariables.push(tp.variable);
			const etp: core.TypeExpression = {
				kind: core.Kind.UniversalType,
				bindingDepth: typeVariables.length - 1,
				body: elaborateTypeInner(typeVariables, tp.body),
			};
			typeVariables.pop();
			return etp;
		}
		case surface.Kind.ArrowType:
			return {
				kind: core.Kind.ArrowType,
				left: elaborateTypeInner(typeVariables, tp.left),
				right: elaborateTypeInner(typeVariables, tp.right),
			};
		case surface.Kind.ProductType:
			return {
				kind: core.Kind.ProductType,
				left: elaborateTypeInner(typeVariables, tp.left),
				right: elaborateTypeInner(typeVariables, tp.right),
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
		case core.Kind.AnnotatedExpression:
			return {
				kind: surface.Kind.AnnotatedExpression,
				body: unelaborateInner(depth, expr.body),
				annotation: unelaborateType(expr.annotation),
			};
		case core.Kind.AnnotatedAbstraction:
			return {
				kind: surface.Kind.AnnotatedAbstraction,
				variable: createVariableName(depth),
				annotation: unelaborateType(expr.annotation),
				body: unelaborateInner(depth + 1, expr.body),
			};
		case core.Kind.Addition:
			return { kind: surface.Kind.Addition, left: unelaborateInner(depth, expr.left), right: unelaborateInner(depth, expr.right) };
		case core.Kind.Pair:
			return { kind: surface.Kind.Pair, left: unelaborateInner(depth, expr.left), right: unelaborateInner(depth, expr.right) };
	}
}

export function unelaborateType(tp: core.TypeExpression): surface.TypeExpression {
	return unelaborateTypeInner(0, tp);
}

function unelaborateTypeInner(depth: number, tp: core.TypeExpression): surface.TypeExpression {
	switch (tp.kind) {
		case core.Kind.UnitType:
			return { kind: surface.Kind.UnitType };
		case core.Kind.IntType:
			return { kind: surface.Kind.IntType };
		case core.Kind.BoundTypeVariable:
			return { kind: surface.Kind.TypeVariable, name: createTypeVariableName(tp.level) };
		case core.Kind.FreeTypeVariable:
			return { kind: surface.Kind.TypeVariable, name: tp.name };
		case core.Kind.ExistentialTypeVariable:
			return { kind: surface.Kind.TypeVariable, name: createExistentialVariableName(tp.depth) };
		case core.Kind.UniversalType:
			return {
				kind: surface.Kind.UniversalType,
				variable: createTypeVariableName(depth),
				body: unelaborateTypeInner(depth + 1, tp.body),
			};
		case core.Kind.ArrowType:
			return { kind: surface.Kind.ArrowType, left: unelaborateTypeInner(depth, tp.left), right: unelaborateTypeInner(depth, tp.right) };
		case core.Kind.ProductType:
			return { kind: surface.Kind.ProductType, left: unelaborateTypeInner(depth, tp.left), right: unelaborateTypeInner(depth, tp.right) };
	}
}
