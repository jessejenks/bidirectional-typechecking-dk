import fs from "node:fs";
import * as hm from "../src/hm";
import * as paper from "../src/paperDK";
import * as stratified from "../src/stratifiedDK";
import { Result } from "../src/utils/result";
import * as traces from "../src/utils/traces";

type Options = {
	file: string;
	code: string;
	system: "paper" | "stratified" | "hindley";
	log: boolean;
	trace: boolean;
	gentzen: boolean;
	pretty: boolean;
};

const defaults: Options = {
	file: "",
	code: "",
	system: "paper",
	log: false,
	trace: false,
	gentzen: false,
	pretty: true,
};

function fail(message?: any): never {
	if (message) {
		console.error(message);
	}
	process.exit(1);
}

function printTrace(trace: traces.Trace, options: Options) {
	if (options.gentzen) {
		console.log(traces.traceToProofTree(trace));
	} else {
		console.log(traces.traceToSimpleString(trace));
	}
}

function runSynthesisPaper(code: string, options: Options) {
	const context = new paper.context.Context(options.log);

	let getTrace: (() => traces.Trace) | undefined;
	if (options.trace) {
		const handlers = traces.getTraceHandlers();
		context.onStartTrace = handlers.onStartTrace;
		context.onEndTrace = handlers.onEndTrace;
		context.onLeafTrace = handlers.onLeafTrace;
		getTrace = handlers.getTrace;
	}
	return Result.map(
		Result.andThen(paper.parser.parse(code), (expr) => {
			console.log(paper.ast.expressionToString(expr));
			return paper.dk.synthesize(context, expr);
		}),
		({ type, ctx }) => {
			if (getTrace) {
				printTrace(getTrace(), options);
			}
			const appliedType = ctx.apply(type);
			if (!options.pretty) {
				console.log(paper.ast.typeExpressionToString(appliedType));
				return;
			}
			const generalized = paper.ast.generalize(appliedType);
			const miniscoped = paper.ast.miniscope(generalized);
			console.log(paper.ast.typeExpressionToString(miniscoped));
		},
	);
}

function runSynthesisStratified(code: string, options: Options) {
	const checker = new stratified.dk.TypeChecker(options.log);

	let getTrace: (() => traces.Trace) | undefined;
	if (options.trace) {
		const handlers = traces.getTraceHandlers();
		checker.onStartTrace = handlers.onStartTrace;
		checker.onEndTrace = handlers.onEndTrace;
		checker.onLeafTrace = handlers.onLeafTrace;
		getTrace = handlers.getTrace;
	}
	return Result.map(
		Result.andThen(stratified.parser.parse(code), (surfaceExpr) => {
			const expr = stratified.elaborator.elaborate(surfaceExpr);
			console.log(stratified.surface.expressionToString(surfaceExpr), "=>", stratified.core.expressionToString(expr));
			return checker.synthesize(expr);
		}),
		(type) => {
			if (getTrace) {
				printTrace(getTrace(), options);
			}
			const appliedType = checker.apply(type);
			if (!options.pretty) {
				console.log(stratified.core.typeExpressionToString(appliedType));
				return;
			}
			const generalized = stratified.core.generalize(appliedType);
			const miniscoped = stratified.core.miniscope(generalized);
			console.log(stratified.core.typeExpressionToString(miniscoped));
		},
	);
}

function runSynthesisHindley(code: string, options: Options) {
	const checker = new hm.hm.TypeChecker(options.log);

	let getTrace: (() => traces.Trace) | undefined;
	if (options.trace) {
		const handlers = hm.traces.getTraceHandlers();
		checker.onStartTrace = handlers.onStartTrace;
		checker.onEndTrace = handlers.onEndTrace;
		checker.onLeafTrace = handlers.onLeafTrace;
		getTrace = handlers.getTrace;
	}
	return Result.map(
		Result.andThen(hm.parser.parse(code), (surfaceExpr) => {
			const expr = hm.elaborator.elaborate(surfaceExpr);
			console.log(hm.surface.expressionToString(surfaceExpr), "=>", hm.core.expressionToString(expr));
			return checker.infer(expr);
		}),
		(type) => {
			if (getTrace) {
				printTrace(getTrace(), options);
			}
			console.log(hm.hm.schemeToString(type));
		},
	);
}

function runSynthesis(code: string, options: Options) {
	switch (options.system) {
		case "paper":
			return runSynthesisPaper(code, options);
		case "stratified":
			return runSynthesisStratified(code, options);
		case "hindley":
			return runSynthesisHindley(code, options);
	}
}

function usage() {
	console.error(`-f --file     <filepath>`);
	console.error(`-e --exec     <program code> (only synthesis)`);
	console.error(`-s --system   ("p" | "paper" | "s" | "stratified" | "h" | "hindley")  Default "paper"`);
	console.error(`-l --log      include log`);
	console.error(`-t --trace    show trace/derivation`);
	console.error(`-g --gentzen  show derivation in Gentzen style`);
	console.error(`--no-pretty   don't show pretty types`);
}

// comment or blank line
const skipPattern = /^\s*(--|$)/;

function run(options: Options) {
	if (!options.file && !options.code) {
		usage();
		fail("no file or program code provided");
	}
	if (options.code) {
		Result.elim(runSynthesis(options.code, options), () => {}, console.error);
	}
	if (options.file) {
		let lines: string[];
		try {
			const file = fs.readFileSync(options.file, { encoding: "utf-8" });
			lines = file.split(/[\r\n]/);
		} catch (e) {
			usage();
			fail(e);
		}
		let first = !options.code;
		for (let i = 0; i < lines.length; i++) {
			if (skipPattern.test(lines[i])) {
				continue;
			}
			if (first) {
				first = false;
			} else {
				console.log("---");
			}
			Result.elim(
				runSynthesis(lines[i], options),
				() => {},
				(e) => {
					console.error(`Error in file on line ${i + 1}`);
					console.error(e);
				},
			);
		}
	}
}

function argparse(args: string[]): Options {
	const opts: Options = { ...defaults };
	let curr: keyof Options | null = null;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "-h":
			case "--help":
				usage();
				process.exit(0);
			case "-s":
			case "--system":
				curr = "system";
				continue;
			case "-f":
			case "--file":
				curr = "file";
				continue;
			case "-e":
			case "--exec":
				curr = "code";
				continue;
			case "-l":
			case "--log":
				opts.log = true;
				continue;
			case "-t":
			case "--trace":
				opts.trace = true;
				continue;
			case "-g":
			case "--gentzen":
				opts.gentzen = true;
				continue;
			case "--no-pretty":
				opts.pretty = false;
				continue;
			default: {
				if (curr === null) {
					usage();
					fail();
				}
				switch (curr) {
					case "file":
					case "code":
						opts[curr] = arg;
						break;
					case "system":
						switch (arg) {
							case "paper":
							case "stratified":
							case "hindley":
								opts[curr] = arg;
								break;
							case "p":
								opts[curr] = "paper";
								break;
							case "s":
								opts[curr] = "stratified";
								break;
							case "h":
								opts[curr] = "hindley";
								break;
							default:
								usage();
						}
						break;
				}
			}
		}
	}

	return opts;
}

run(argparse(process.argv.slice(2)));
