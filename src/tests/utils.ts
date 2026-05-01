import * as hm from "../hm";
import * as paper from "../paperDK";
import * as stratified from "../stratifiedDK";

export function areTypesStructurallyEqual(p: paper.ast.TypeExpression, s: stratified.core.TypeExpression): boolean {
	switch (p.kind) {
		case paper.ast.Kind.UnitType:
			return s.kind === stratified.core.Kind.UnitType;
		case paper.ast.Kind.IntType:
			return s.kind === stratified.core.Kind.IntType;
		case paper.ast.Kind.TypeVariable:
			return s.kind === stratified.core.Kind.BoundTypeVariable;
		case paper.ast.Kind.ExistentialTypeVariable:
			return s.kind === stratified.core.Kind.ExistentialTypeVariable;
		case paper.ast.Kind.UniversalType:
			if (s.kind !== stratified.core.Kind.UniversalType) {
				return false;
			}
			return areTypesStructurallyEqual(p.body, s.body);
		case paper.ast.Kind.ArrowType:
			if (s.kind !== stratified.core.Kind.ArrowType) {
				return false;
			}
			return areTypesStructurallyEqual(p.left, s.left) && areTypesStructurallyEqual(p.right, s.right);
		case paper.ast.Kind.ProductType:
			if (s.kind !== stratified.core.Kind.ProductType) {
				return false;
			}
			return areTypesStructurallyEqual(p.left, s.left) && areTypesStructurallyEqual(p.right, s.right);
	}
}

export function areExpressionsStructurallyEqual(p: paper.ast.Expression, s: stratified.core.Expression): boolean {
	switch (p.kind) {
		case paper.ast.Kind.UnitLiteral:
			return s.kind === stratified.core.Kind.UnitLiteral;
		case paper.ast.Kind.IntLiteral:
			return s.kind === stratified.core.Kind.IntLiteral && p.value === s.value;
		case paper.ast.Kind.Variable:
			return s.kind === stratified.core.Kind.BoundVariable;
		case paper.ast.Kind.Abstraction:
			return s.kind === stratified.core.Kind.Abstraction && areExpressionsStructurallyEqual(p.body, s.body);
		case paper.ast.Kind.Application:
			return (
				s.kind === stratified.core.Kind.Application &&
				areExpressionsStructurallyEqual(p.left, s.left) &&
				areExpressionsStructurallyEqual(p.right, s.right)
			);
		case paper.ast.Kind.AnnotatedExpression:
			return (
				s.kind === stratified.core.Kind.AnnotatedExpression &&
				areExpressionsStructurallyEqual(p.body, s.body) &&
				areTypesStructurallyEqual(p.annotation, s.annotation)
			);
		case paper.ast.Kind.AnnotatedAbstraction:
			return (
				s.kind === stratified.core.Kind.AnnotatedAbstraction &&
				areExpressionsStructurallyEqual(p.body, s.body) &&
				areTypesStructurallyEqual(p.annotation, s.annotation)
			);
		case paper.ast.Kind.Addition:
			return (
				s.kind === stratified.core.Kind.Addition &&
				areExpressionsStructurallyEqual(p.left, s.left) &&
				areExpressionsStructurallyEqual(p.right, s.right)
			);
		case paper.ast.Kind.Pair:
			return (
				s.kind === stratified.core.Kind.Pair &&
				areExpressionsStructurallyEqual(p.left, s.left) &&
				areExpressionsStructurallyEqual(p.right, s.right)
			);
	}
}

function areTypesStructurallyEqualHMInner(p: paper.ast.TypeExpression, h: hm.core.TypeExpression): boolean {
	switch (p.kind) {
		case paper.ast.Kind.UnitType:
			return h.kind === hm.core.TypeKind.UnitType;
		case paper.ast.Kind.IntType:
			return h.kind === hm.core.TypeKind.IntType;
		case paper.ast.Kind.TypeVariable:
			return h.kind === hm.core.TypeKind.TypeVariable;
		case paper.ast.Kind.ExistentialTypeVariable:
			return h.kind === hm.core.TypeKind.UnificationVariable;
		case paper.ast.Kind.UniversalType:
			return false;
		case paper.ast.Kind.ArrowType:
			if (h.kind !== hm.core.TypeKind.ArrowType) {
				return false;
			}
			return areTypesStructurallyEqualHMInner(p.left, h.left) && areTypesStructurallyEqualHMInner(p.right, h.right);
		case paper.ast.Kind.ProductType:
			if (h.kind !== hm.core.TypeKind.ProductType) {
				return false;
			}
			return areTypesStructurallyEqualHMInner(p.left, h.left) && areTypesStructurallyEqualHMInner(p.right, h.right);
	}
}

export function areTypesStructurallyEqualHM(p: paper.ast.TypeExpression, h: hm.hm.Scheme): boolean {
	let paperUniversalCount = 0;
	while (p.kind === paper.ast.Kind.UniversalType) {
		paperUniversalCount++;
		p = p.body;
	}
	if (paperUniversalCount !== h.arity) {
		return false;
	}
	return areTypesStructurallyEqualHMInner(p, h.type);
}

export function areExpressionsStructurallyEqualHM(p: paper.ast.Expression, h: hm.core.Expression): boolean {
	switch (p.kind) {
		case paper.ast.Kind.UnitLiteral:
			return h.kind === hm.core.Kind.UnitLiteral;
		case paper.ast.Kind.IntLiteral:
			return h.kind === hm.core.Kind.IntLiteral && p.value === h.value;
		case paper.ast.Kind.Variable:
			return h.kind === hm.core.Kind.BoundVariable;
		case paper.ast.Kind.Abstraction:
			return h.kind === hm.core.Kind.Abstraction && areExpressionsStructurallyEqualHM(p.body, h.body);
		case paper.ast.Kind.Application:
			return (
				h.kind === hm.core.Kind.Application &&
				areExpressionsStructurallyEqualHM(p.left, h.left) &&
				areExpressionsStructurallyEqualHM(p.right, h.right)
			);
		case paper.ast.Kind.AnnotatedExpression:
			return areExpressionsStructurallyEqualHM(p.body, h);
		case paper.ast.Kind.AnnotatedAbstraction:
			return h.kind === hm.core.Kind.Abstraction && areExpressionsStructurallyEqualHM(p.body, h.body);
		case paper.ast.Kind.Addition:
			return (
				h.kind === hm.core.Kind.Addition &&
				areExpressionsStructurallyEqualHM(p.left, h.left) &&
				areExpressionsStructurallyEqualHM(p.right, h.right)
			);
		case paper.ast.Kind.Pair:
			return (
				h.kind === hm.core.Kind.Pair &&
				areExpressionsStructurallyEqualHM(p.left, h.left) &&
				areExpressionsStructurallyEqualHM(p.right, h.right)
			);
	}
}

export function areStratifiedSurfaceTypesStructurallyEqual(
	a: stratified.surface.TypeExpression,
	b: stratified.surface.TypeExpression,
): boolean {
	switch (a.kind) {
		case stratified.surface.Kind.UnitType:
			return b.kind === stratified.surface.Kind.UnitType;
		case stratified.surface.Kind.IntType:
			return b.kind === stratified.surface.Kind.IntType;
		case stratified.surface.Kind.TypeVariable:
			return b.kind === stratified.surface.Kind.TypeVariable;
		case stratified.surface.Kind.UniversalType:
			if (b.kind !== stratified.surface.Kind.UniversalType) {
				return false;
			}
			return areStratifiedSurfaceTypesStructurallyEqual(a.body, b.body);
		case stratified.surface.Kind.ArrowType:
			if (b.kind !== stratified.surface.Kind.ArrowType) {
				return false;
			}
			return areStratifiedSurfaceTypesStructurallyEqual(a.left, b.left) && areStratifiedSurfaceTypesStructurallyEqual(a.right, b.right);
		case stratified.surface.Kind.ProductType:
			if (b.kind !== stratified.surface.Kind.ProductType) {
				return false;
			}
			return areStratifiedSurfaceTypesStructurallyEqual(a.left, b.left) && areStratifiedSurfaceTypesStructurallyEqual(a.right, b.right);
	}
}

export function areStratifiedSurfaceExpressionsStructurallyEqual(
	a: stratified.surface.Expression,
	b: stratified.surface.Expression,
): boolean {
	switch (a.kind) {
		case stratified.surface.Kind.UnitLiteral:
			return b.kind === stratified.surface.Kind.UnitLiteral;
		case stratified.surface.Kind.IntLiteral:
			return b.kind === stratified.surface.Kind.IntLiteral && a.value === b.value;
		case stratified.surface.Kind.Variable:
			return b.kind === stratified.surface.Kind.Variable;
		case stratified.surface.Kind.Abstraction:
			return b.kind === stratified.surface.Kind.Abstraction && areStratifiedSurfaceExpressionsStructurallyEqual(a.body, b.body);
		case stratified.surface.Kind.Application:
			return (
				b.kind === stratified.surface.Kind.Application &&
				areStratifiedSurfaceExpressionsStructurallyEqual(a.left, b.left) &&
				areStratifiedSurfaceExpressionsStructurallyEqual(a.right, b.right)
			);
		case stratified.surface.Kind.AnnotatedExpression:
			return (
				b.kind === stratified.surface.Kind.AnnotatedExpression &&
				areStratifiedSurfaceExpressionsStructurallyEqual(a.body, b.body) &&
				areStratifiedSurfaceTypesStructurallyEqual(a.annotation, b.annotation)
			);
		case stratified.surface.Kind.AnnotatedAbstraction:
			return (
				b.kind === stratified.surface.Kind.AnnotatedAbstraction &&
				areStratifiedSurfaceExpressionsStructurallyEqual(a.body, b.body) &&
				areStratifiedSurfaceTypesStructurallyEqual(a.annotation, b.annotation)
			);
		case stratified.surface.Kind.Addition:
			return (
				b.kind === stratified.surface.Kind.Addition &&
				areStratifiedSurfaceExpressionsStructurallyEqual(a.left, b.left) &&
				areStratifiedSurfaceExpressionsStructurallyEqual(a.right, b.right)
			);
		case stratified.surface.Kind.Pair:
			return (
				b.kind === stratified.surface.Kind.Pair &&
				areStratifiedSurfaceExpressionsStructurallyEqual(a.left, b.left) &&
				areStratifiedSurfaceExpressionsStructurallyEqual(a.right, b.right)
			);
	}
}

export function areHMSurfaceExpressionsStructurallyEqual(a: hm.surface.Expression, b: hm.surface.Expression): boolean {
	switch (a.kind) {
		case hm.surface.Kind.UnitLiteral:
			return b.kind === hm.surface.Kind.UnitLiteral;
		case hm.surface.Kind.IntLiteral:
			return b.kind === hm.surface.Kind.IntLiteral && a.value === b.value;
		case hm.surface.Kind.Variable:
			return b.kind === hm.surface.Kind.Variable;
		case hm.surface.Kind.Abstraction:
			return b.kind === hm.surface.Kind.Abstraction && areHMSurfaceExpressionsStructurallyEqual(a.body, b.body);
		case hm.surface.Kind.Application:
			return (
				b.kind === hm.surface.Kind.Application &&
				areHMSurfaceExpressionsStructurallyEqual(a.left, b.left) &&
				areHMSurfaceExpressionsStructurallyEqual(a.right, b.right)
			);
		case hm.surface.Kind.Addition:
			return (
				b.kind === hm.surface.Kind.Addition &&
				areHMSurfaceExpressionsStructurallyEqual(a.left, b.left) &&
				areHMSurfaceExpressionsStructurallyEqual(a.right, b.right)
			);
		case hm.surface.Kind.Pair:
			return (
				b.kind === hm.surface.Kind.Pair &&
				areHMSurfaceExpressionsStructurallyEqual(a.left, b.left) &&
				areHMSurfaceExpressionsStructurallyEqual(a.right, b.right)
			);
		case hm.surface.Kind.Let:
			return (
				b.kind === hm.surface.Kind.Let &&
				areHMSurfaceExpressionsStructurallyEqual(a.expression, b.expression) &&
				areHMSurfaceExpressionsStructurallyEqual(a.body, b.body)
			);
	}
}
