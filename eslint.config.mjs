import stylistic from '@stylistic/eslint-plugin'
import typescriptEslint from 'typescript-eslint'

export default [{
  files: ['**/*.ts']
}, {
  plugins: {
    '@stylistic': stylistic,
    '@typescript-eslint': typescriptEslint.plugin
  },
  languageOptions: {
    parser: typescriptEslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    '@stylistic/space-in-parens': ['error'],
    '@stylistic/comma-spacing': ['error'],
    '@stylistic/no-multi-spaces': ['error'],
    '@stylistic/no-trailing-spaces': ['error'],
    '@stylistic/no-whitespace-before-property': ['error'],
    '@stylistic/array-bracket-newline': ['error', 'consistent'],
    '@stylistic/array-bracket-spacing': ['error'],
    '@stylistic/arrow-spacing': ['error'],
    '@stylistic/arrow-parens': ['error', 'always'],
    '@stylistic/block-spacing': ['error', 'always'],
    '@stylistic/brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
    '@stylistic/comma-dangle': ['error', 'never'],
    '@stylistic/key-spacing': ['error'],
    '@stylistic/keyword-spacing': ['error'],
    '@stylistic/member-delimiter-style': ['error', { 'multiline': { 'delimiter': 'none' } }],
    '@stylistic/no-extra-semi': ['error'],
    '@stylistic/indent': ['error', 2],
    '@stylistic/no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 0, 'maxBOF': 0 }],
    '@stylistic/object-curly-spacing': ['error', 'always'],
    '@stylistic/quotes': ['error', 'single'],
    '@stylistic/semi': ['error', 'never'],
    '@stylistic/space-before-blocks': ['error', 'always'],
    '@stylistic/space-before-function-paren': ['error', { 'anonymous': 'always', 'named': 'never', 'asyncArrow': 'always' }],
    '@typescript-eslint/naming-convention': ['warn', { selector: 'import', format: ['camelCase', 'PascalCase'] }],
    'curly': 'warn',
    'eqeqeq': 'warn',
    'no-throw-literal': 'warn',
    'semi': ['error', 'never']
  }
}]
