import { createExistentialVariableName } from "../utils/names";
import { Result } from "../utils/result";
import {
	collectFreeExistentialTypeVariables,
	collectFreeTypeVariables,
	ExistentialTypeVariable,
	Kind,
	Monotype,
	TypeExpression,
	typeExpressionToString,
	Variable,
} from "./ast";

export const enum ContextItemKind {
	TypeVariable,
	Binding,
	Existential,
	SolvedExistential,
	Mark,
}

type ContextItem =
	| {
			kind: ContextItemKind.TypeVariable;
			name: string;
	  }
	| {
			kind: ContextItemKind.Binding;
			name: string;
			type: TypeExpression;
	  }
	| {
			kind: ContextItemKind.Existential;
			id: number;
	  }
	| {
			kind: ContextItemKind.SolvedExistential;
			left: number;
			right: Monotype;
	  }
	| {
			kind: ContextItemKind.Mark;
			id: number;
	  };

function contextItemToString(item: ContextItem): string {
	switch (item.kind) {
		case ContextItemKind.TypeVariable:
			return item.name;
		case ContextItemKind.Binding:
			return `${item.name}: ${typeExpressionToString(item.type)}`;
		case ContextItemKind.Existential:
			return createExistentialVariableName(item.id);
		case ContextItemKind.SolvedExistential:
			return `${createExistentialVariableName(item.left)} = ${typeExpressionToString(item.right)}`;
		case ContextItemKind.Mark:
			return `›${createExistentialVariableName(item.id)}`;
	}
}

type OnTrace = (name: string, ctx: string, ...rest: string[]) => void;

export class Context {
	protected nextID: number = 0;
	protected context: ContextItem[];
	protected traceDepth: number = 0;
	protected indentation: Map<number, string>;
	onStartTrace: OnTrace | undefined;
	onEndTrace: OnTrace | undefined;
	onLeafTrace: OnTrace | undefined;

	constructor(public logTrace = false) {
		this.context = [];
		this.indentation = new Map([
			[0, ""],
			[1, "  "],
		]);
	}

	newExistential(): ExistentialTypeVariable {
		return { kind: Kind.ExistentialTypeVariable, id: this.nextID++ };
	}

	pushTypeVariable(name: string) {
		this.context.push({
			kind: ContextItemKind.TypeVariable,
			name,
		});
	}

	pushBinding(name: string, tp: TypeExpression) {
		this.context.push({ kind: ContextItemKind.Binding, name, type: tp });
	}

	pushExistential(tpVar: ExistentialTypeVariable) {
		this.context.push({ kind: ContextItemKind.Existential, id: tpVar.id });
	}

	pushSolved(left: ExistentialTypeVariable, right: Monotype) {
		this.context.push({
			kind: ContextItemKind.SolvedExistential,
			left: left.id,
			right,
		});
	}

	pushMark(tpVar: ExistentialTypeVariable) {
		this.context.push({ kind: ContextItemKind.Mark, id: tpVar.id });
	}

	pop(): ContextItem | undefined {
		return this.context.pop();
	}

	dropAfterTypeVariable(name: string): Context {
		let index = -1;
		for (let i = this.context.length - 1; i >= 0; i--) {
			const contextItem = this.context[i];
			if (contextItem.kind === ContextItemKind.TypeVariable && contextItem.name === name) {
				index = i;
				break;
			}
		}
		if (index > -1) {
			this.context = this.context.slice(0, index);
		}
		return this;
	}

	dropAfterBinding(name: string): Context {
		let index = -1;
		for (let i = this.context.length - 1; i >= 0; i--) {
			const contextItem = this.context[i];
			if (contextItem.kind === ContextItemKind.Binding && contextItem.name === name) {
				index = i;
				break;
			}
		}
		if (index > -1) {
			this.context = this.context.slice(0, index);
		}
		return this;
	}

	dropAfterMark(existential: ExistentialTypeVariable): Context {
		let index = -1;
		for (let i = this.context.length - 1; i >= 0; i--) {
			const contextItem = this.context[i];
			if (contextItem.kind === ContextItemKind.Mark && contextItem.id === existential.id) {
				index = i;
				break;
			}
		}
		if (index > -1) {
			this.context = this.context.slice(0, index);
		}
		return this;
	}

	lookup(x: Variable): Result<TypeExpression, string> {
		for (let i = this.context.length - 1; i >= 0; i--) {
			const contextItem = this.context[i];
			if (contextItem.kind === ContextItemKind.Binding && contextItem.name === x.name) {
				return Result.Ok(contextItem.type);
			}
		}
		return Result.Err("unknown variable");
	}

	replaceExistential(existential: ExistentialTypeVariable, ...replacement: ContextItem[]): boolean {
		const index = this.context.findIndex((item) => item.kind === ContextItemKind.Existential && item.id === existential.id);
		if (index < 0) {
			return false;
		}
		this.context.splice(index, 1, ...replacement);
		return true;
	}

	solve(existential: ExistentialTypeVariable, solution: Monotype) {
		return this.replaceExistential(existential, {
			kind: ContextItemKind.SolvedExistential,
			left: existential.id,
			right: solution,
		});
	}

	existentialBefore(left: ExistentialTypeVariable, right: ExistentialTypeVariable) {
		for (let i = 0; i < this.context.length; i++) {
			const item = this.context[i];
			if (item.kind === ContextItemKind.Existential) {
				if (item.id === left.id) {
					return true;
				}
				if (item.id === right.id) {
					return false;
				}
			}
		}
		return false;
	}

	existentialDeclaredBefore(leftId: number, right: ExistentialTypeVariable) {
		for (let i = 0; i < this.context.length; i++) {
			const item = this.context[i];
			if (item.kind === ContextItemKind.Existential) {
				if (item.id === leftId) {
					return true;
				}
				if (item.id === right.id) {
					return false;
				}
			} else if (item.kind === ContextItemKind.SolvedExistential) {
				if (item.left === leftId) {
					return true;
				}
				if (item.left === right.id) {
					return false;
				}
			}
		}
		return false;
	}

	typeVarDeclaredBefore(leftName: string, right: ExistentialTypeVariable) {
		for (let i = 0; i < this.context.length; i++) {
			const item = this.context[i];
			if (item.kind === ContextItemKind.TypeVariable) {
				if (item.name === leftName) {
					return true;
				}
			}
			if (item.kind === ContextItemKind.Existential) {
				if (item.id === right.id) {
					return false;
				}
			}
			if (item.kind === ContextItemKind.SolvedExistential) {
				if (item.right.kind === Kind.TypeVariable && item.right.name === leftName) {
					return true;
				}
				if (item.left === right.id) {
					return false;
				}
			}
		}
		return false;
	}

	isScopedFor(existential: ExistentialTypeVariable, tp: TypeExpression): boolean {
		const freeExistentials = new Set<number>();
		collectFreeExistentialTypeVariables(tp, freeExistentials);
		for (const freeId of freeExistentials) {
			if (!this.existentialDeclaredBefore(freeId, existential)) {
				return false;
			}
		}
		const freeTypeVars = new Set<string>();
		collectFreeTypeVariables(tp, freeTypeVars);
		for (const freeName of freeTypeVars) {
			if (!this.typeVarDeclaredBefore(freeName, existential)) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Fig. 8
	 * apply context, as a substitution, to a type
	 */
	apply(tp: TypeExpression): TypeExpression {
		switch (tp.kind) {
			case Kind.UnitType:
			case Kind.TypeVariable:
				return tp;
			case Kind.ExistentialTypeVariable:
				for (let i = this.context.length - 1; i >= 0; i--) {
					const item = this.context[i];
					if (item.kind === ContextItemKind.Existential && item.id === tp.id) {
						return tp;
					} else if (item.kind === ContextItemKind.SolvedExistential && item.left === tp.id) {
						return this.apply(item.right);
					}
				}
				return tp;
			case Kind.UniversalType:
				return {
					kind: Kind.UniversalType,
					variable: tp.variable,
					body: this.apply(tp.body),
				};
			case Kind.ArrowType:
				return {
					kind: Kind.ArrowType,
					left: this.apply(tp.left),
					right: this.apply(tp.right),
				};
		}
	}

	toString(): string {
		return "[" + this.context.map(contextItemToString).join(", ") + "]";
	}

	startRule(name: string, ...body: string[]) {
		if (this.logTrace) {
			console.debug(">", this.getIndentation(), name, this.toString(), "⊢", ...body, "⊣", "...");
			this.traceDepth++;
		}
		this.onStartTrace?.(name, this.toString(), ...body);
	}

	endRule(name: string, ...body: string[]): Context {
		if (this.logTrace) {
			this.traceDepth--;
			console.debug("<", this.getIndentation(), name, "...", "⊢", ...body, "⊣", this.toString());
		}
		this.onEndTrace?.(name, this.toString(), ...body);
		return this;
	}

	leafRule(name: string, ...body: string[]): Context {
		if (this.logTrace) {
			console.debug("=", this.getIndentation(), name, this.toString(), "⊢", ...body, "⊣", "...");
		}
		this.onLeafTrace?.(name, this.toString(), ...body);
		return this;
	}

	protected getIndentation() {
		if (!this.indentation.has(this.traceDepth)) {
			this.indentation.set(this.traceDepth, Array.from({ length: this.traceDepth }, () => "  ").join(""));
		}
		return this.indentation.get(this.traceDepth)!;
	}
}
