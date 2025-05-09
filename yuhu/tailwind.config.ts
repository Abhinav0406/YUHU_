import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: {
				DEFAULT: '1rem',
				sm: '1.5rem',
				md: '2rem',
				lg: '2.5rem',
				xl: '3rem',
			},
			screens: {
				xs: '100%',
				sm: '480px',
				md: '768px',
				lg: '1024px',
				xl: '1280px',
				xxl: '1536px',
			}
		},
		screens: {
			'xs': '0px',
			'sm': '480px',
			'md': '768px',
			'lg': '1024px',
			'xl': '1280px',
			'xxl': '1536px',
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Yuhu custom colors
				yuhu: {
					primary: '#6C63FF', // Main purple
					secondary: '#4ECDC4', // Teal accent
					accent: '#FFE66D', // Yellow accent
					light: '#F7F7FC', // Light background
					dark: '#2A2A72', // Dark purple
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			fontSize: {
				'xs': ['clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', { lineHeight: '1.5' }],
				'sm': ['clamp(0.875rem, 0.8rem + 0.375vw, 1rem)', { lineHeight: '1.5' }],
				'base': ['clamp(1rem, 0.9rem + 0.5vw, 1.125rem)', { lineHeight: '1.5' }],
				'lg': ['clamp(1.125rem, 1rem + 0.625vw, 1.25rem)', { lineHeight: '1.5' }],
				'xl': ['clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)', { lineHeight: '1.2' }],
				'2xl': ['clamp(1.5rem, 1.3rem + 1vw, 2rem)', { lineHeight: '1.2' }],
				'3xl': ['clamp(2rem, 1.8rem + 1.25vw, 2.5rem)', { lineHeight: '1.2' }],
				'4xl': ['clamp(2.5rem, 2.3rem + 1.5vw, 3rem)', { lineHeight: '1.2' }],
			},
			spacing: {
				'3xs': 'clamp(0.25rem, 0.2rem + 0.25vw, 0.375rem)',
				'2xs': 'clamp(0.375rem, 0.3rem + 0.375vw, 0.5rem)',
				'xs': 'clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem)',
				'sm': 'clamp(0.75rem, 0.6rem + 0.75vw, 1rem)',
				'md': 'clamp(1rem, 0.8rem + 1vw, 1.25rem)',
				'lg': 'clamp(1.25rem, 1rem + 1.25vw, 1.5rem)',
				'xl': 'clamp(1.5rem, 1.2rem + 1.5vw, 2rem)',
				'2xl': 'clamp(2rem, 1.6rem + 2vw, 2.5rem)',
				'3xl': 'clamp(2.5rem, 2rem + 2.5vw, 3rem)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'pulse-light': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				},
				'bounce-subtle': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-5px)' }
				},
				'slide-in': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'slide-out': {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(100%)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'pulse-light': 'pulse-light 2s ease-in-out infinite',
				'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
				'slide-in': 'slide-in 0.3s ease-out',
				'slide-out': 'slide-out 0.3s ease-out'
			},
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				display: ['Poppins', 'sans-serif']
			},
			aspectRatio: {
				'video': '16 / 9',
				'square': '1 / 1',
				'portrait': '3 / 4',
				'landscape': '4 / 3',
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
