//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@deepseek-ai/dsh-ponytail`.
* @module @deepseek-ai/dsh-ponytail/invariant
*/
const PACKAGE_NAME = "@deepseek-ai/dsh-ponytail";
/** Cordis companion plugin name. */
const name = "ponytail-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: mode overrides live in a session-scoped in-memory
* store with no cross-event or durable-data relationship to enforce.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
