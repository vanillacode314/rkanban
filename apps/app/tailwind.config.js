import plugin from 'tailwindcss/plugin';
import motion from 'tailwindcss-motion';

/**@type {import("tailwindcss").Config} */
export default {
	content: ['./src/**/*.{ts,tsx}'],
	darkMode: ['class', '[data-kb-theme="dark"]'],
	plugins: [
		motion,
		plugin(function ({ addVariant }) {
			addVariant('hocus', ['&:hover', '&:focus']);
			addVariant('group-hocus', ['.group:hover &', '.group:focus &']);
			addVariant('can-hover', ['@media (any-hover: hover) { & }']);
		})
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'content-hide': 'content-hide 0.2s ease-out',
				'content-show': 'content-show 0.2s ease-out'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				xl: 'calc(var(--radius) + 4px)'
			},
			colors: {
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				background: 'hsl(var(--background))',
				border: 'hsl(var(--border))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				error: {
					DEFAULT: 'hsl(var(--error))',
					foreground: 'hsl(var(--error-foreground))'
				},
				foreground: 'hsl(var(--foreground))',
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))'
				},
				input: 'hsl(var(--input))',
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				ring: 'hsl(var(--ring))',
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				}
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--kb-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--kb-accordion-content-height)' },
					to: { height: 0 }
				},
				'content-hide': {
					from: { opacity: 1, transform: 'scale(1)' },
					to: { opacity: 0, transform: 'scale(0.96)' }
				},
				'content-show': {
					from: { opacity: 0, transform: 'scale(0.96)' },
					to: { opacity: 1, transform: 'scale(1)' }
				}
			}
		},
		fontFamily: {
			sans: ['Inter', 'sans-serif']
		}
	}
};
