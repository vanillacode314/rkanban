const ACCESS_TOKEN_EXPIRES_IN = 600;
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 365;
const RESERVED_PATHS = ['/settings'] satisfies string[];

export { ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN_SECONDS, RESERVED_PATHS };
