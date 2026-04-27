export const enum Kind {
	// Terms
	UnitLiteral,
	Variable,
	Application,
	Abstraction,
	Let,
}

export type UnitLiteral = { kind: Kind.UnitLiteral };
export type Variable = { kind: Kind.Variable; name: string };
export type Application = {
	kind: Kind.Application;
	left: Expression;
	right: Expression;
};
export type Abstraction = {
	kind: Kind.Abstraction;
	variable: string;
	body: Expression;
};
export type Let = {
	kind: Kind.Let;
	variable: string;
	expression: Expression;
	body: Expression;
};

export type Expression = UnitLiteral | Variable | Application | Abstraction | Let;

export function expressionToString(expr: Expression): string {
	switch (expr.kind) {
		case Kind.UnitLiteral:
			return "()";
		case Kind.Variable:
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
			return `λ${expr.variable}.${expressionToString(expr.body)}`;
		case Kind.Let:
			return `let ${expr.variable} = ${expressionToString(expr.expression)} in ${expressionToString(expr.body)}`;
	}
}

function shouldParenthesize(expr: Expression): boolean {
	switch (expr.kind) {
		case Kind.UnitLiteral:
		case Kind.Variable:
			return false;
		case Kind.Application:
		case Kind.Abstraction:
		case Kind.Let:
			return true;
	}
}
