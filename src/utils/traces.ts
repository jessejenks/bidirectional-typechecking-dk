import { stringWidth } from "./names";

export type OnTrace = (name: string, ctx: string, ...rest: string[]) => void;

const center = (s: string, w: number, desired: number): string => {
	if (w >= desired) {
		return s;
	}
	const delta = desired - w;
	const wl = delta % 2 === 0 ? delta / 2 : (delta - 1) / 2;
	const wr = delta % 2 === 0 ? wl : (delta + 1) / 2;
	return " ".repeat(wl) + s + " ".repeat(wr);
};

export function traceToNames(trace: Trace): string {
	const lines: string[] = [];
	traceToNamesInner(lines, 0, trace);
	return lines.join("\n");
}

function traceToNamesInner(lines: string[], depth: number, trace: Trace) {
	const indent = "| ".repeat(depth);
	for (let i = 0; i < trace.children.length; i++) {
		traceToNamesInner(lines, depth + 1, trace.children[i]);
	}
	lines.push(indent + trace.name);
}

export function traceToSimpleString(trace: Trace): string {
	const lines: string[] = [];
	traceToSimpleStringInner(lines, 0, trace);
	return lines.join("\n");
}

function traceToSimpleStringInner(lines: string[], depth: number, trace: Trace) {
	const indent = "| ".repeat(depth);
	for (let i = 0; i < trace.children.length; i++) {
		traceToSimpleStringInner(lines, depth + 1, trace.children[i]);
	}
	lines.push(indent + [trace.name, trace.startContext, "⊢", trace.body, "⊣", trace.endContext].join(" "));
}

export function traceToProofTree(trace: Trace): string {
	return traceToProofTreeInner(trace).lines.join("\n");
}

function traceToProofTreeInner(trace: Trace): { width: number; lines: string[] } {
	const childrenStrings = trace.children.map(traceToProofTreeInner);
	let childrenWidth = 0;
	let childrenHeight = 0;
	for (let i = 0; i < childrenStrings.length; i++) {
		const { width, lines } = childrenStrings[i];
		// spacing
		if (i > 0) {
			childrenWidth += 2;
		}
		childrenWidth += width;
		childrenHeight = Math.max(childrenHeight, lines.length);
	}
	const lines = new Array<string>(childrenHeight).fill("");
	for (let i = 0; i < childrenStrings.length; i++) {
		const { width: childWidth, lines: childLines } = childrenStrings[i];
		const delta = lines.length - childLines.length;
		for (let j = 0; j < delta; j++) {
			if (i > 0) {
				lines[j] += "  ";
			}
			lines[j] += " ".repeat(childWidth);
		}
		for (let j = 0; j < childLines.length; j++) {
			if (i > 0) {
				lines[j + delta] += "  ";
			}
			lines[j + delta] += childLines[j];
		}
	}
	const line = [trace.startContext, "⊢", trace.body, "⊣", trace.endContext].join(" ");
	const lineWidth = stringWidth(line);
	const width = Math.max(childrenWidth, lineWidth);
	const rule = "─".repeat(Math.max(0, width - 1 - trace.name.length)) + " " + trace.name;
	lines.push(rule);
	lines.push(center(line, lineWidth, width));
	return { width, lines };
}

export type Trace = { name: string; startContext: string; endContext: string; body: string; children: Trace[] };

const onEnd = (traces: Trace[], trace: Trace) => {
	switch (trace.name) {
		case "<:∀L":
		case "<:∀R":
		case "<:InstantiateL":
		case "<:InstantiateR":
		case "InstLAllR":
		case "InstRAllL":
		case "Anno":
		case "∀I":
		case "∀App":
		case "→I":
		case "→I⇒":
		case "Anno→I⇒":
		case "ExApp":
		case "→App": {
			const c = traces.pop()!;
			trace.children.push(c);
			traces.push(trace);
			return;
		}
		case "<:→":
		case "<:×":
		case "InstLArr":
		case "InstLProd":
		case "InstRArr":
		case "InstRProd":
		case "Sub":
		case "Anno→I":
		case "→E":
		case "Add⇒":
		case "Pair⇒":
		case "Pair": {
			const r = traces.pop()!;
			const l = traces.pop()!;
			trace.children.push(l, r);
			traces.push(trace);
			return;
		}

		default:
			traces.push(trace);
	}
};

export const getTraceHandlers = () => {
	const stack: Trace[] = [];
	const traces: Trace[] = [];
	const onStartTrace: OnTrace = (name, ctx) => {
		stack.push({ name, startContext: ctx, endContext: "", body: "", children: [] });
	};
	const onEndTrace: OnTrace = (name, ctx, ...rest) => {
		const l = stack.pop()!;
		console.assert(l.name === name);
		l.body = rest.join(" ");
		l.endContext = ctx;
		onEnd(traces, l);
	};
	const onLeafTrace: OnTrace = (name, ctx, ...rest) => {
		onEnd(traces, { name, startContext: ctx, endContext: ctx, body: rest.join(" "), children: [] });
	};

	const getTrace = () => traces.pop()!;
	return {
		onStartTrace,
		onEndTrace,
		onLeafTrace,
		getTrace,
	};
};
