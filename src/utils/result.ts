// deno-lint-ignore-file no-namespace
export type Result<T, E> = Result.Ok<T> | Result.Err<E>;

export namespace Result {
	export type Ok<T> = { isOk: true; value: T };
	export type Err<E> = { isOk: false; err: E };

	export const Ok = <T>(value: T): Ok<T> => ({ isOk: true, value });
	export const Err = <E>(err: E): Err<E> => ({ isOk: false, err });

	export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.isOk;

	export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.isOk;

	export const map = <A, B, E>(r: Result<A, E>, f: (a: A) => B): Result<B, E> => (r.isOk ? Ok(f(r.value)) : r);

	export const andThen = <A, B, E>(r: Result<A, E>, f: (a: A) => Result<B, E>): Result<B, E> => (r.isOk ? f(r.value) : r);

	export const orElse = <T, E, S>(r: Result<T, E>, onErr: (e: E) => T): T => (r.isOk ? r.value : onErr(r.err));

	export const elim = <T, E, S>(r: Result<T, E>, onOk: (t: T) => S, onErr: (e: E) => S): S => (r.isOk ? onOk(r.value) : onErr(r.err));
}
