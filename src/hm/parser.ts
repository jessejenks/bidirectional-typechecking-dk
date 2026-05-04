import { Result as LibResult, Parser } from "@jessejenks/ts-combinator";
import { Result } from "../utils/result";
import { Abstraction, Addition, Application, Expression, IntLiteral, Kind, Let, Pair, Projection, Variable } from "./surface";

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

const keywords = new Set(["let", "in", "fst", "snd"]);
const identifier = validate((ident) => !keywords.has(ident), fromRegExp(/[a-z][a-zA-Z0-9_]*/, "a variable"));
const variableParser = map((name): Variable => ({ kind: Kind.Variable, name }), identifier);
const integerParser = map((value): IntLiteral => ({ kind: Kind.IntLiteral, value }), int());
const lambdaParser = map(
	([, [, variable, , , , body]]): Abstraction => ({
		kind: Kind.Abstraction,
		variable,
		body,
	}),
	conditional(
		oneOf(exact("λ"), exact("\\")),
		sequence(
			spaces(),
			identifier,
			spaces(),
			exact("."),
			spaces(),
			lazy(() => termParser),
		),
	),
);

const projectionParser = map(
	([side, [, , , expression]]): Projection => ({ kind: Kind.Projection, expression, side }),
	conditional(
		oneOf(exact("fst"), exact("snd")),
		sequence(
			spaces(),
			exact("("),
			spaces(),
			lazy(() => termParser),
			spaces(),
			exact(")"),
		),
	),
);

const atomParser = oneOf(
	variableParser,
	integerParser,
	lambdaParser,
	projectionParser,
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
					([, e]): Expression => e,
					sequence(
						spaces(),
						lazy(() => termParser),
						spaces(),
						exact(")"),
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

const letParser: Parser<Let> = map(
	([, [variable, , , , expression, , , , body]]): Let => ({ kind: Kind.Let, variable, expression, body }),
	conditional(
		sequence(exact("let"), spaces(true)),
		sequence(
			identifier,
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
