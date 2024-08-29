import { z } from 'zod';
const passwordSchema = z
	.string({ required_error: 'Password is required' })
	.trim()
	.min(8, 'Password must be at least 8 characters')
	.regex(/(?=.*[0-9])/, 'Password must contain a number')
	.regex(/(?=.*[a-z])/, 'Password must contain a lowercase letter')
	.regex(/(?=.*[A-Z])/, 'Password must contain an uppercase letter')
	.regex(/(?=.*[!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~])/, 'Password must contain a special character')
	.regex(
		/(?<![^A-Za-z0-9!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~].*)[A-Za-z0-9!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~]+(?!.*[^A-Za-z0-9!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~])/,
		'Password can only contain letters, numbers, and special characters !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
	);
export { passwordSchema };
