import { Result as LibResult, Parser } from "@jessejenks/ts-combinator";
import { Result } from "../utils/result";
import {
	Abstraction,
	AnnotatedAbstraction,
	Application,
	ArrowType,
	Expression,
	Kind,
	TypeExpression,
	TypeVariable,
	UniversalType,
	Variable,
} from "./ast";

const { spaces, exact, validate, sequence, zeroOrMore, oneOf, conditional, lazy, map, succeed, fromRegExp, completely } = Parser;

const typeIdentifier = fromRegExp(/[\u03B1-\u03BA\u03BC-\u03C9A-Z][\u03B1-\u03BA\u03BC-\u03C9A-Za-z0-9_]*/, "a type variable");

const typeVariableParser = map((name): TypeVariable => ({ kind: Kind.TypeVariable, name }), typeIdentifier);
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
	map((): TypeExpression => ({ kind: Kind.UnitType }), exact("1")),
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
const typeArrowParser: Parser<TypeExpression> = map(
	([left, terms]) => {
		if (terms.length === 0) {
			return left;
		}
		return [left, ...terms].reduceRight(
			(acc, curr): ArrowType => ({
				kind: Kind.ArrowType,
				left: curr,
				right: acc,
			}),
		);
	},
	sequence(
		lazy(() => atomicTypeParser),
		zeroOrMore(
			map(
				([, , , tp]) => tp,
				sequence(
					spaces(),
					oneOf(exact("→"), exact("->"), exact("⇾")),
					spaces(),
					lazy(() => atomicTypeParser),
				),
			),
		),
	),
);

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
	lambdaParser,
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

const letParser: Parser<Application> = map(
	([, [variable, , , , expression, , , , body]]): Application => ({
		kind: Kind.Application,
		left: { kind: Kind.Abstraction, variable, body },
		right: expression,
	}),
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
