import { ms } from '~/utils/ms';

const ACCESS_TOKEN_EXPIRES_IN = ms('10 min');
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = ms('1 year');
const RESERVED_PATHS = ['/settings'] satisfies string[];

export { ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN_SECONDS, RESERVED_PATHS };
