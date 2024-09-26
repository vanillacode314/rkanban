// Helpers.
const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;

type Unit =
  | "D"
  | "Day"
  | "Days"
  | "H"
  | "Hour"
  | "Hours"
  | "Hr"
  | "Hrs"
  | "M"
  | "Millisecond"
  | "Milliseconds"
  | "Min"
  | "Mins"
  | "Minute"
  | "Minutes"
  | "Ms"
  | "Msec"
  | "Msecs"
  | "s"
  | "Sec"
  | "Second"
  | "Seconds"
  | "Secs"
  | "W"
  | "Week"
  | "Weeks"
  | "Y"
  | "Year"
  | "Years"
  | "Yr"
  | "Yrs";

type UnitAnyCase = Lowercase<Unit> | Unit | Uppercase<Unit>;

export type StringValue =
  | `${number} ${UnitAnyCase}`
  | `${number}${UnitAnyCase}`
  | `${number}`;

interface Options {
  /**
   * Set to `true` to use verbose formatting. Defaults to `false`.
   */
  long?: boolean;
}

/**
 * Parse or format the given value.
 *
 * @param value - The string or number to convert
 * @param options - Options for the conversion
 * @throws Error if `value` is not a non-empty string or a number
 */
function msFn(value: StringValue, options?: Options): number;
function msFn(value: number, options?: Options): string;
function msFn(value: number | StringValue, options?: Options): number | string {
  try {
    if (typeof value === "string") {
      return parse(value);
    } else if (typeof value === "number") {
      return format(value, options);
    }
    throw new Error("Value provided to ms() must be a string or number.");
  } catch (error) {
    const message = isError(error)
      ? `${error.message}. value=${JSON.stringify(value)}`
      : "An unknown error has occurred.";
    throw new Error(message);
  }
}

/**
 * Parse the given string and return milliseconds.
 *
 * @param str - A string to parse to milliseconds
 * @returns The parsed value in milliseconds, or `NaN` if the string can't be
 * parsed
 */
export function parse(str: string): number {
  if (typeof str !== "string" || str.length === 0 || str.length > 100) {
    throw new Error(
      "Value provided to ms.parse() must be a string with length between 1 and 99.",
    );
  }
  const match =
    /^(?<value>-?(?:\d+)?\.?\d+) *(?<type>milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
      str,
    );
  // Named capture groups need to be manually typed today.
  // https://github.com/microsoft/TypeScript/issues/32098
  const groups = match?.groups as { type?: string; value: string } | undefined;
  if (!groups) {
    return NaN;
  }
  const n = parseFloat(groups.value);
  const type = (groups.type || "ms").toLowerCase() as Lowercase<Unit>;
  switch (type) {
    case "d":
    case "day":
    case "days":
      return n * d;
    case "h":
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
      return n * h;
    case "m":
    case "min":
    case "mins":
    case "minute":
    case "minutes":
      return n * m;
    case "millisecond":
    case "milliseconds":
    case "ms":
    case "msec":
    case "msecs":
      return n;
    case "s":
    case "sec":
    case "second":
    case "seconds":
    case "secs":
      return n * s;
    case "w":
    case "week":
    case "weeks":
      return n * w;
    case "y":
    case "year":
    case "years":
    case "yr":
    case "yrs":
      return n * y;
    default:
      // This should never occur.
      throw new Error(
        `The unit ${type as string} was matched, but no matching case exists.`,
      );
  }
}

/**
 * Parse the given StringValue and return milliseconds.
 *
 * @param value - A typesafe StringValue to parse to milliseconds
 * @returns The parsed value in milliseconds, or `NaN` if the string can't be
 * parsed
 */
export function parseStrict(value: StringValue): number {
  return parse(value);
}

export default msFn;

/**
 * Short format for `ms`.
 */
function fmtShort(ms: number): StringValue {
  const msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return `${Math.round(ms / d)}d`;
  }
  if (msAbs >= h) {
    return `${Math.round(ms / h)}h`;
  }
  if (msAbs >= m) {
    return `${Math.round(ms / m)}m`;
  }
  if (msAbs >= s) {
    return `${Math.round(ms / s)}s`;
  }
  return `${ms}ms`;
}

/**
 * Long format for `ms`.
 */
function fmtLong(ms: number): StringValue {
  const msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return plural(ms, msAbs, d, "day");
  }
  if (msAbs >= h) {
    return plural(ms, msAbs, h, "hour");
  }
  if (msAbs >= m) {
    return plural(ms, msAbs, m, "minute");
  }
  if (msAbs >= s) {
    return plural(ms, msAbs, s, "second");
  }
  return `${ms} ms`;
}

/**
 * Format the given integer as a string.
 *
 * @param ms - milliseconds
 * @param options - Options for the conversion
 * @returns The formatted string
 */
export function format(ms: number, options?: Options): string {
  if (typeof ms !== "number" || !isFinite(ms)) {
    throw new Error("Value provided to ms.format() must be of type number.");
  }
  return options?.long ? fmtLong(ms) : fmtShort(ms);
}

/**
 * Pluralization helper.
 */
function plural(
  ms: number,
  msAbs: number,
  n: number,
  name: string,
): StringValue {
  const isPlural = msAbs >= n * 1.5;
  return `${Math.round(ms / n)} ${name}${isPlural ? "s" : ""}` as StringValue;
}

/**
 * A type guard for errors.
 *
 * @param value - The value to test
 * @returns A boolean `true` if the provided value is an Error-like object
 */
function isError(value: unknown): value is Error {
  return typeof value === "object" && value !== null && "message" in value;
}
