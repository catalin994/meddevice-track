
/**
 * pdf.js v6 calls Map/WeakMap `getOrInsert` / `getOrInsertComputed` — a very
 * recent TC39 proposal that most shipping browsers (and many phones) don't have
 * yet. Without these, rendering a PDF throws
 * "getOrInsertComputed is not a function". The shims below are no-ops on
 * browsers that already implement them.
 */
type AnyMap = Map<unknown, unknown> | WeakMap<object, unknown>;

const addShims = (proto: any) => {
  if (!proto) return;

  if (typeof proto.getOrInsert !== 'function') {
    Object.defineProperty(proto, 'getOrInsert', {
      value: function (this: AnyMap, key: any, defaultValue: any) {
        if (this.has(key)) return this.get(key);
        this.set(key, defaultValue);
        return defaultValue;
      },
      writable: true,
      configurable: true,
    });
  }

  if (typeof proto.getOrInsertComputed !== 'function') {
    Object.defineProperty(proto, 'getOrInsertComputed', {
      value: function (this: AnyMap, key: any, callbackFn: (k: any) => any) {
        if (this.has(key)) return this.get(key);
        const value = callbackFn(key);
        this.set(key, value);
        return value;
      },
      writable: true,
      configurable: true,
    });
  }
};

addShims(Map.prototype);
addShims(WeakMap.prototype);

export {};
