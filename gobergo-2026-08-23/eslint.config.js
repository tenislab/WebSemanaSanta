import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

/**
 * Revisión automática del código (ESLint).
 *
 * Lo importante de esta configuración es `react-hooks/exhaustive-deps`: avisa
 * cuando un useEffect/useMemo/useCallback se olvida de una dependencia, que es
 * justo el origen de los fallos de «estado obsoleto» que aparecieron en las
 * auditorías (números de hermano repetidos, cambios que se pierden al subir una
 * imagen…). Está como AVISO, no como error, porque en unos pocos sitios la
 * dependencia se omite a propósito y así queda documentado con un comentario.
 *
 *   npm run lint        → revisa
 *   npm run lint:fix    → arregla lo que se puede arreglar solo
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'scripts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        // Sello de la fecha de construcción que inyecta Vite (ver vite.config.ts).
        __BUILD_TIME__: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Las variables sin usar ya las caza TypeScript (noUnusedLocals); aquí se
      // permite el prefijo _ para lo que se ignora a propósito.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Un catch vacío es intencionado en varios sitios (localStorage no disponible,
      // datos corruptos…): siempre lleva un comentario explicando por qué.
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
)
