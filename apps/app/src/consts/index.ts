import { ms } from '~/utils/ms';

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = ms('10 min') / 1000;
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = ms('1 year') / 1000;
const RESERVED_PATHS = ['/settings'] satisfies string[];

export { ACCESS_TOKEN_EXPIRES_IN_SECONDS, REFRESH_TOKEN_EXPIRES_IN_SECONDS, RESERVED_PATHS };
