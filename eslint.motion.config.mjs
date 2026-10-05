import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default [{files:['app/tools/motion-extractor/**/*.{ts,tsx}','app/api/motion-extraction/**/*.ts','lib/motion-extraction/**/*.ts'],languageOptions:{parser:tseslint.parser,parserOptions:{ecmaVersion:'latest',sourceType:'module',ecmaFeatures:{jsx:true}}},plugins:{'@typescript-eslint':tseslint.plugin,'react-hooks':hooks},rules:{'@typescript-eslint/no-explicit-any':'error','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}],...hooks.configs.recommended.rules,'no-debugger':'error'}}];
