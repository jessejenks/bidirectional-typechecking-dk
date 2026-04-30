import { Result as LibResult, Parser } from "@jessejenks/ts-combinator";
import { Result } from "../utils/result";
import {
	Abstraction,
	Addition,
	AnnotatedAbstraction,
	Application,
	Expression,
	IntLiteral,
	Kind,
	Pair,
	TypeExpression,
	UniversalType,
	Variable,
} from "./ast";

const {
	spaces,
	exact,
	int,
	validate,
	sequence,
	zeroOrMore,
	oneOf,
	conditional,
	lazy,
	map,
	succeed,
	fromRegExp,
	completely,
	pratt,
	toBinaryOperator,
} = Parser;

const typeIdentifier = fromRegExp(/[\u03B1-\u03BA\u03BC-\u03C9A-Z][\u03B1-\u03BA\u03BC-\u03C9A-Za-z0-9_]*/, "a type variable");

const typeVariableParser = map((name): TypeExpression => {
	switch (name) {
		case "Unit":
			return { kind: Kind.UnitType };
		case "Int":
			return { kind: Kind.IntType };
		default:
			return { kind: Kind.TypeVariable, name };
	}
}, typeIdentifier);

const universalTypeParser = map(
	([, [, variable, , , , body]]): UniversalType => ({
		kind: Kind.UniversalType,
		variable,
		body,
	}),
	conditional(
		oneOf(exact("∀"), exact("forall")),
		sequence(
			spaces(),
			typeIdentifier,
			spaces(),
			exact("."),
			spaces(),
			lazy(() => typeParser),
		),
	),
);

const atomicTypeParser = oneOf(
	typeVariableParser,
	universalTypeParser,
	map(
		([, [, e]]) => e,
		conditional(
			exact("("),
			sequence(
				spaces(),
				lazy(() => typeParser),
				spaces(),
				exact(")"),
			),
		),
	),
);

const typeArrowParser: Parser<TypeExpression> = pratt(atomicTypeParser, {
	infix: {
		op: oneOf(
			toBinaryOperator(oneOf(exact("->"), exact("→")), [2, 1]), // right assoc
			toBinaryOperator(oneOf(exact("x"), exact("×")), [3, 4]),
		),
		acc: (op, left, right): TypeExpression => {
			switch (op) {
				case "->":
				case "→":
					return { kind: Kind.ArrowType, left, right };
				case "x":
				case "×":
					return { kind: Kind.ProductType, left, right };
			}
		},
	},
});

const typeParser = typeArrowParser;

export const parseType = (input: string) => {
	const res = completely(typeParser).parse(input);
	return LibResult.isOk(res) ? Result.Ok(res.value.parsed) : Result.Err(res.error.message);
};

const keywords = new Set(["let", "in"]);
const identifier = validate((ident) => !keywords.has(ident), fromRegExp(/[a-z][a-zA-Z0-9_]*/, "a variable"));
const variableParser = map((name): Variable => ({ kind: Kind.Variable, name }), identifier);
const optionalAnnotationParser = oneOf(
	map(([, [, tp]]) => tp, conditional(sequence(spaces(), exact(":")), sequence(spaces(), typeParser))),
	succeed(null),
);
const integerParser = map((value): IntLiteral => ({ kind: Kind.IntLiteral, value }), int());
const lambdaParser = map(
	([, [, [variable, annotation], , , body]]): Abstraction | AnnotatedAbstraction =>
		annotation === null
			? {
					kind: Kind.Abstraction,
					variable,
					body,
				}
			: {
					kind: Kind.AnnotatedAbstraction,
					annotation,
					variable,
					body,
				},
	conditional(
		oneOf(exact("λ"), exact("\\")),
		sequence(
			spaces(),
			oneOf(
				map(
					([, [, x, , a]]) => [x, a] as const,
					conditional(exact("("), sequence(spaces(), identifier, spaces(), optionalAnnotationParser, spaces(), exact(")"))),
				),
				map(([x, , a]) => [x, a] as const, sequence(identifier, spaces(), optionalAnnotationParser)),
			),
			exact("."),
			spaces(),
			lazy(() => termParser),
		),
	),
);

const atomParser = oneOf(
	variableParser,
	integerParser,
	lambdaParser,
	map(
		([, [, left, , , , right]]): Pair => ({ kind: Kind.Pair, left, right }),
		conditional(
			exact("<"),
			sequence(
				spaces(),
				lazy(() => termParser),
				spaces(),
				exact(","),
				spaces(),
				lazy(() => termParser),
				spaces(),
				exact(">"),
			),
		),
	),
	map(
		([, e]) => e,
		conditional(
			exact("("),
			oneOf(
				map((): Expression => ({ kind: Kind.UnitLiteral }), exact(")")),
				map(
					([, body, , , annotation]): Expression =>
						annotation === null
							? body
							: {
									kind: Kind.AnnotatedExpression,
									body,
									annotation,
								},
					sequence(
						spaces(),
						lazy(() => termParser),
						spaces(),
						exact(")"),
						optionalAnnotationParser,
					),
				),
			),
		),
	),
);

const applicationParser: Parser<Expression> = map(
	([left, terms]) =>
		terms.reduce(
			(acc, [, curr]): Application => ({
				kind: Kind.Application,
				left: acc,
				right: curr,
			}),
			left,
		),
	sequence(
		lazy(() => atomParser),
		zeroOrMore(
			sequence(
				spaces(),
				lazy(() => atomParser),
			),
		),
	),
);

const additionParser: Parser<Expression> = pratt(applicationParser, {
	infix: {
		op: toBinaryOperator(exact("+"), [1, 2]),
		acc: (_, left, right): Addition => ({ kind: Kind.Addition, left, right }),
	},
});

const letParser: Parser<Application> = map(
	([, [variable, annotation, , , , expression, , , , body]]): Application => ({
		kind: Kind.Application,
		left:
			annotation === null
				? { kind: Kind.Abstraction, variable, body } //
				: { kind: Kind.AnnotatedAbstraction, variable, annotation, body },
		right: expression,
	}),
	conditional(
		sequence(exact("let"), spaces(true)),
		sequence(
			identifier,
			optionalAnnotationParser,
			spaces(),
			exact("="),
			spaces(),
			lazy(() => additionParser),
			spaces(),
			exact("in"),
			spaces(true),
			lazy(() => termParser),
		),
	),
);

const termParser = oneOf(letParser, additionParser);

export const parse = (input: string) => {
	const res = completely(termParser).parse(input);
	return LibResult.isOk(res) ? Result.Ok(res.value.parsed) : Result.Err(res.error.message);
};
