import { createRequire } from "node:module";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { mkdirSync, readFileSync, renameSync, unlinkSync, unwatchFile, watchFile, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
//#region ../../llm/llm/src/brand.ts
/**
* Brand a message identifier.
* @param id - the opaque message identifier.
* @returns the same string, branded; no validation is performed.
*/
function MessageId(id) {
	return id;
}
//#endregion
//#region ../../llm/llm/src/call-config.ts
/**
* Deep-freeze a value in place with an iterative traversal, guarding cycles,
* so later mutation throws without imposing a JavaScript call-stack depth cap.
* {@link AbortSignal} objects are deliberately skipped because they are the
* request's live cancellation channel and freezing them breaks abort.
* @param value - the value to freeze in place.
* @returns the same value, frozen.
*/
function deepFreeze(value) {
	const seen = /* @__PURE__ */ new WeakSet();
	const pending = [{
		kind: "visit",
		node: value
	}];
	while (pending.length > 0) {
		const task = pending.pop();
		/* v8 ignore next -- the loop condition guarantees one pending task. */
		if (task === void 0) continue;
		if (task.kind === "property") {
			pending.push({
				kind: "visit",
				node: task.source[task.key]
			});
			continue;
		}
		const node = task.node;
		if (node === null || typeof node !== "object") continue;
		if (node instanceof AbortSignal) continue;
		if (seen.has(node)) continue;
		seen.add(node);
		Object.freeze(node);
		const keys = Object.keys(node);
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) continue;
			pending.push({
				kind: "property",
				source: node,
				key
			});
		}
	}
	return value;
}
//#endregion
//#region ../../llm/llm/src/message.ts
/** Message value types, identity, and immutable construction helpers. */
/**
* Detach and deep-freeze a message whose identity already exists.
* @param message - complete message, including its stable identity.
* @returns an immutable snapshot that preserves the identity.
*/
function freezeMessage(message) {
	return deepFreeze(structuredClone(message));
}
/**
* Create one identified message and freeze it before publication.
* @param input - complete role, content, and source for a new message.
* @returns an immutable message with a fresh stable identity.
*/
function createMessage(input) {
	return freezeMessage({
		...input,
		id: MessageId(crypto.randomUUID())
	});
}
/**
* Create one identified user-role message and freeze it before publication.
* @param input - complete content and source for a new user message.
* @returns an immutable user message with a fresh stable identity.
*/
function createUserMessage(input) {
	return createMessage({
		...input,
		role: "user"
	});
}
//#endregion
//#region ../../util/timeout/src/index.ts
/** Largest delay Node schedules without clamping it to one millisecond. */
const MAX_TIMER_DELAY_MS = 2147483647;
//#endregion
//#region ../../llm/llm/src/error.ts
/**
* Canonical provider-neutral code for a response that completed normally but
* carried no content blocks at all. Providers occasionally emit a degenerate
* completion (a terminal stop with zero output); adapters classify it as this
* failure instead of yielding an empty assistant message, because an empty
* message silently ends the turn with nothing for the user or the loop to act
* on. The attempt produced nothing durable, so retry policy treats it as safe
* to repeat.
*/
const EMPTY_RESPONSE_CODE = "EMPTY_RESPONSE";
new RegExp(String.raw`(?:^|[^a-z0-9])context[\s_-](?:length|window)[\s_-]` + String.raw`(?:exceed(?:ed|s)?|overflow(?:ed)?|limit[\s_-]exceeded)(?:$|[^a-z0-9])`, "i");
new RegExp(String.raw`\b(?:request|prompt|input|messages?)\s+(?:is\s+|are\s+)?` + String.raw`too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?` + String.raw`(?:model(?:'s)?\s+)?context(?:\s+window)?\b`, "i");
new RegExp(String.raw`\b(?:input|prompt|request|messages?)\b.{0,40}` + String.raw`\b(?:exceed(?:s|ed)?|overflows?|is\s+larger\s+than)\b.{0,40}` + String.raw`\b(?:the\s+)?(?:model(?:'s)?\s+)?context(?:\s+(?:length|window))?\b`, "i");
//#endregion
//#region ../../llm/llm/src/retry-policy.ts
/**
* Provider-owned request-retry policy configuration and resolution.
*
* Adapters expose one resolved policy per registered provider route; the
* optional dsh-llm-retry plugin executes it on the agent's failed-step extension point.
*
* @module @deepseek-ai/dsh-llm/retry-policy
*/
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 1e4;
const DEFAULT_JITTER_RATIO = .1;
const DEFAULT_RETRYABLE_CODES = Object.freeze([
	EMPTY_RESPONSE_CODE,
	"RATE_LIMIT",
	"SERVER",
	"TIMEOUT",
	"TRANSPORT"
]);
const backoffSchema = z.object({
	initialDelayMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
	maxDelayMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
	jitterRatio: z.number().min(0).max(1).default(DEFAULT_JITTER_RATIO)
});
const normalPolicySchema = z.object({
	mode: z.const("normal").required(),
	maxRetries: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
	retryableCodes: z.array(z.string()).default([...DEFAULT_RETRYABLE_CODES]),
	backoff: backoffSchema
});
const alwaysPolicySchema = z.object({
	mode: z.const("always").required(),
	backoff: backoffSchema
});
z.union([normalPolicySchema, alwaysPolicySchema]);
//#endregion
//#region ../../llm/llm/src/attribution.ts
/**
* Centralize the non-secret product identity every provider request sends as `User-Agent`, keeping
* adapters from drifting. See
* `.agents/notes/implemented/architecture/2026-06-21-mandatory-app-attribution-headers.md`.
*
* App-attribution vocabulary for provider requests.
* @module @deepseek-ai/dsh-llm/attribution
*/
const { version } = createRequire(import.meta.url)("../package.json");
//#endregion
//#region ../../llm/llm/src/never.ts
/**
* Exhaustiveness helper for closed core unions. Use {@link assertNever} at the default branch so a
* new variant fails compilation at every required handler. Do not use it for declaration-merged
* unions such as session events or content blocks: handle known variants and explicitly fall
* through because plugins may add valid unknown cases.
* @module @deepseek-ai/dsh-llm/never
*/
/**
* Mark an unreachable closed-union branch. A newly unhandled typed variant fails at the call site;
* a value that escaped its type throws with diagnostics at runtime.
* @param value - the impossible value; typed `never` so an unhandled variant fails compilation at the call site.
* @param context - optional label (e.g. the switch site) prefixed into the throw message.
* @returns never — it always throws, with the offending value JSON-rendered in the message.
*/
function assertNever(value, context) {
	const rendered = JSON.stringify(value) ?? String(value);
	throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}
//#endregion
//#region ../../core/scope/src/store.ts
/**
* Insertion-ordered named entries with caller-owned duplicate diagnostics.
*
* Values are borrowed. Iterators are live within one nonempty table
* generation; draining the table detaches them from later insertions. Each
* successful insertion returns an idempotent undo for that exact entry.
*/
var NamedEntries = class {
	duplicateError;
	data = /* @__PURE__ */ new Map();
	constructor(duplicateError) {
		this.duplicateError = duplicateError;
	}
	/**
	* Insert one unique name.
	* @param name - name unique within this table.
	* @param value - borrowed value to retain.
	* @returns an idempotent undo that removes only this insertion.
	*/
	insert(name, value) {
		const data = this.data;
		if (data.has(name)) throw this.duplicateError(name);
		data.set(name, value);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			data.delete(name);
			if (data.size === 0 && this.data === data) this.data = /* @__PURE__ */ new Map();
		};
	}
	/**
	* Read one named value.
	* @param name - name to resolve.
	* @returns the retained value, or `undefined` when absent.
	*/
	get(name) {
		return this.data.get(name);
	}
	/**
	* Test one name for membership.
	* @param name - name to test.
	* @returns whether the table contains that name.
	*/
	has(name) {
		return this.data.has(name);
	}
	/**
	* Iterate live names in insertion order.
	* @returns the native live key iterator.
	*/
	keys() {
		return this.data.keys();
	}
	/**
	* Iterate live entries in insertion order.
	* @returns the native live entry iterator.
	*/
	entries() {
		return this.data.entries();
	}
	/**
	* Iterate live values in insertion order.
	* @returns the native live value iterator.
	*/
	values() {
		return this.data.values();
	}
	/**
	* Test whether this table has no entries.
	* @returns whether the table is empty.
	*/
	isEmpty() {
		return this.data.size === 0;
	}
};
/**
* Own the global and exact-scope layers for one registry.
*
* Reads never create scoped layers. Registrations derive both visibility and
* effect ownership from the supplied Cordis context, collect undo before
* notification, and reclaim only a completely empty aggregate layer.
*/
var ScopedLayers = class {
	createLayer;
	onChange;
	/** The eagerly constructed context-global layer. */
	global;
	scoped = /* @__PURE__ */ new Map();
	constructor(createLayer, onChange) {
		this.createLayer = createLayer;
		this.onChange = onChange;
		this.global = createLayer(void 0);
	}
	/**
	* Read an existing exact-scope overlay. Deliberately chain-blind: callers
	* addressing one scope's OWN contributions (its restrictions, its guards)
	* must not silently pick up an ancestor's — use {@link chainLayers} where
	* inheritance is the point.
	* @param scope - exact scope key; `undefined` denotes no overlay.
	* @returns the existing scoped layer, or `undefined` without creating one.
	*/
	peek(scope) {
		if (scope === void 0) return void 0;
		return this.scoped.get(scope);
	}
	/**
	* Existing overlays along the scope's parent chain ({@link scopeChainOf}),
	* farthest ancestor first and the exact scope last, so a caller layering
	* them in order gives the nearest scope the final word.
	* @param scope - viewing scope, or `undefined` for no overlays.
	* @returns the existing layers, nearest last; absent overlays are skipped.
	*/
	chainLayers(scope) {
		const layers = [];
		for (const key of scopeChainOf(scope).reverse()) {
			const layer = this.scoped.get(key);
			if (layer !== void 0) layers.push(layer);
		}
		return layers;
	}
	/**
	* Materialize global named entries followed by scope-chain shadows,
	* farthest ancestor first, so the nearest scope's entry wins a name.
	* @param scope - viewing scope, or `undefined` for the global view.
	* @param pick - select the named table from a layer.
	* @returns an insertion-ordered effective map.
	*/
	merge(scope, pick) {
		const merged = new Map(pick(this.global).entries());
		for (const layer of this.chainLayers(scope)) for (const [name, value] of pick(layer).entries()) merged.set(name, value);
		return merged;
	}
	/**
	* Attach one synchronous layer mutation to its registration context.
	* @param ctx - context that determines both scope visibility and effect ownership.
	* @param action - atomic mutation returning its synchronous undo.
	* @param options - Cordis effect label and optional change notification.
	* @returns the exact disposer returned by `ctx.effect()`.
	*/
	effect(ctx, action, options) {
		const scope = scopeOf(ctx);
		const notify = options.notify ?? true;
		return ctx.effect(function* () {
			let layer;
			let created = false;
			if (scope === void 0) layer = this.global;
			else {
				const existing = this.scoped.get(scope);
				if (existing === void 0) {
					layer = this.createLayer(scope);
					this.scoped.set(scope, layer);
					created = true;
				} else layer = existing;
			}
			let undo;
			try {
				undo = action(layer);
			} catch (error) {
				if (scope !== void 0 && created && layer.isEmpty()) this.scoped.delete(scope);
				throw error;
			}
			yield () => {
				undo();
				if (scope !== void 0 && layer.isEmpty()) this.scoped.delete(scope);
				if (notify) this.onChange();
			};
			if (notify) this.onChange();
		}.bind(this), options.label);
	}
};
//#endregion
//#region ../../core/scope/src/index.ts
/** Context tag written by {@link createScope}. */
const kScope = Symbol("dsh.scope");
/**
* The enclosing scope of each key. One relation powers both directions of
* scope nesting: registration views inherit DOWN the chain (a child scope
* sees its ancestors' layers — {@link ScopedLayers}), and event admission
* extends UP it (a listener tagged with an ancestor receives events dispatched
* to a descendant key — {@link scopeTarget}).
*/
const scopeParents = /* @__PURE__ */ new WeakMap();
/**
* The chain from a key to its root ancestor.
* @param key - the starting key, or `undefined` for the empty chain.
* @returns keys nearest-first: `[key, parent, grandparent, …]`.
*/
function scopeChainOf(key) {
	const chain = [];
	for (let cursor = key; cursor !== void 0; cursor = scopeParents.get(cursor)) chain.push(cursor);
	return chain;
}
/**
* Read the nearest scope tag inherited by a context.
* @param ctx - context to inspect.
* @returns its scope key, or `undefined` for an unscoped context.
*/
function scopeOf(ctx) {
	return ctx[kScope];
}
//#endregion
//#region ../../skill/skill/src/index.ts
/**
* Agent skill provider registry.
*
* This package owns the Service Definition role of the skill capability seam.
* Concrete
* providers such as `@deepseek-ai/dsh-skill-filesystem` decide where skills come
* from; this service only merges provider catalogs, resolves the winning skill
* for a name, and exposes the winning summaries and definitions to consumers.
*
* @module @deepseek-ai/dsh-skill
*/
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_COLLECT_CACHE_ENTRIES = 128;
const MAX_COLLECT_ATTEMPTS = 2;
const RUNTIME_PROVIDER = "runtime";
const RUNTIME_RANK = 250;
/**
* Return whether a string is a valid kebab-case skill name.
* @param name - candidate skill name to validate.
* @returns whether the name matches the public skill-name grammar.
*/
function isSkillName(name) {
	return SKILL_NAME.test(name);
}
/**
* Render one loaded skill for the model. The output is shared verbatim by the
* `skill` tool result and the user-explicit invocation injection, so the model
* sees one canonical `<skill_content>` shape on both paths. The name rides an
* escaped attribute; the body is embedded verbatim (skills are trusted local
* content, and user-supplied invocation text stays outside this wrapper).
* @param skill - name, provider, optional resource base, and body to render.
* @returns the complete model-facing `<skill_content>` block.
*/
function renderSkillContent(skill) {
	const resourceHint = renderResourceHint(skill);
	return [
		`<skill_content name="${escapeAttr(skill.name)}">`,
		"<skill_resources>",
		...resourceHint,
		"</skill_resources>",
		"",
		"<skill_instructions>",
		skill.content,
		"</skill_instructions>",
		"</skill_content>"
	].join("\n");
}
function renderResourceHint(skill) {
	const base = skill.resourceBase;
	if (base === void 0) return [`Resources for this skill are managed by provider "${escapeText(skill.provider)}".`, "Load referenced resources only as needed."];
	switch (base.kind) {
		case "directory": return [`Base directory for this skill: ${escapeText(base.path)}`, "Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed."];
		case "url": return [`Base URL for this skill: ${escapeText(base.url)}`, "Resolve relative URLs mentioned by this skill against the base URL before using them. Load referenced resources only as needed."];
		case "opaque": return [`Resources for this skill: ${escapeText(base.description)}`, "Load referenced resources only as needed."];
		/* v8 ignore start -- SkillResourceBase is a closed union; a future kind must fail compilation here. */
		default: return assertNever(base, "SkillResourceBase.kind");
	}
}
function escapeAttr(value) {
	return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;");
}
/**
* Escape model-facing prose embedded inside skill markup so provider-supplied
* text cannot open or close framing tags.
* @param value - raw prose to embed.
* @returns the escaped text.
*/
function escapeText(value) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
/** One scope's complete skill-registry contribution. */
var SkillLayer = class {
	/** Providers registered through contexts carrying this scope, insertion-ordered. */
	providers;
	/** Runtime skills registered through contexts carrying this scope. */
	runtime = /* @__PURE__ */ new Map();
	constructor(scope) {
		this.providers = new NamedEntries((name) => /* @__PURE__ */ new Error(scope === void 0 ? `a skill provider named "${name}" is already registered` : `a skill provider named "${name}" is already registered in this scope`));
	}
	/** Whether every contribution table in this aggregate layer is empty. */
	isEmpty() {
		return this.providers.isEmpty() && this.runtime.size === 0;
	}
};
(class extends Service {
	static Config = z.object({ collectCacheMaxEntries: z.number().default(DEFAULT_COLLECT_CACHE_ENTRIES) });
	collectCacheMaxEntries;
	layers = new ScopedLayers((scope) => new SkillLayer(scope), () => {
		this.invalidateCache();
	});
	collectCache = /* @__PURE__ */ new Map();
	revision = 0;
	nextProviderOrder = 0;
	/** Stable identities for cache keys; scope keys are opaque identity-compared objects. */
	scopeIds = /* @__PURE__ */ new WeakMap();
	nextScopeId = 1;
	constructor(ctx, config = {}) {
		super(ctx, "skills");
		this.collectCacheMaxEntries = config.collectCacheMaxEntries ?? DEFAULT_COLLECT_CACHE_ENTRIES;
		assertPositiveInteger("collectCacheMaxEntries", this.collectCacheMaxEntries);
	}
	/**
	* Register a borrowed same-process provider synchronously during plugin
	* apply, into the calling context's layer: a scoped context (an agent
	* preset's standing mount) registers for that scope alone, an unscoped
	* context registers globally. Duplicate names within one layer and reserved
	* names throw; remote initialization belongs in `list()`. Fiber disposal
	* unregisters the provider and invalidates catalog caches.
	* @param create - synchronous factory receiving this registration's lifecycle and invalidation control.
	* @returns the exact Cordis effect disposer that unregisters this provider;
	*   composite effects may yield it directly to preserve teardown ordering.
	*/
	registerProvider(create) {
		const lifecycle = new AbortController();
		let registration;
		let provider;
		const control = {
			signal: lifecycle.signal,
			invalidate: () => {
				const active = registration;
				if (active !== void 0 && active.layer.providers.get(active.name)?.provider === provider) this.invalidateCache();
			}
		};
		try {
			provider = create(control);
			const name = provider.name;
			if (name === RUNTIME_PROVIDER) throw new Error(`"${RUNTIME_PROVIDER}" is reserved for runtime skill registrations`);
			const order = this.nextProviderOrder;
			this.nextProviderOrder += 1;
			return this.layers.effect(this.ctx, (layer) => {
				const undo = layer.providers.insert(name, {
					provider,
					order
				});
				registration = {
					layer,
					name
				};
				return () => {
					registration = void 0;
					undo();
					lifecycle.abort(/* @__PURE__ */ new Error(`skill provider "${name}" disposed`));
				};
			}, { label: "skills.registerProvider()" });
		} catch (error) {
			lifecycle.abort(error);
			throw error;
		}
	}
	/**
	* Register a borrowed readonly runtime skill into the calling context's
	* layer. Project entries outrank runtime entries, which outrank user
	* entries, within one layer. Same-name runtime entries in one layer are
	* first-wins; a duplicate logs a warning and receives a no-op disposer so
	* it cannot remove the winner.
	* @param skill - the skill definition input; omitted invocation and provider fields receive defaults.
	* @returns the exact Cordis effect disposer, preserving composite teardown order and invalidating caches.
	*/
	register(skill) {
		validateRuntimeSkill(skill);
		const scope = scopeOf(this.ctx);
		const existingLayer = scope === void 0 ? this.layers.global : this.layers.peek(scope);
		if (existingLayer !== void 0 && existingLayer.runtime.has(skill.name)) {
			this.ctx.logger.warn(`runtime skill "${skill.name}" ignored because it is already registered`);
			return () => {};
		}
		const definition = {
			...skill,
			invocation: skill.invocation ?? {
				modelInvocable: true,
				userInvocable: true
			},
			provider: skill.provider ?? RUNTIME_PROVIDER
		};
		return this.layers.effect(this.ctx, (layer) => {
			layer.runtime.set(definition.name, definition);
			return () => {
				layer.runtime.delete(definition.name);
			};
		}, { label: "skills.register()" });
	}
	/**
	* List invocation-neutral skill summaries for a workspace. Consumers apply
	* model or user invocation policy at their operational boundary. Lookup
	* options and provider candidates are readonly same-process values borrowed
	* throughout discovery.
	* @param options - view options; `scope` selects the viewing agent's layers, `cwd` selects project roots, and `signal` cancels discovery.
	* @returns all sorted winning summaries.
	*/
	async list(options = {}) {
		return (await this.snapshot(options)).skills;
	}
	/**
	* Observe the current invocation-neutral catalog and whether discovery completed within a stable revision.
	* Incomplete observations are never cached, allowing consumers to retain last-good state and
	* retry on their next request boundary.
	* @param options - view options; `scope` selects the viewing agent's layers, `cwd` selects project roots, and `signal` cancels discovery.
	* @returns sorted summaries plus discovery-completeness state.
	*/
	async snapshot(options = {}) {
		const collected = await this.collect(options);
		return {
			skills: [...collected.entries.values()].map((entry) => toSummary(entry.candidate)).sort(compareSkillSummary),
			complete: collected.cacheable
		};
	}
	/**
	* Load and validate the winning candidate, passing its opaque discovery locator back to the
	* provider. Cancellation is rechecked after selection, including cache hits, and raced against
	* loading so an uncooperative provider cannot hang the caller.
	* @param name - kebab-case skill name.
	* @param options - view options; `scope` selects the viewing agent's layers,
	*   `cwd` selects workspace-sensitive skills, and `signal` cancels work.
	* @returns the full skill, including body content, or `undefined`.
	*/
	async get(name, options = {}) {
		if (!isSkillName(name)) return void 0;
		const collected = await this.collect(options);
		throwIfAborted(options.signal);
		const match = collected.entries.get(name);
		if (match === void 0) return void 0;
		const definition = await waitWithAbort(match.provider.get(match.candidate, options), options.signal);
		if (definition === void 0) return void 0;
		validateDefinition(definition);
		if (definition.name !== match.candidate.name) {
			this.invalidateEntry(match);
			return;
		}
		return definition;
	}
	async collect(options) {
		throwIfAborted(options.signal);
		let attempt = 1;
		while (true) {
			const revision = this.revision;
			const key = this.collectCacheKey(options.cwd, scopeChainOf(options.scope), revision);
			const cached = this.collectCache.get(key);
			if (cached !== void 0) return {
				entries: cached,
				cacheable: true
			};
			const result = await this.collectFresh(options);
			throwIfAborted(options.signal);
			if (revision !== this.revision) {
				if (attempt < MAX_COLLECT_ATTEMPTS) {
					attempt += 1;
					continue;
				}
				return {
					entries: result.entries,
					cacheable: false
				};
			}
			if (result.cacheable) {
				this.collectCache.set(key, result.entries);
				if (this.collectCache.size > this.collectCacheMaxEntries) {
					const oldest = this.collectCache.keys().next();
					this.collectCache.delete(oldest.value);
				}
			}
			return result;
		}
	}
	async collectFresh(options) {
		const layers = [this.layers.global, ...this.layers.chainLayers(options.scope)];
		const merged = /* @__PURE__ */ new Map();
		let cacheable = true;
		for (const layer of layers) {
			const collected = await this.collectLayer(layer, options);
			if (!collected.cacheable) cacheable = false;
			for (const entry of collected.entries) merged.set(entry.candidate.name, entry);
		}
		return {
			entries: merged,
			cacheable
		};
	}
	async collectLayer(layer, options) {
		const collected = await this.listLayerCandidates(layer, options);
		collected.entries.sort(compareIndexedCandidates);
		const seen = /* @__PURE__ */ new Set();
		const result = [];
		for (const entry of collected.entries) {
			const skill = entry.candidate;
			if (seen.has(skill.name)) {
				this.ctx.logger.warn(`skill "${skill.name}" from ${skill.source} ignored because a higher-priority skill already exists`);
				continue;
			}
			seen.add(skill.name);
			result.push(entry);
		}
		return {
			entries: result,
			cacheable: collected.cacheable
		};
	}
	async listLayerCandidates(layer, options) {
		throwIfAborted(options.signal);
		const candidates = [];
		let cacheable = true;
		let runtimeOrder = 0;
		for (const skill of [...layer.runtime.values()].sort((a, b) => compareCodePoints(a.name, b.name))) {
			candidates.push({
				candidate: runtimeCandidate(skill),
				provider: RUNTIME_SKILL_PROVIDER,
				providerOrder: -1,
				localOrder: runtimeOrder,
				layer
			});
			runtimeOrder += 1;
		}
		for (const { provider, order } of [...layer.providers.values()]) {
			let localOrder = 0;
			let output;
			try {
				output = await waitWithAbort(provider.list(options), options.signal);
			} catch (error) {
				if (options.signal?.aborted === true) throw toError(options.signal.reason);
				cacheable = false;
				this.ctx.logger.warn(`skill provider "${provider.name}" skipped: ${errorMessage(error)}`);
			}
			if (output === void 0) continue;
			const observation = normalizeProviderObservation(output, provider.name);
			if (!observation.complete) cacheable = false;
			for (const candidate of observation.candidates) {
				validateCandidate(candidate, provider.name);
				candidates.push({
					candidate,
					provider,
					providerOrder: order,
					localOrder,
					layer
				});
				localOrder += 1;
			}
		}
		return {
			entries: candidates,
			cacheable
		};
	}
	invalidateCache() {
		this.revision += 1;
		this.collectCache.clear();
		this.notifyChange();
	}
	/** Invalidate after a stale definition load, only while the exact registration that produced the entry is still live. */
	invalidateEntry(entry) {
		/* v8 ignore else -- A definition load can outlive the exact provider registration it selected. */
		if (entry.layer.providers.get(entry.provider.name)?.provider === entry.provider) this.invalidateCache();
	}
	scopeId(key) {
		let id = this.scopeIds.get(key);
		if (id === void 0) {
			id = this.nextScopeId;
			this.nextScopeId += 1;
			this.scopeIds.set(key, id);
		}
		return id;
	}
	collectCacheKey(cwd, chain, revision) {
		return JSON.stringify({
			cwd,
			scopes: chain.map((key) => this.scopeId(key)),
			revision
		});
	}
	/** Notify catalog observers without making their refresh work load-bearing. */
	notifyChange() {
		for (const callback of this.ctx.events.dispatch("emit", ["skills/change"])) try {
			const returned = callback();
			Promise.resolve(returned).catch((error) => {
				this.ctx.logger.warn(`skills/change listener rejected: ${errorMessage(error)}`);
			});
		} catch (error) {
			this.ctx.logger.warn(`skills/change listener threw: ${errorMessage(error)}`);
		}
	}
});
function normalizeProviderObservation(output, providerName) {
	if (Array.isArray(output)) return {
		candidates: output,
		complete: true
	};
	if (output === null || typeof output !== "object") throw invalidProviderObservation(providerName);
	const observation = output;
	if (!Array.isArray(observation.candidates) || typeof observation.complete !== "boolean") throw invalidProviderObservation(providerName);
	return observation;
}
function invalidProviderObservation(providerName) {
	return /* @__PURE__ */ new TypeError(`skill provider "${providerName}" list() must return an array or { candidates, complete } observation`);
}
const RUNTIME_SKILL_PROVIDER = {
	name: RUNTIME_PROVIDER,
	/* v8 ignore next -- Runtime skills are injected directly by the registry; this provider only owns `get()`. */
	list() {
		return Promise.resolve([]);
	},
	get(candidate) {
		return Promise.resolve(candidate.locator);
	}
};
function runtimeCandidate(skill) {
	return {
		name: skill.name,
		description: skill.description,
		...skill.whenToUse !== void 0 ? { whenToUse: skill.whenToUse } : {},
		invocation: skill.invocation,
		source: skill.source,
		provider: skill.provider,
		...skill.resourceBase !== void 0 ? { resourceBase: skill.resourceBase } : {},
		rank: RUNTIME_RANK,
		locator: skill,
		...skill.path !== void 0 ? { path: skill.path } : {},
		...skill.metadata !== void 0 ? { metadata: skill.metadata } : {}
	};
}
function validateCandidate(candidate, providerName) {
	if (typeof candidate.name !== "string") throw new TypeError(`skill provider "${providerName}" returned a non-string skill name`);
	if (!SKILL_NAME.test(candidate.name)) throw new Error(`skill provider "${providerName}" returned invalid skill name "${candidate.name}"`);
	if (typeof candidate.description !== "string") throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string description`);
	if (candidate.description.length === 0) throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" without a description`);
	validateInvocation(candidate.invocation, `skill provider "${providerName}" returned skill "${candidate.name}"`);
	if (candidate.whenToUse !== void 0 && typeof candidate.whenToUse !== "string") throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string whenToUse`);
	if (typeof candidate.source !== "string") throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string source`);
	if (typeof candidate.rank !== "number" || !Number.isFinite(candidate.rank)) throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" with an invalid rank`);
	if (typeof candidate.provider !== "string") throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string provider`);
	if (candidate.provider !== providerName) throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" for provider "${candidate.provider}"`);
	if (candidate.path !== void 0 && typeof candidate.path !== "string") throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string path`);
}
function validateRuntimeSkill(skill) {
	if (!SKILL_NAME.test(skill.name)) throw new Error(`invalid skill name "${skill.name}"`);
	if (skill.description.length === 0) throw new Error(`skill "${skill.name}" requires a description`);
	validateInvocation(skill.invocation, `runtime skill "${skill.name}"`);
}
/** Validate a definition loaded from a provider-controlled parser or remote source. */
function validateDefinition(skill) {
	const name = skill.name;
	const description = skill.description;
	const whenToUse = skill.whenToUse;
	const invocation = skill.invocation;
	const source = skill.source;
	const provider = skill.provider;
	const content = skill.content;
	const path = skill.path;
	if (typeof name !== "string") throw new TypeError("loaded skill name must be a string");
	if (!SKILL_NAME.test(name)) throw new Error(`loaded skill has invalid name "${name}"`);
	if (typeof description !== "string") throw new TypeError(`loaded skill "${name}" description must be a string`);
	if (description.length === 0) throw new Error(`loaded skill "${name}" requires a description`);
	validateInvocation(invocation, `loaded skill "${name}"`);
	if (whenToUse !== void 0 && typeof whenToUse !== "string") throw new TypeError(`loaded skill "${name}" whenToUse must be a string`);
	if (typeof source !== "string") throw new TypeError(`loaded skill "${name}" source must be a string`);
	if (typeof provider !== "string") throw new TypeError(`loaded skill "${name}" provider must be a string`);
	if (typeof content !== "string") throw new TypeError(`loaded skill "${name}" content must be a string`);
	if (path !== void 0 && typeof path !== "string") throw new TypeError(`loaded skill "${name}" path must be a string`);
}
function toSummary(skill) {
	const { name, description, whenToUse, invocation, source, provider, resourceBase } = skill;
	return {
		name,
		description,
		...whenToUse !== void 0 ? { whenToUse } : {},
		invocation,
		source,
		provider,
		...resourceBase !== void 0 ? { resourceBase } : {}
	};
}
function validateInvocation(invocation, subject) {
	if (invocation === void 0) return;
	if (typeof invocation !== "object" || invocation === null || Array.isArray(invocation)) throw new TypeError(`${subject} with a non-object invocation policy`);
	const policy = invocation;
	if (typeof policy.modelInvocable !== "boolean") throw new TypeError(`${subject} with a non-boolean invocation.modelInvocable`);
	if (typeof policy.userInvocable !== "boolean") throw new TypeError(`${subject} with a non-boolean invocation.userInvocable`);
}
function compareSkillSummary(left, right) {
	return compareCodePoints(left.name, right.name);
}
function compareCodePoints(left, right) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
function compareIndexedCandidates(left, right) {
	return left.candidate.rank - right.candidate.rank || left.providerOrder - right.providerOrder || left.localOrder - right.localOrder;
}
function assertPositiveInteger(name, value, minimum = 1) {
	if (!Number.isInteger(value) || value < minimum) throw new Error(`skill: ${name} must be an integer greater than or equal to ${minimum}`);
}
function waitWithAbort(promise, signal) {
	if (signal === void 0) return promise;
	throwIfAborted(signal);
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			signal.removeEventListener("abort", onAbort);
		};
		const onAbort = () => {
			cleanup();
			reject(toError(signal.reason));
		};
		signal.addEventListener("abort", onAbort, { once: true });
		promise.then((value) => {
			cleanup();
			resolve(value);
		}, (error) => {
			cleanup();
			reject(toError(error));
		});
	});
}
/** Throw a total Error for an already-aborted lookup. */
function throwIfAborted(signal) {
	if (signal?.aborted === true) throw toError(signal.reason);
}
/** Normalize an arbitrary abort or provider failure without trusting coercion. */
function toError(error) {
	try {
		if (error instanceof Error) return error;
	} catch {}
	return new Error(errorMessage(error));
}
/** Render an arbitrary provider failure without letting coercion escape containment. */
function errorMessage(error) {
	try {
		return String(error);
	} catch {
		return "[unrenderable thrown value]";
	}
}
//#endregion
//#region lib/types/content.js
/**
* Ponytail skill bodies, ported from github.com/DietrichGebert/ponytail and
* lightly adapted to the DeepSeek Harness surface (slash commands and the
* `skill` tool). The `ponytail` skill is a mode-aware pointer card: the actual
* ruleset is injected per session as the mode-filtered `PONYTAIL MODE ACTIVE`
* section (see `instructions.ts`) and must not be duplicated here. The other
* five skills ship verbatim as runtime skills.
*
* @module @deepseek-ai/dsh-ponytail
*/
/** The always-on lazy-senior-dev ruleset: also registered as a loadable skill. */
const PONYTAIL_SKILL_BODY = `
You are the ponytail persona — the lazy senior developer. Your active ruleset
is ALREADY injected every turn as the "PONYTAIL MODE ACTIVE — level: <mode>"
system-prompt section, filtered to this session's intensity. Follow exactly
that section; do NOT reload, replace, or re-derive the ruleset from anywhere
else — the section is the single source of truth and it is mode-aware.

- Switch level: \`/ponytail lite|full|ultra|off\` (session-scoped)
- Query: \`/ponytail status\`
- Deactivate: "stop ponytail" / "normal mode"
- One-shot skills: \`/ponytail-review\`, \`/ponytail-audit\`, \`/ponytail-debt\`,
  \`/ponytail-gain\`, \`/ponytail-help\`
- Reference: https://github.com/DietrichGebert/ponytail
`;
const PONYTAIL_DESCRIPTION = "Ponytail activation, modes, configuration, and help reference. The active ruleset is injected every turn by the system prompt; this skill is a pointer card. Use only when the user asks about Ponytail activation, modes, configuration, or help. Coding tasks already receive the active ruleset from the system prompt.";
const REVIEW_SKILL_BODY = `
Review diffs for unnecessary complexity. One line per finding: location, what
to cut, what replaces it. The diff's best outcome is getting shorter.

## Format

\`L<line>: <tag> <what>. <replacement>.\`, or \`<file>:L<line>: ...\` for
multi-file diffs.

Tags:

- \`delete:\` dead code, unused flexibility, speculative feature. Replacement: nothing.
- \`stdlib:\` hand-rolled thing the standard library ships. Name the function.
- \`native:\` dependency or code doing what the platform already does. Name the feature.
- \`yagni:\` abstraction with one implementation, config nobody sets, layer with one caller.
- \`shrink:\` same logic, fewer lines. Show the shorter form.

## Examples

❌ "This EmailValidator class might be more complex than necessary, have you
considered whether all these validation rules are needed at this stage?"

✅ \`L12-38: stdlib: 27-line validator class. "@" in email, 1 line, real validation is the confirmation mail.\`

✅ \`L4: native: moment.js imported for one format call. Intl.DateTimeFormat, 0 deps.\`

✅ \`repo.py:L88: yagni: AbstractRepository with one implementation. Inline it until a second one exists.\`

✅ \`L52-71: delete: retry wrapper around an idempotent local call. Nothing replaces it.\`

✅ \`L30-44: shrink: manual loop builds dict. dict(zip(keys, values)), 1 line.\`

## Scoring

End with the only metric that matters: \`net: -<N> lines possible.\`

If there is nothing to cut, say \`Lean already. Ship.\` and stop.

## Boundaries

Scope: over-engineering and complexity only. Correctness bugs, security holes,
and performance are explicitly out of scope. Route them to a normal review
pass, not this one. A single smoke test or \`assert\`-based
self-check is the ponytail minimum, not bloat, never flag it for deletion.
Does not apply the fixes, only lists them.
"stop ponytail-review" or "normal mode": revert to verbose review style.
`;
const REVIEW_DESCRIPTION = "Code review focused exclusively on over-engineering. Finds what to delete: reinvented standard library, unneeded dependencies, speculative abstractions, dead flexibility. One line per finding: location, what to cut, what replaces it. Use when the user says \"review for over-engineering\", \"what can we delete\", \"is this over-engineered\", \"simplify review\", or invokes /ponytail-review. Complements correctness-focused review, this one only hunts complexity.";
const AUDIT_SKILL_BODY = `
ponytail-review, repo-wide. Scan the whole tree instead of a diff. Rank
findings biggest cut first.

## Tags

Same as ponytail-review:

- \`delete:\` dead code, unused flexibility, speculative feature. Replacement: nothing.
- \`stdlib:\` hand-rolled thing the standard library ships. Name the function.
- \`native:\` dependency or code doing what the platform already does. Name the feature.
- \`yagni:\` abstraction with one implementation, config nobody sets, layer with one caller.
- \`shrink:\` same logic, fewer lines. Show the shorter form.

## Hunt

Deps the stdlib or platform already ships, single-implementation interfaces,
factories with one product, wrappers that only delegate, files exporting one
thing, dead flags and config, hand-rolled stdlib.

## Output

One line per finding, ranked: \`<tag> <what to cut>. <replacement>. [path]\`.
End with \`net: -<N> lines, -<M> deps possible.\` Nothing to cut: \`Lean already. Ship.\`

## Boundaries

Scope: over-engineering and complexity only. Correctness bugs, security holes,
and performance are explicitly out of scope. Route them to a normal review
pass. Lists findings, applies nothing. One-shot.
"stop ponytail-audit" or "normal mode" to revert.
`;
const AUDIT_DESCRIPTION = "Whole-repo audit for over-engineering. Like ponytail-review, but scans the entire codebase instead of a diff: a ranked list of what to delete, simplify, or replace with stdlib/native equivalents. Use when the user says \"audit this codebase\", \"audit for over-engineering\", \"what can I delete from this repo\", \"find bloat\", \"ponytail-audit\", or /ponytail-audit. One-shot report, does not apply fixes.";
const DEBT_SKILL_BODY = `
Every deliberate ponytail shortcut is marked with a \`ponytail:\` comment naming
its ceiling and upgrade path. This collects them into one ledger so a deferral
can't quietly become permanent.

## Scan

Grep the repo for comment markers, skipping \`node_modules\`, \`.git\`, and build
output:

\`grep -rnE '(#|//) ?ponytail:' .\`  (add other comment prefixes if your stack uses them)

Each hit is one ledger row. The comment prefix keeps prose that merely mentions
the convention out of the ledger.

## Output

One row per marker, grouped by file:

\`<file>:<line>, <what was simplified>. ceiling: <the limit named>. upgrade: <the trigger to revisit>.\`

The convention is \`ponytail: <ceiling>, <upgrade path>\`, so pull the ceiling
and the trigger straight from the comment. Want an owner per row too? add
\`git blame -L<line>,<line>\`.

Flag the rot risk: any \`ponytail:\` comment that names no upgrade path or
trigger gets a \`no-trigger\` tag, those are the ones that silently rot.

End with \`<N> markers, <M> with no trigger.\` Nothing found: \`No ponytail: debt. Clean ledger.\`

## Boundaries

Reads and reports only, changes nothing. To persist it, ask and it writes the
ledger to a file (e.g. \`PONYTAIL-DEBT.md\`). One-shot. "stop ponytail-debt" or
"normal mode" to revert.
`;
const DEBT_DESCRIPTION = "Harvest every `ponytail:` comment in the codebase into a debt ledger, so the deliberate shortcuts and deferrals ponytail leaves behind get tracked instead of rotting into \"later means never\". Use when the user says \"ponytail debt\", \"/ponytail-debt\", \"what did ponytail defer\", \"list the shortcuts\", \"ponytail ledger\", or \"what did we mark to do later\". One-shot report, changes nothing.";
const GAIN_SKILL_BODY = `
Display this scoreboard when invoked. One-shot: do NOT change mode, write flag
files, or persist anything.

These are upstream Ponytail results, not measured guarantees for this DSH
adapter.

Savings depend on model, workload, prompt caching, tool usage, and execution
path. Already-minimal tasks may show little or no savings. Some reasoning
models may become more expensive because prompt and reasoning overhead can
exceed the saved output.

## 1. Upstream agentic reference

Real Claude Code sessions on real repositories; 12 feature tasks:

- Source LOC: ~\u221254%
- Tokens: ~\u221222%
- Cost: ~\u221220%
- Time: ~\u221227%
- Over-build tasks: \u221260\u201394%
- Safety tests: 100%

## 2. Upstream single-shot reference

5 everyday tasks (email validator, debounce, CSV sum, countdown timer, rate
limiter); 3 Claude models; single generation per task:

- Lines of code: \u221280\u201394%
- Cost (Claude): \u221242\u201375%
- Latency: ~3.1\u20135.8\u00d7 faster

## 3. DSH adapter status

Current DSH smoke tests provide directional evidence only. Stable token,
cost, and latency savings have not been established.

See the repository's DSH smoke reports for limited, non-statistical
directional evidence (docs/dsh-smoke-summary.md).

## 4. Honesty boundary

These are upstream benchmark medians, not this repo and not this DSH
adapter. NEVER print a per-repo savings number ("you saved X lines/tokens
here"): the unbuilt version was never written, so there is no real baseline
to subtract from in a live repo. The only real per-repo figures come from
\`/ponytail-debt\` (a counted ledger), and this card points there instead of
inventing one. Never claim "Ponytail always saves tokens/cost" or that this
adapter reproduces the upstream percentages. A missing cost figure (null) is
not a zero cost.

## Boundaries

One-shot display. Edits nothing, changes no mode.
"stop ponytail" or "normal mode": revert.
`;
const GAIN_DESCRIPTION = "Less unnecessary work; token, cost, and latency effects depend on model and workload. Upstream benchmark reference, not a DSH-adapter guarantee. One-shot display, not a persistent mode, and not a per-repo number. Trigger: /ponytail-gain, \"ponytail gain\", \"what does ponytail save\", \"show ponytail impact\", \"ponytail scoreboard\".";
const HELP_SKILL_BODY = `
Display this reference card when invoked. One-shot, do NOT change mode,
write flag files, or persist anything.

## Levels

| Level | Trigger | What change |
|-------|---------|-------------|
| **Lite** | \`/ponytail lite\` | Build what's asked, name the lazier alternative in one line. |
| **Full** | \`/ponytail\` | The ladder enforced: YAGNI → stdlib → native → one line → minimum. Default. |
| **Ultra** | \`/ponytail ultra\` | YAGNI extremist: deletion first, questions speculation — never cuts explicit requirements. |
| **Off** | \`/ponytail off\` | Ponytail stops injecting its ruleset for this session. |

Level is session-scoped until changed.

## Choosing a level

- **Lite**: Use for small, explicit changes or when the implementation is
  already clear. Completes explicit requirements without actively
  challenging them.
  Lite：小改动、需求明确时使用。
- **Full**: Use for new features, refactors, root-cause bug fixes, or tasks
  likely to invite unnecessary abstractions, dependencies, or custom
  components.
  Full：新功能、重构、根因修复、容易过度设计时使用。
- **Ultra**: Use for deliberate code cleanup and over-engineering removal.
  It questions speculative scope, but never removes explicit requirements,
  security, validation, accessibility, or data-loss protection.
  Ultra：专门清理冗余和过度抽象时使用。
- **Off**: Use when the task is non-coding, already fully specified, or when
  the fixed prompt overhead is not worthwhile.
  Off：非编码任务或已经明确到无需额外编码判断的任务。

Ponytail is not a guaranteed token-saving switch. It trades a small fixed
prompt cost for a chance to reduce unnecessary work. Do not default every
task to Ultra.

## Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **ponytail** | \`/ponytail\` | Lazy mode itself. Simplest solution that works. |
| **ponytail-review** | \`/ponytail-review\` | Over-engineering review: \`L42: yagni: factory, one product. Inline.\` |
| **ponytail-audit** | \`/ponytail-audit\` | Whole-repo over-engineering audit: ranked list of what to delete. |
| **ponytail-debt** | \`/ponytail-debt\` | Harvest \`ponytail:\` shortcut comments into a tracked ledger. |
| **ponytail-gain** | \`/ponytail-gain\` | Upstream benchmark reference: less unnecessary work; token/cost/latency effects depend on model and workload. |
| **ponytail-help** | \`/ponytail-help\` | This card. |

You can also load any of these with the \`skill\` tool.

## Deactivate

Say "stop ponytail" or "normal mode". Resume anytime with \`/ponytail\` —
it re-enables at the effective default (or \`full\` when that is off too).
\`/ponytail status\` only shows the current level, never changes it.
\`/ponytail off\` also works. Level is session-scoped; a new session starts
from the configured default.

## Configure Default Mode

Default mode = \`full\`, auto-active every session. Change it:

**Environment variable** (highest priority):
\`\`\`bash
export PONYTAIL_DEFAULT_MODE=ultra
\`\`\`

**Config file** (\`~/.config/ponytail/config.json\`, Windows: \`%APPDATA%\\ponytail\\config.json\`):
\`\`\`json
{ "defaultMode": "lite" }
\`\`\`

**Profile config** (per DSH profile, via the bundle row's \`config\` — e.g.
\`tui\` → lite):

\`\`\`yaml
- insert:
    - id: ponytail
      name: '@mengyuly/dsh-ponytail'
      config:
        defaultMode: lite
\`\`\`

Set \`"off"\` to disable auto-activation on session start, activate manually
with \`/ponytail\` when wanted. \`/ponytail default <mode>\` persists a new
default to the user config file; an exported \`PONYTAIL_DEFAULT_MODE\` or a
profile \`defaultMode\` still outranks the saved value for new sessions.

Resolution: session override > env var > profile config > config file > \`full\`.

## More

Full docs + examples: https://github.com/DietrichGebert/ponytail
`;
const HELP_DESCRIPTION = "Quick-reference card for all ponytail modes, skills, and commands. One-shot display, not a persistent mode. Trigger: /ponytail-help, \"ponytail help\", \"what ponytail commands\", \"how do I use ponytail\".";
/** Ordered set of runtime skills surfaced to the model catalog and `/` menu. */
function ponytailSkills() {
	return [
		{
			name: "ponytail",
			source: "runtime",
			description: PONYTAIL_DESCRIPTION,
			whenToUse: "Use only when the user asks about Ponytail activation, modes, configuration, or help. Coding tasks already receive the active ruleset from the system prompt.",
			content: PONYTAIL_SKILL_BODY,
			invocation: {
				modelInvocable: false,
				userInvocable: true
			}
		},
		{
			name: "ponytail-review",
			source: "runtime",
			description: REVIEW_DESCRIPTION,
			content: REVIEW_SKILL_BODY,
			invocation: {
				modelInvocable: true,
				userInvocable: true
			}
		},
		{
			name: "ponytail-audit",
			source: "runtime",
			description: AUDIT_DESCRIPTION,
			content: AUDIT_SKILL_BODY,
			invocation: {
				modelInvocable: true,
				userInvocable: true
			}
		},
		{
			name: "ponytail-debt",
			source: "runtime",
			description: DEBT_DESCRIPTION,
			content: DEBT_SKILL_BODY,
			invocation: {
				modelInvocable: true,
				userInvocable: true
			}
		},
		{
			name: "ponytail-gain",
			source: "runtime",
			description: GAIN_DESCRIPTION,
			content: GAIN_SKILL_BODY,
			invocation: {
				modelInvocable: true,
				userInvocable: true
			}
		},
		{
			name: "ponytail-help",
			source: "runtime",
			description: HELP_DESCRIPTION,
			content: HELP_SKILL_BODY,
			invocation: {
				modelInvocable: true,
				userInvocable: true
			}
		}
	];
}
//#endregion
//#region lib/types/modes.js
/**
* Ponytail mode resolution: the effective default comes from, in order, the
* `PONYTAIL_DEFAULT_MODE` environment variable, the Cordis profile
* `defaultMode`, the optional user config file
* `~/.config/ponytail/config.json` (`defaultMode`), then `full`. Setting a
* level via the `/ponytail` command is session-scoped and lives in an
* in-memory, per-agent {@link ModeStore}.
*
* @module @deepseek-ai/dsh-ponytail
*/
const DEFAULT_MODE = "full";
const RUNTIME_MODES = [
	"off",
	"lite",
	"full",
	"ultra"
];
/** Strip a UTF-8 BOM that Windows editors prepend before JSON.parse. */
function stripBom(text) {
	return text.replace(/^\uFEFF/, "");
}
/**
* Normalize free-form input to a runtime intensity. `null` for anything that
* is not exactly `off`, `lite`, `full`, or `ultra`.
*/
function normalizeRuntimeMode(mode) {
	if (typeof mode !== "string") return null;
	const normalized = mode.trim().toLowerCase();
	return RUNTIME_MODES.includes(normalized) ? normalized : null;
}
/**
* Deactivation commands only match when the whole message is the command,
* ignoring case and trailing punctuation. Matching the phrase anywhere would
* turn ponytail off mid-task for ordinary requests like "add a normal mode
* toggle".
*/
function isDeactivationCommand(text) {
	const normalized = (typeof text === "string" ? text : "").trim().toLowerCase().replace(/[\s.!?。？！]+$/, "");
	return normalized === "stop ponytail" || normalized === "normal mode";
}
/** Config directory: `$XDG_CONFIG_HOME/ponytail`, `%APPDATA%\ponytail`, else `~/.config/ponytail`. */
function configDir(env = process.env) {
	if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, "ponytail");
	if (process.platform === "win32") return join(env.APPDATA || join(homedir(), "AppData", "Roaming"), "ponytail");
	return join(homedir(), ".config", "ponytail");
}
/** Absolute path of the optional `config.json`. */
function configPath(env = process.env) {
	return join(configDir(env), "config.json");
}
/**
* Read the configured default with diagnostics. Priority:
* `PONYTAIL_DEFAULT_MODE` → Cordis profile `defaultMode` → user config file →
* `full`. A missing config file is normal and yields no issue; a broken one
* yields the fallback mode plus one issue for the caller to warn about once.
* @param env - the process environment to read.
* @param profileMode - the validated Cordis profile `defaultMode`, or `null`
*   when the profile config is absent or invalid (invalid values are reported
*   by the caller; this function only consumes valid ones).
*/
function readDefaultModeInfo(env = process.env, profileMode = null) {
	const path = configPath(env);
	const envMode = normalizeRuntimeMode(env.PONYTAIL_DEFAULT_MODE);
	let configText;
	try {
		configText = readFileSync(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return { mode: envMode ?? profileMode ?? "full" };
		return {
			mode: envMode ?? profileMode ?? "full",
			issue: {
				kind: "read",
				detail: `${path}: ${error.message}`
			}
		};
	}
	let configIssue;
	let fromConfig = null;
	try {
		const parsed = JSON.parse(stripBom(configText));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) configIssue = {
			kind: "shape",
			detail: `${path}: root must be a JSON object`
		};
		else if ("defaultMode" in parsed) {
			fromConfig = normalizeRuntimeMode(parsed.defaultMode);
			if (!fromConfig) configIssue = {
				kind: "value",
				detail: `${path}: defaultMode is not lite|full|ultra|off`
			};
		}
	} catch (error) {
		configIssue = {
			kind: "json",
			detail: `${path}: ${error.message}`
		};
	}
	if (envMode) return {
		mode: envMode,
		...configIssue ? { issue: configIssue } : {}
	};
	if (profileMode) return {
		mode: profileMode,
		...configIssue ? { issue: configIssue } : {}
	};
	if (configIssue) return {
		mode: DEFAULT_MODE,
		issue: configIssue
	};
	return { mode: fromConfig ?? "full" };
}
/**
* Read the configured default for this host: environment variable first, then
* the Cordis profile `defaultMode`, then the user config file, then `full`.
*/
function readDefaultMode(env = process.env, profileMode = null) {
	return readDefaultModeInfo(env, profileMode).mode;
}
/**
* Why a `saved` default is not the effective one — for the `/ponytail default`
* result message. `null` means the saved value is effective.
*/
function defaultOverrideReason(env, profileMode) {
	if (normalizeRuntimeMode(env.PONYTAIL_DEFAULT_MODE)) return "PONYTAIL_DEFAULT_MODE";
	if (profileMode) return "profile configuration";
	return null;
}
/**
* Persist a new default level to the config file, preserving other fields.
* Returns the normalized mode, or `null` when the value is not a runtime mode.
* Throws when the write itself fails, so callers never report success for a
* file that was not written.
*/
function writeDefaultMode(mode, env = process.env) {
	const normalized = normalizeRuntimeMode(mode);
	if (!normalized) return null;
	const path = configPath(env);
	let config = {};
	try {
		const parsed = JSON.parse(stripBom(readFileSync(path, "utf8")));
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) config = parsed;
	} catch {}
	config.defaultMode = normalized;
	const text = `${JSON.stringify(config, null, 2)}\n`;
	mkdirSync(dirname(path), { recursive: true });
	const temp = join(dirname(path), `.config-${process.pid}-${Date.now()}.tmp`);
	try {
		writeFileSync(temp, text, "utf8");
		renameSync(temp, path);
	} catch (error) {
		try {
			unlinkSync(temp);
		} catch {}
		throw new Error(`failed to write ${path}: ${error.message}`);
	}
	return normalized;
}
/**
* Session-scoped live mode. The absence of an entry means "use the configured
* default", which matches the upstream behavior where each session starts from
* the default until the user switches it.
*/
var ModeStore = class {
	modes = /* @__PURE__ */ new Map();
	/** The mode in force for one agent, or the configured default. */
	modeFor(agentId, fallback) {
		return this.modes.get(agentId) ?? fallback;
	}
	/** Set the mode for one agent's session (session-scoped, survives until changed or disposal). */
	set(agentId, mode) {
		this.modes.set(agentId, mode);
	}
	/** Forget a session-scoped override so the next lookup returns the default. */
	clear(agentId) {
		this.modes.delete(agentId);
	}
};
/**
* Compile `PONYTAIL_SUBAGENT_MATCHER` into a case-insensitive regex. An unset
* matcher yields `null`; an invalid pattern stays fail-open (every agent gets
* the ruleset) but is reported so the caller can warn exactly once.
*/
function compileSubagentMatcher(raw) {
	if (!raw) return {
		matcher: null,
		invalid: false
	};
	try {
		return {
			matcher: new RegExp(raw, "i"),
			invalid: false
		};
	} catch {
		return {
			matcher: null,
			invalid: true
		};
	}
}
/**
* The stable per-session identity backing every mode override. DSH's `Agent`
* type documents `id` as "the single identity shared with session", so the
* agent id IS the SessionId: one entry per live session, never shared between
* two sessions, and stable across the session's lifetime. Centralized so the
* key choice lives in exactly one place.
*/
function sessionKey(agent) {
	return agent.id;
}
/** Whether a session is a subagent child (origin, or any delegation depth with no origin). */
function isSubagentSession(header) {
	return header.origin === "subagent" || (header.delegationDepth ?? 0) > 0;
}
//#endregion
//#region lib/types/instructions.js
/**
* Structured ponytail ruleset composition. Each intensity is built from
* explicit fragments — common rules, a never-cut safety boundary list, and
* the mode's own rules — instead of filtering one Markdown body with regexes.
* The three intensities therefore differ in their actual instructions, not
* just in a table row.
*
* @module @deepseek-ai/dsh-ponytail
*/
/** Shared identity line, carried by every non-`off` mode. */
const INTRO = "You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.";
/**
* Understanding-and-reuse baseline, identical in every non-`off` mode.
*/
const COMMON_RULES = [
	"Understand the problem before choosing a solution: read the code the change touches and trace the real flow end to end. Laziness that skips comprehension ships a confident wrong fix.",
	"Reuse what already exists in this codebase before writing anything new.",
	"Reach for the standard library, platform-native features, and already-installed dependencies before custom code.",
	"A non-trivial change leaves ONE minimal runnable check behind (an assert-based self-check or one small test file; no frameworks). Trivial one-liners need no test.",
	"Explain briefly, but never omit the key decisions."
].join("\n");
/**
* The never-cut list. Every non-`off` mode keeps these; intensities tune how
* aggressively code is minimized, never what may be dropped.
*/
const SAFETY_BOUNDARIES = [
	"Never cut, in any mode:",
	"- Input validation at trust boundaries.",
	"- Error handling that prevents data loss.",
	"- Security measures.",
	"- Accessibility basics.",
	"- Explicit acceptance criteria the user asked for.",
	"- Understanding the problem and tracing the real flow first.",
	"- The real end-to-end data flow: no UI-only field, unused state, placeholder path, or disconnected payload.",
	"- Necessary tests for non-trivial changes.",
	"- Root-cause fixes over symptom patches.",
	"- \"Minimal diff\" is not a substitute for \"correct fix\"."
].join("\n");
/** Lite: complete the explicit ask; reuse; suggest, do not challenge. */
const LITE_RULES = [
	"Complete everything explicitly requested, including every acceptance criterion.",
	"Prefer existing code, standard-library features, native platform features, and already-installed dependencies.",
	"You may mention a simpler alternative briefly, but do not challenge or reject an explicit requirement.",
	"Do not change the existing architecture merely to reduce line count.",
	"Keep the smallest reasonable validation for non-trivial changes."
].join("\n");
/** Smallest complete end-to-end change: shared by Full and Ultra. */
const E2E_RULES = [
	"Smallest complete end-to-end change:",
	"- Prefer the smallest complete end-to-end change compatible with the existing architecture, not merely the fewest lines in one file.",
	"- Before creating a component, abstraction, protocol, migration, transport format, storage format, or dependency, inspect the repository’s existing path and preserve its current contract.",
	"- Do not redesign transport, storage, API shape, or persistence when the task only asks for a local UI or behavior change.",
	"- A locally smaller implementation that changes the system contract is not smaller overall.",
	"- Prefer the smallest complete change across the real data flow: input → state → validation → payload → API → persistence → response/UI.",
	"- It does not mean every layer must change: the change must be complete across the layers it touches.",
	"- Do not leave a UI-only field, unused state, placeholder path, or disconnected payload merely because it produces a smaller diff."
].join("\n");
const MODE_RULES = {
	lite: LITE_RULES,
	full: [
		"Use the complete ladder — stop at the first rung that holds:",
		"1. Does this need to exist at all? (YAGNI)",
		"2. Does it already exist in this codebase? Reuse it.",
		"3. Does the standard library do it? Use it.",
		"4. Does a native platform feature cover it? Use it.",
		"5. Does an already-installed dependency solve it? Use it.",
		"6. Can the solution be reduced to a small expression? Make it that small.",
		"7. Only then: write the minimum new implementation.",
		"Default to the shortest correct implementation; prefer deletion and reuse, but do not trade away correctness, security, tests, explicit requirements, or the existing system contract.",
		"Fix root causes, not symptoms: one guard in the shared function beats a guard in every caller.",
		"",
		E2E_RULES
	].join("\n"),
	ultra: [
		"Delete before adding.",
		"Actively question speculative features, caches, abstractions, configuration, migrations, transport changes, storage changes, and new dependencies.",
		"Prefer the smallest complete end-to-end change, not the smallest local diff.",
		"Do not change an existing contract merely to reduce lines.",
		"For complex requests, ship the smallest correct complete version and state what would justify a larger version.",
		"Ultra is not refusal: explicit requirements, safety, validation, accessibility, data protection, and acceptance criteria remain mandatory.",
		"",
		E2E_RULES
	].join("\n")
};
const MODE_LABELS = {
	lite: "Lite",
	full: "Full",
	ultra: "Ultra"
};
/** Compose the complete section text for one intensity. */
function render(effective) {
	return [
		`PONYTAIL MODE ACTIVE — level: ${effective}`,
		"",
		INTRO,
		"",
		"## Common rules (all modes)",
		COMMON_RULES,
		"",
		"## Safety boundaries (never cut)",
		SAFETY_BOUNDARIES,
		"",
		`## ${MODE_LABELS[effective]} rules`,
		MODE_RULES[effective]
	].join("\n");
}
/**
* The injected ruleset for one intensity, composed from the structured
* fragments above. Returns an empty string for `off` (ponytail contributes
* nothing). Renders are pure per mode and cached so every turn's bytes stay
* identical.
*/
function getPonytailInstructions(mode) {
	const effective = normalizeRuntimeMode(mode) ?? "full";
	if (effective === "off") return "";
	const cached = instructionCache.get(effective);
	if (cached !== void 0) return cached;
	const rendered = render(effective);
	instructionCache.set(effective, rendered);
	return rendered;
}
/** Rendered rulesets are pure per mode; cache to keep every turn's bytes identical. */
const instructionCache = /* @__PURE__ */ new Map();
//#endregion
//#region lib/types/index.js
/**
* Ponytail: the "lazy senior developer" persona as a DeepSeek Harness plugin.
*
* One system-prompt section injects the mode-filtered ruleset every turn (the
* always-on adapter), six runtime skills surface the review/audit/debt/gain/
* help one-shots, six slash commands drive them from the command plane, and an
* `agent/pre-step` listener honors the plain-text deactivation phrases.
*
* Mode is session-scoped and held in memory; the configured default resolves
* from `PONYTAIL_DEFAULT_MODE`, then the Cordis profile `defaultMode`, then
* `~/.config/ponytail/config.json` (see {@link readDefaultMode}), then
* `full`. A session override via `/ponytail` outranks all of them.
*
* @module @deepseek-ai/dsh-ponytail
*/
const name = "ponytail";
const inject = ["systemPrompt", "skills"];
/** Prompt-section order: after the deployment persona (0), before tool guidance (100–199). */
const SECTION_ORDER = 40;
/** Build the one text-line notification a mode switch leaves for the model. */
function modeNotice(mode) {
	return mode === "off" ? "PONYTAIL MODE OFF" : `PONYTAIL MODE CHANGED — level: ${mode}`;
}
/** Extract the plain text of one user message (only its text blocks). */
function messageText(message) {
	const parts = [];
	for (const block of message.content) if (block.type === "text" && typeof block.text === "string") parts.push(block.text);
	return parts.join("\n");
}
/** Whether any message in a claimed batch is exactly a deactivation command. */
function containsDeactivation(messages) {
	return messages.some((message) => isDeactivationCommand(messageText(message)));
}
/** Mode visible to one agent: its session override, else the configured default. */
function modeFor(deps, agent) {
	return deps.store.modeFor(sessionKey(agent), deps.defaultMode());
}
/**
* Queue one skill's full `<skill_content>` rendering as the model's next
* ordinary turn, with the same user-explicit `skill-invocation` source the
* built-in gesture boundary uses.
*/
async function queueSkill(deps, invocation, skill) {
	const loaded = await deps.ctx.skills.get(skill, {
		cwd: invocation.agent.session.header.cwd,
		signal: invocation.signal
	});
	if (loaded === void 0) return {
		kind: "error",
		text: `skill "${skill}" is not available`
	};
	const notes = invocation.rawInput.trim();
	const text = renderSkillContent(loaded) + (notes === "" ? "" : `\n\n${notes}`);
	invocation.agent.followup(createUserMessage({
		content: [{
			type: "text",
			text
		}],
		source: {
			kind: "skill-invocation",
			name: skill,
			form: "instructions"
		}
	}));
	return {
		kind: "success",
		text: `Queued ${skill} for the agent.`
	};
}
function registerCommands(deps, commandCtx) {
	commandCtx.commands.register({
		name: "ponytail",
		description: "Set or show Ponytail lazy senior dev intensity",
		input: { hint: "[status|default <mode>|lite|full|ultra|off]" },
		handler: ({ agent, rawInput }) => {
			const input = rawInput.trim().toLowerCase();
			const [head, ...rest] = input.split(/\s+/).filter(Boolean);
			if ((head ?? "") === "default") {
				let written;
				try {
					written = writeDefaultMode(rest[0]);
				} catch (error) {
					return {
						kind: "error",
						text: `Failed to save default: ${error.message}`
					};
				}
				if (!written) return {
					kind: "error",
					text: "Usage: /ponytail default [lite|full|ultra|off]"
				};
				const effective = readDefaultMode(process.env, deps.profileMode);
				deps.setDefault(effective);
				const reason = defaultOverrideReason(process.env, deps.profileMode);
				if (reason !== null) {
					agent.steer(createUserMessage({
						content: [{
							type: "text",
							text: `PONYTAIL DEFAULT SET — saved ${written}, effective ${effective} (${reason}).`
						}],
						source: {
							kind: "plugin",
							plugin: name
						}
					}));
					return {
						kind: "success",
						text: `Saved default: ${written}. Effective default: ${effective}, overridden by ${reason}.`
					};
				}
				agent.steer(createUserMessage({
					content: [{
						type: "text",
						text: `PONYTAIL DEFAULT SET — new sessions start in ${written}.`
					}],
					source: {
						kind: "plugin",
						plugin: name
					}
				}));
				return {
					kind: "success",
					text: `Ponytail default set — new sessions start in ${written}.`
				};
			}
			if (input === "status") return {
				kind: "success",
				text: `Ponytail mode: ${modeFor(deps, agent)}. Use /ponytail lite|full|ultra|off.`
			};
			if (input === "") {
				const current = modeFor(deps, agent);
				const effectiveDefault = deps.defaultMode();
				if (current === "off") {
					if (effectiveDefault === "off") {
						deps.store.set(sessionKey(agent), "full");
						agent.steer(createUserMessage({
							content: [{
								type: "text",
								text: "PONYTAIL MODE CHANGED — level: full"
							}],
							source: {
								kind: "plugin",
								plugin: name
							}
						}));
						return {
							kind: "success",
							text: "Ponytail re-enabled at full (the effective default is off)."
						};
					}
					deps.store.clear(sessionKey(agent));
					agent.steer(createUserMessage({
						content: [{
							type: "text",
							text: `PONYTAIL MODE ACTIVE — level: ${effectiveDefault}`
						}],
						source: {
							kind: "plugin",
							plugin: name
						}
					}));
					return {
						kind: "success",
						text: `Ponytail re-enabled. Effective default: ${effectiveDefault}.`
					};
				}
				agent.steer(createUserMessage({
					content: [{
						type: "text",
						text: `PONYTAIL MODE ACTIVE — level: ${current}`
					}],
					source: {
						kind: "plugin",
						plugin: name
					}
				}));
				return {
					kind: "success",
					text: `Ponytail mode: ${current}. Use /ponytail lite|full|ultra|off.`
				};
			}
			const mode = normalizeRuntimeMode(input);
			if (!mode) return {
				kind: "error",
				text: "Usage: /ponytail [status|default <mode>|lite|full|ultra|off]"
			};
			deps.store.set(sessionKey(agent), mode);
			agent.steer(createUserMessage({
				content: [{
					type: "text",
					text: modeNotice(mode)
				}],
				source: {
					kind: "plugin",
					plugin: name
				}
			}));
			return {
				kind: "success",
				text: mode === "off" ? "Ponytail mode off." : `Ponytail mode set to ${mode}.`
			};
		}
	});
	for (const skill of [
		"ponytail-review",
		"ponytail-audit",
		"ponytail-debt",
		"ponytail-gain",
		"ponytail-help"
	]) commandCtx.commands.register({
		name: skill,
		description: descriptionFor(skill),
		input: { hint: "[notes]" },
		handler: (invocation) => queueSkill(deps, invocation, skill)
	});
}
/** One-line command catalog copy, kept beside the skills for discovery parity. */
function descriptionFor(skill) {
	switch (skill) {
		case "ponytail-review": return "Over-engineering review of the current changes";
		case "ponytail-audit": return "Whole-repo over-engineering audit (what can be deleted)";
		case "ponytail-debt": return "Harvest ponytail: comments into a tracked debt ledger";
		case "ponytail-gain": return "Show ponytail measured-impact scoreboard (less code, cost, time)";
		case "ponytail-help": return "Quick reference for ponytail levels, skills, and commands";
		default: return `Run the ${skill} skill`;
	}
}
/**
* Register the always-on ruleset section, the runtime skills, the slash
* commands, and the plain-text deactivation listener.
*/
function apply(ctx, config = {}) {
	const profileMode = normalizeRuntimeMode(config.defaultMode);
	if (config.defaultMode !== void 0 && profileMode === null) ctx.logger.warn(`[ponytail] profile config defaultMode is not lite|full|ultra|off: ${JSON.stringify(config.defaultMode)}; falling back`);
	let defaultMode = null;
	const warned = /* @__PURE__ */ new Set();
	const warnOnce = (key, message) => {
		if (warned.has(key)) return;
		warned.add(key);
		ctx.logger.warn(`[ponytail] ${message}`);
	};
	const refreshDefault = () => {
		const resolution = readDefaultModeInfo(process.env, profileMode);
		if (resolution.issue) warnOnce(`default:${resolution.issue.kind}`, `${resolution.issue.detail}; using ${resolution.mode}`);
		defaultMode = resolution.mode;
		return defaultMode;
	};
	const readDefault = () => defaultMode ?? refreshDefault();
	const setDefault = (mode) => {
		defaultMode = mode;
	};
	const store = new ModeStore();
	const matcherResult = compileSubagentMatcher(process.env.PONYTAIL_SUBAGENT_MATCHER);
	const matcher = matcherResult.matcher;
	if (matcherResult.invalid) warnOnce("matcher:invalid", "PONYTAIL_SUBAGENT_MATCHER is not a valid regular expression; ignoring it (fail-open).");
	const configFile = configPath();
	const onConfigChange = () => {
		const resolution = readDefaultModeInfo(process.env, profileMode);
		if (resolution.issue) {
			warnOnce(`config:${resolution.issue.kind}`, `${resolution.issue.detail}; keeping the previous default`);
			return;
		}
		defaultMode = resolution.mode;
	};
	watchFile(configFile, { interval: 1e3 }, onConfigChange).unref();
	ctx.effect(() => () => {
		unwatchFile(configFile, onConfigChange);
	}, "ponytail: config hot reload");
	ctx.on("agent/disposed", ({ agent }) => {
		store.clear(sessionKey(agent));
	});
	ctx.systemPrompt.section({
		name: "ponytail",
		order: SECTION_ORDER,
		text: ({ agent }) => {
			if (agent && matcher && isSubagentSession(agent.session.header)) {
				const preset = agent.session.header.agentPreset;
				if (preset && !matcher.test(preset)) return "";
			}
			return getPonytailInstructions(agent ? store.modeFor(sessionKey(agent), readDefault()) : readDefault());
		}
	});
	for (const skill of ponytailSkills()) ctx.skills.register(skill);
	ctx.inject(["commands"], (commandCtx) => {
		registerCommands({
			ctx,
			store,
			profileMode,
			defaultMode: readDefault,
			setDefault
		}, commandCtx);
	});
	ctx.on("agent/pre-step", async (payload, next) => {
		const deactivated = containsDeactivation(payload.messages);
		if (deactivated) store.set(sessionKey(payload.agent), "off");
		const decision = await next();
		if (deactivated && decision.kind === "enter") return {
			kind: "enter",
			messages: [...decision.messages, createUserMessage({
				content: [{
					type: "text",
					text: "PONYTAIL MODE OFF"
				}],
				source: {
					kind: "plugin",
					plugin: name
				}
			})]
		};
		return decision;
	});
}
//#endregion
export { apply, containsDeactivation, inject, messageText, name };
