import { Result as LibResult, Parser } from "@jessejenks/ts-combinator";
import { Result } from "../utils/result";
import { Abstraction, Application, Expression, Kind, Let, Variable } from "./surface";

const { spaces, exact, validate, sequence, zeroOrMore, oneOf, conditional, lazy, map, succeed, fromRegExp, completely } = Parser;

const keywords = new Set(["let", "in"]);
const identifier = validate((ident) => !keywords.has(ident), fromRegExp(/[a-z][a-zA-Z0-9_]*/, "a variable"));
const variableParser = map((name): Variable => ({ kind: Kind.Variable, name }), identifier);
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

const atomParser = oneOf(
	variableParser,
	lambdaParser,
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

const letParser: Parser<Let> = map(
	([, [variable, , , , expression, , , , body]]): Let => ({ kind: Kind.Let, variable, expression, body }),
	conditional(
		sequence(exact("let"), spaces(true)),
		sequence(
			identifier,
			spaces(),
			exact("="),
			spaces(),
			lazy(() => atomParser),
			spaces(),
			exact("in"),
			spaces(true),
			lazy(() => termParser),
		),
	),
);

const termParser = oneOf(letParser, applicationParser);

export const parse = (input: string) => {
	const res = completely(termParser).parse(input);
	return LibResult.isOk(res) ? Result.Ok(res.value.parsed) : Result.Err(res.error.message);
};
