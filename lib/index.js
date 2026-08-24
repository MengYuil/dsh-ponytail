import { createRequire } from "node:module";
import { Service } from "@deepseek-ai/cordis";
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
//#region ../../../vendor/cosmokit/src/misc.ts
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
//#endregion
//#region ../../../vendor/cosmokit/src/types.ts
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value) => is(type, value);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
let Binary;
(function(_Binary) {
	_Binary.is = isArrayBufferLike;
	_Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	_Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	_Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	_Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	_Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	_Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
Binary.fromBase64;
Binary.toBase64;
Binary.fromHex;
Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result = [];
		refs.set(source, result);
		source.forEach((value, index) => {
			result[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
function deepEqual(a, b, strict) {
	if (a === b) return true;
	if (!strict && isNullable(a) && isNullable(b)) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (!a || !b) return false;
	function check(test, then) {
		return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
	}
	return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
		if (a.byteLength !== b.byteLength) return false;
		const viewA = new Uint8Array(a);
		const viewB = new Uint8Array(b);
		for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
		return true;
	}) ?? Object.keys({
		...a,
		...b
	}).every((key) => deepEqual(a[key], b[key], strict));
}
//#endregion
//#region ../../../vendor/cosmokit/src/time.ts
let Time;
(function(_Time) {
	_Time.millisecond = 1;
	const second = _Time.second = 1e3;
	const minute = _Time.minute = second * 60;
	const hour = _Time.hour = minute * 60;
	const day = _Time.day = hour * 24;
	const week = _Time.week = day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	_Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	_Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / minute - offset) / 1440);
	}
	_Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * minute);
	}
	_Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * week || 0) + (parseFloat(capture[2]) * day || 0) + (parseFloat(capture[3]) * hour || 0) + (parseFloat(capture[4]) * minute || 0) + (parseFloat(capture[5]) * second || 0);
	}
	_Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	_Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= day - hour / 2) return Math.round(ms / day) + "d";
		else if (abs >= hour - minute / 2) return Math.round(ms / hour) + "h";
		else if (abs >= minute - second / 2) return Math.round(ms / minute) + "m";
		else if (abs >= second) return Math.round(ms / second) + "s";
		return ms + "ms";
	}
	_Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	_Time.toDigits = toDigits;
	function template(template, time = /* @__PURE__ */ new Date()) {
		return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	_Time.template = template;
})(Time || (Time = {}));
//#endregion
//#region ../../../vendor/schemastery/src/index.ts
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options = {}) {
		return Schema.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
const resolvers = {};
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
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
const backoffSchema = Schema.object({
	initialDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
	maxDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
	jitterRatio: Schema.number().min(0).max(1).default(DEFAULT_JITTER_RATIO)
});
const normalPolicySchema = Schema.object({
	mode: Schema.const("normal").required(),
	maxRetries: Schema.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
	retryableCodes: Schema.array(Schema.string()).default([...DEFAULT_RETRYABLE_CODES]),
	backoff: backoffSchema
});
const alwaysPolicySchema = Schema.object({
	mode: Schema.const("always").required(),
	backoff: backoffSchema
});
Schema.union([normalPolicySchema, alwaysPolicySchema]);
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
	static Config = Schema.object({ collectCacheMaxEntries: Schema.number().default(DEFAULT_COLLECT_CACHE_ENTRIES) });
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
* `skill` tool). `ponytail` is the source the system-prompt ruleset is
* filtered from; the other five ship verbatim as runtime skills.
*
* @module @mengyuly/dsh-ponytail
*/
/** The always-on lazy-senior-dev ruleset: also registered as a loadable skill. */
const PONYTAIL_SKILL_BODY = `
You are a lazy senior developer. Lazy means efficient, not careless. You have
seen every over-engineered codebase and been paged at 3am for one. The best
code is the code never written.

## Persistence

ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if
unsure. Off only: "stop ponytail" / "normal mode" / \`/ponytail off\`. Default:
**full**. Switch: \`/ponytail lite|full|ultra\`.

## The ladder

Stop at the first rung that holds:

1. **Does this need to exist at all?** Speculative need = skip it, say so in one line. (YAGNI)
2. **Already in this codebase?** A helper, util, type, or pattern that already lives here → reuse it. Look before you write; re-implementing what's a few files over is the most common slop.
3. **Stdlib does it?** Use it.
4. **Native platform feature covers it?** \`<input type="date">\` over a picker lib, CSS over JS, DB constraint over app code.
5. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines can do.
6. **Can it be one line?** One line.
7. **Only then:** the minimum code that works.

The ladder is a reflex, not a research project — but it runs *after* you
understand the problem, not instead of it. Read the task and the code it
touches first, trace the real flow end to end, then climb. Two rungs work →
take the higher one and move on. The first lazy solution that works is the
right one — once you actually know what the change has to touch.

**Bug fix = root cause, not symptom.** A report names a symptom. Before you
edit, grep every caller of the function you're about to touch. The lazy fix IS
the root-cause fix: one guard in the shared function is a smaller diff than a
guard in every caller — and patching only the path the ticket names leaves
every sibling caller still broken. Fix it once, where all callers route through.

## Rules

- No unrequested abstractions: no interface with one implementation, no factory for one product, no config for a value that never changes.
- No boilerplate, no scaffolding "for later", later can scaffold for itself.
- Deletion over addition. Boring over clever, clever is what someone decodes at 3am.
- Fewest files possible. Shortest working diff wins — but only once you understand the problem. The smallest change in the wrong place isn't lazy, it's a second bug.
- Complex request? Ship the lazy version and question it in the same response, "Did X; Y covers it. Need full X? Say so." Never stall on an answer you can default.
- Two stdlib options, same size? Take the one that's correct on edge cases. Lazy means writing less code, not picking the flimsier algorithm.
- Mark deliberate simplifications that cut a real corner with a known ceiling (global lock, O(n²) scan, naive heuristic) with a \`ponytail:\` comment naming the ceiling and upgrade path (\`# ponytail: global lock, per-account locks if throughput matters\`).

## Output

Code first. Then at most three short lines: what was skipped, when to add it.
No essays, no feature tours, no design notes. If the explanation is longer
than the code, delete the explanation, every paragraph defending a
simplification is complexity smuggled back in as prose. Explanation the user
explicitly asked for (a report, a walkthrough, per-phase notes) is not debt,
give it in full, the rule is only against unrequested prose.

Pattern: \`[code] → skipped: [X], add when [Y].\`

## Intensity

| Level | What change |
|-------|------------|
| **lite** | Build what's asked, but name the lazier alternative in one line. User picks. |
| **full** | The ladder enforced. Stdlib and native first. Shortest diff, shortest explanation. Default. |
| **ultra** | YAGNI extremist. Deletion before addition. Ship the one-liner and challenge the rest of the requirement in the same breath. |

Example: "Add a cache for these API responses."
- lite: "Done, cache added. FYI: \`functools.lru_cache\` covers this in one line if you'd rather not own a cache class."
- full: "\`@lru_cache(maxsize=1000)\` on the fetch function. Skipped custom cache class, add when lru_cache measurably falls short."
- ultra: "No cache until a profiler says so. When it does: \`@lru_cache\`. A hand-rolled TTL cache class is a bug farm with a hit rate."

## When NOT to be lazy

Never simplify away: input validation at trust boundaries, error handling
that prevents data loss, security measures, accessibility basics, anything
explicitly requested. User insists on the full version → build it, no
re-arguing.

Never lazy about understanding the problem. The ladder shortens the
solution, never the reading. Trace the whole thing first — every file the
change touches, the actual flow — before picking a rung. Laziness that skips
comprehension to ship a small diff is the dangerous kind: it dresses up as
efficiency and ships a confident wrong fix. Read fully, then be lazy.

Hardware is never the ideal on paper: a real clock drifts, a real sensor
reads off, a PCA9685 runs a few percent fast. Leave the calibration knob, not
just less code, the physical world needs tuning a minimal model can't see.

Lazy code without its check is unfinished. Non-trivial logic (a branch, a
loop, a parser, a money/security path) leaves ONE runnable check behind, the
smallest thing that fails if the logic breaks: an \`assert\`-based
\`demo()\`/\`__main__\` self-check or one small test file. No frameworks, no
fixtures, no per-function suites unless asked. Trivial one-liners need no
test, YAGNI applies to tests too.

## Boundaries

Ponytail governs what you build, not how you talk. "stop ponytail" / "normal
mode" / \`/ponytail off\`: revert. Level is session-scoped until changed; the
configured default (env or config file) applies to new sessions.

The shortest path to done is the right path.
`;
const PONYTAIL_DESCRIPTION = "Force the laziest solution that actually works — simplest, shortest, most minimal. Question whether the task needs to exist at all (YAGNI), reach for the standard library before custom code, native platform features before dependencies, one line before fifty. Supports intensity levels lite, full (default), and ultra. Use on ANY coding task: writing, adding, refactoring, fixing, reviewing, or designing code, and choosing libraries or dependencies. Also use when the user says \"ponytail\", \"be lazy\", \"lazy mode\", \"simplest solution\", \"minimal solution\", \"yagni\", \"do less\", or \"shortest path\", or complains about over-engineering, bloat, boilerplate, or unnecessary dependencies. Do NOT use for non-coding requests (general knowledge, prose, translation, summaries, recipes).";
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

The figures are the published benchmark medians (5 everyday tasks: email
validator, debounce, CSV sum, countdown timer, rate limiter; three models:
Haiku, Sonnet, Opus). They are measured, not computed from the current repo.
Source: the upstream \`benchmarks/\` directory and README.

## Scoreboard

Render plain ASCII bars. The bar length shows the measured range; the label
carries the exact figure:

\`\`\`
  ponytail gain                     benchmark median · 5 tasks · 3 models

  Lines of code   no-skill  ████████████████████  100%
                  ponytail  ██▌·················    6–20%   ▼ 80–94%
  Cost            no-skill  ████████████████████  100%
                  ponytail  █████▌··············   23–53%  ▼ 47–77%
  Speed           ponytail  ▸ 3–6× faster

  This repo:  /ponytail-debt  (shortcuts you deferred)
              /ponytail-audit (what's still cuttable)
\`\`\`

## Honesty boundary

These are benchmark medians, not this repo. NEVER print a per-repo savings
number ("you saved X lines/tokens here"): the unbuilt version was never
written, so there is no real baseline to subtract from in a live repo. The
only real per-repo figures come from \`/ponytail-debt\` (a counted ledger), and
this card points there instead of inventing one.

## Boundaries

One-shot display. Edits nothing, changes no mode.
"stop ponytail" or "normal mode": revert.
`;
const GAIN_DESCRIPTION = "Show ponytail's measured impact as a compact scoreboard: less code, less cost, more speed, from the benchmark medians. One-shot display, not a persistent mode, and not a per-repo number. Trigger: /ponytail-gain, \"ponytail gain\", \"what does ponytail save\", \"show ponytail impact\", \"ponytail scoreboard\".";
const HELP_SKILL_BODY = `
Display this reference card when invoked. One-shot, do NOT change mode,
write flag files, or persist anything.

## Levels

| Level | Trigger | What change |
|-------|---------|-------------|
| **Lite** | \`/ponytail lite\` | Build what's asked, name the lazier alternative in one line. |
| **Full** | \`/ponytail\` | The ladder enforced: YAGNI → stdlib → native → one line → minimum. Default. |
| **Ultra** | \`/ponytail ultra\` | YAGNI extremist. Deletion before addition. Challenges requirements before building. |
| **Off** | \`/ponytail off\` | Ponytail stops injecting its ruleset for this session. |

Level is session-scoped until changed.

## Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **ponytail** | \`/ponytail\` | Lazy mode itself. Simplest solution that works. |
| **ponytail-review** | \`/ponytail-review\` | Over-engineering review: \`L42: yagni: factory, one product. Inline.\` |
| **ponytail-audit** | \`/ponytail-audit\` | Whole-repo over-engineering audit: ranked list of what to delete. |
| **ponytail-debt** | \`/ponytail-debt\` | Harvest \`ponytail:\` shortcut comments into a tracked ledger. |
| **ponytail-gain** | \`/ponytail-gain\` | Measured-impact scoreboard: less code, less cost, more speed. |
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

Set \`"off"\` to disable auto-activation on session start, activate manually
with \`/ponytail\` when wanted. \`/ponytail default <mode>\` persists a new
default to the config file; an exported \`PONYTAIL_DEFAULT_MODE\` still
outranks the saved value for new sessions.

Resolution: env var > config file > \`full\`.

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
			whenToUse: "Any coding task where the user wants the simplest, shortest, most minimal working solution.",
			content: PONYTAIL_SKILL_BODY,
			invocation: {
				modelInvocable: true,
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
* Ponytail mode resolution: the default level comes from the
* `PONYTAIL_DEFAULT_MODE` environment variable, then the optional config file
* `~/.config/ponytail/config.json` (`defaultMode`), then `full`. Setting a
* level via the `/ponytail` command is session-scoped and lives in an
* in-memory, per-agent {@link ModeStore}.
*
* @module @mengyuly/dsh-ponytail
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
* Read the configured default with diagnostics: environment variable first,
* then the config file, then `full`. A missing config file is normal and
* yields no issue; a broken one yields the fallback mode plus one issue for
* the caller to warn about once.
*/
function readDefaultModeInfo(env = process.env) {
	const path = configPath(env);
	const envMode = normalizeRuntimeMode(env.PONYTAIL_DEFAULT_MODE);
	let configText;
	try {
		configText = readFileSync(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return { mode: envMode ?? "full" };
		return {
			mode: envMode ?? "full",
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
	if (configIssue) return {
		mode: DEFAULT_MODE,
		issue: configIssue
	};
	return { mode: fromConfig ?? "full" };
}
/**
* Read the configured default for this host: environment variable first, then
* the config file, then `full`.
*/
function readDefaultMode(env = process.env) {
	return readDefaultModeInfo(env).mode;
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
* Build the mode-filtered ponytail ruleset. Ported from the upstream
* `hooks/ponytail-instructions.js`, so the injected text is byte-for-byte the
* same ruleset every other host emits, filtered to the active intensity.
*
* @module @mengyuly/dsh-ponytail
*/
/**
* Keep a line of the skill body only when it belongs to every mode or to the
* active one. Both shape-sensitive spots (the intensity table rows and the
* quoted worked examples) are keyed by a mode name; ordinary rules survive
* verbatim, even ones whose prose starts with a mode-looking word.
*/
function filterSkillBodyForMode(body, mode) {
	const effective = normalizeRuntimeMode(mode) ?? "full";
	return body.split(/\r?\n/).filter((line) => {
		const tableLabel = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
		if (tableLabel) {
			const labelMode = normalizeRuntimeMode(tableLabel[1]);
			if (labelMode) return labelMode === effective;
		}
		const exampleLabel = line.match(/^-\s*([^:]+):\s*"/);
		if (exampleLabel) {
			const labelMode = normalizeRuntimeMode(exampleLabel[1]);
			if (labelMode) return labelMode === effective;
		}
		return true;
	}).join("\n");
}
/** Minimal instruction set if the skill body can't be read (parity fallback). */
function fallbackInstructions(mode) {
	return "PONYTAIL MODE ACTIVE — level: " + mode + "\n\nYou are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.\n\n## Persistence\n\nACTIVE EVERY RESPONSE. No drift back to over-building. Still active if unsure. Off only: \"stop ponytail\" / \"normal mode\".\n\nCurrent level: **" + mode + "**. Switch: `/ponytail lite|full|ultra`.\n\n## The ladder\n\nBefore any code, stop at the first rung that holds (the ladder runs after you understand the problem, not instead of it — read the code it touches and trace the real flow first):\n1. Does this need to be built at all? (YAGNI)\n2. Does it already exist in this codebase? Reuse what is already here, do not re-write it.\n3. Does the standard library do this? Use it.\n4. Does a native platform feature cover it? Use it.\n5. Does an already-installed dependency solve it? Use it.\n6. Can this be one line? Make it one line.\n7. Only then: write the minimum code that works.\n\nBug fix = root cause, not symptom: grep every caller of the function you touch and fix the shared function once (a smaller diff than one guard per caller); patching only the path the ticket names leaves a sibling caller broken.\n\n## Rules\n\nNo abstractions that were not requested. No avoidable dependencies. No boilerplate nobody asked for. Deletion over addition. Boring over clever. Fewest files possible. Ship the lazy version and question the complex request in the same response — never stall. Between two same-size stdlib options, pick the one correct on edge cases. Mark deliberate simplifications that cut a real corner with a known ceiling, using a `ponytail:` comment that names the ceiling and upgrade path.\n\n## Output\n\nCode first. Then at most three short lines: what was skipped, when to add it. If the explanation is longer than the code, delete the explanation. Explanation the user explicitly asked for is not debt, give it in full.\n\n## When NOT to be lazy\n\nNever simplify away: understanding the problem (read it fully and trace the real flow before picking a rung — a small diff you do not understand is just laziness dressed up as efficiency), input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, the calibration real hardware needs (the platform is never the spec ideal), anything the user explicitly asked to keep. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind (assert-based demo/self-check or one small test file; no frameworks). Trivial one-liners need no test.\n\n## Boundaries\n\nPonytail governs what you build, not how you talk. \"stop ponytail\" or \"normal mode\": revert. Level persists until changed.";
}
/**
* The full injected ruleset for one intensity: the "PONYTAIL MODE ACTIVE"
* header plus the body filtered down to that mode's rows and examples.
* Returns an empty string for `off` (ponytail contributes nothing).
*/
function getPonytailInstructions(mode) {
	const effective = normalizeRuntimeMode(mode) ?? "full";
	if (effective === "off") return "";
	const cached = instructionCache.get(effective);
	if (cached !== void 0) return cached;
	let body;
	try {
		body = filterSkillBodyForMode(PONYTAIL_SKILL_BODY, effective);
	} catch {
		return fallbackInstructions(effective);
	}
	const rendered = "PONYTAIL MODE ACTIVE — level: " + effective + "\n\n" + body;
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
* from `PONYTAIL_DEFAULT_MODE` then `~/.config/ponytail/config.json` (see
* {@link readDefaultMode}).
*
* @module @mengyuly/dsh-ponytail
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
				const effective = readDefaultMode();
				deps.setDefault(effective);
				if (written === effective) {
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
				agent.steer(createUserMessage({
					content: [{
						type: "text",
						text: `PONYTAIL DEFAULT SET — saved ${written}, effective ${effective} (PONYTAIL_DEFAULT_MODE).`
					}],
					source: {
						kind: "plugin",
						plugin: name
					}
				}));
				return {
					kind: "success",
					text: `Saved default: ${written}. Effective default: ${effective}, overridden by PONYTAIL_DEFAULT_MODE.`
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
function apply(ctx) {
	let defaultMode = null;
	const warned = /* @__PURE__ */ new Set();
	const warnOnce = (key, message) => {
		if (warned.has(key)) return;
		warned.add(key);
		ctx.logger.warn(`[ponytail] ${message}`);
	};
	const refreshDefault = () => {
		const resolution = readDefaultModeInfo();
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
		const resolution = readDefaultModeInfo();
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
