const COMBINING_CIRCUMFLEX_ACCENT = 0x302;
const SUBSCRIPT_NUMBERS = Array.from({ length: 10 }).map((_, i) => 0x2080 + i);

const digits = (n: number): number[] => {
	const digits: number[] = [];
	let r = 0;
	while (n > 0) {
		r = n % 10;
		digits.push(r);
		n = (n - r) / 10;
	}
	digits.reverse();
	return digits;
};

export const createExistentialVariableName = (n: number): string => {
	const r = n % 25;
	const c = (n - r) / 25;
	if (c > 0) {
		return `${String.fromCharCode(945 + r, COMBINING_CIRCUMFLEX_ACCENT)}${c}`;
	}
	return String.fromCharCode(945 + r, COMBINING_CIRCUMFLEX_ACCENT);
};

export const createTypeVariableName = (n: number): string => {
	const r = n % 25;
	const c = (n - r) / 25;

	if (c > 0) {
		return `${String.fromCharCode(945 + r)}${c}`;
	}
	return String.fromCharCode(945 + r);
};

// alternatives, but they mess up string width calculations

export const createExistentialVariableNameSubscript = (n: number, bias = 1): string => {
	const r = n % 25;
	const c = bias + (n - r) / 25;
	return String.fromCharCode(945 + c, COMBINING_CIRCUMFLEX_ACCENT, ...digits(r).map((d) => SUBSCRIPT_NUMBERS[d]));
};

export const createTypeVariableNameSubscript = (n: number, bias = 1): string => {
	const r = n % 25;
	const c = bias + (n - r) / 25;
	return String.fromCharCode(945 + c, ...digits(r).map((d) => SUBSCRIPT_NUMBERS[d]));
};

export const createVariableName = (n: number): string => {
	const m = n + 23;
	const r = m % 26;
	const c = (m - r) / 26;
	if (c > 0) {
		return `${String.fromCharCode(97 + r)}${c}`;
	}
	return String.fromCharCode(97 + r);
};

const isCombining = (code: number) => 0x300 <= code && code <= 0x36f;

// Note very robust, but mostly only expect the circumflexes to cause width issues
export const stringWidth = (s: string): number => {
	let w = 0;
	for (let i = 0; i < s.length; i++) {
		if (isCombining(s.charCodeAt(i))) {
			continue;
		}
		w++;
	}
	return w;
};
