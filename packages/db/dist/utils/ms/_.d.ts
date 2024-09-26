type Unit = 'D' | 'Day' | 'Days' | 'H' | 'Hour' | 'Hours' | 'Hr' | 'Hrs' | 'M' | 'Millisecond' | 'Milliseconds' | 'Min' | 'Mins' | 'Minute' | 'Minutes' | 'Ms' | 'Msec' | 'Msecs' | 's' | 'Sec' | 'Second' | 'Seconds' | 'Secs' | 'W' | 'Week' | 'Weeks' | 'Y' | 'Year' | 'Years' | 'Yr' | 'Yrs';
type UnitAnyCase = Lowercase<Unit> | Unit | Uppercase<Unit>;
export type StringValue = `${number} ${UnitAnyCase}` | `${number}${UnitAnyCase}` | `${number}`;
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
declare function msFn(value: StringValue, options?: Options): number;
declare function msFn(value: number, options?: Options): string;
/**
 * Parse the given string and return milliseconds.
 *
 * @param str - A string to parse to milliseconds
 * @returns The parsed value in milliseconds, or `NaN` if the string can't be
 * parsed
 */
export declare function parse(str: string): number;
/**
 * Parse the given StringValue and return milliseconds.
 *
 * @param value - A typesafe StringValue to parse to milliseconds
 * @returns The parsed value in milliseconds, or `NaN` if the string can't be
 * parsed
 */
export declare function parseStrict(value: StringValue): number;
export default msFn;
/**
 * Format the given integer as a string.
 *
 * @param ms - milliseconds
 * @param options - Options for the conversion
 * @returns The formatted string
 */
export declare function format(ms: number, options?: Options): string;
//# sourceMappingURL=_.d.ts.map