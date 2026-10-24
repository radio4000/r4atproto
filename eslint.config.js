import prettier from 'eslint-config-prettier'
import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import ts from 'typescript-eslint'

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {...globals.browser, ...globals.node}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {parser: ts.parser}
		}
	},
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_'}
			],
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		ignores: [
			'dist/',
			'.svelte-kit/',
			'**/.wrangler/',
			'src/lib/paraglide/',
			'indexer/worker-configuration.d.ts'
		]
	}
)
