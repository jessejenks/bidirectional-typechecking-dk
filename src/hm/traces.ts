import type { OnTrace, Trace } from "../utils/traces";

const onEnd = (traces: Trace[], trace: Trace) => {
	switch (trace.name) {
		case "Abs": {
			const c = traces.pop()!;
			trace.children.push(c);
			traces.push(trace);
			return;
		}
		case "App":
		case "Let": {
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
