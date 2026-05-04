export const enum Kind {
	// Terms
	UnitLiteral,
	IntLiteral,
	Variable,
	Application,
	Abstraction,
	Addition,
	Pair,
	Projection,
	Let,
}

export type UnitLiteral = { kind: Kind.UnitLiteral };
export type IntLiteral = { kind: Kind.IntLiteral; value: number };
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
	variable: string;
	expression: Expression;
	body: Expression;
};

export type Expression = UnitLiteral | IntLiteral | Variable | Application | Abstraction | Addition | Pair | Projection | Let;

export function expressionToString(expr: Expression): string {
	switch (expr.kind) {
		case Kind.UnitLiteral:
			return "()";
		case Kind.IntLiteral:
			return expr.value.toString();
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
		case Kind.Addition:
			return `${expressionToString(expr.left)} + ${expressionToString(expr.right)}`;
		case Kind.Pair:
			return `<${expressionToString(expr.left)}, ${expressionToString(expr.right)}>`;
		case Kind.Projection:
			return `${expr.side}(${expressionToString(expr.expression)})`;
		case Kind.Let:
			return `let ${expr.variable} = ${expressionToString(expr.expression)} in ${expressionToString(expr.body)}`;
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
		case Kind.Application:
		case Kind.Abstraction:
		case Kind.Addition:
		case Kind.Let:
			return true;
	}
}
