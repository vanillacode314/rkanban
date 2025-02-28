import { createMediaQuery } from '@solid-primitives/media';

const isMobile = createMediaQuery('(max-width: 640px)');

export { isMobile };
