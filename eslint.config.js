import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/api/schema.gen.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // shadcn/ui's convention is to export a cva() variants function alongside its
      // component, and context files export their hook alongside the provider — both
      // colocations are deliberate, not an accident this rule should flag.
      'react-refresh/only-export-components': 'off',
      // The React Compiler is not enabled in this project (no babel-plugin-react-compiler
      // in vite.config.ts); this rule's "skipped compilation" warnings are noise until it.
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    // D2.15: the UI never hand-writes a type the spec describes, which means it never
    // hand-writes a request either — every call to OMS goes through the generated,
    // typed client in src/api/client.ts. Everywhere else, a raw fetch()/axios call is
    // either a stray, untyped, uncredentialed request, or a business screen reaching
    // past the client that adds credentials/CSRF/401 handling for it.
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/api/client.ts', '**/__tests__/**', '**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'Use the generated client (src/api/client.ts), not a raw fetch() call.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'axios', message: 'Use the generated client (src/api/client.ts), not axios.' }],
        },
      ],
    },
  }
)
