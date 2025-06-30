import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";


export default tseslint.config(
  { ignores: ['dist', '.husky', 'node_modules', 'package-lock.json', 'tsconfig.json'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, eslintPluginPrettierRecommended],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      },
    },
    rules: {
      "prettier/prettier": "warn"
    },
  },
  {
    extends: [js.configs.recommended, eslintPluginPrettierRecommended],
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: {
      "prettier/prettier": "warn"
    },
  },
  {
    files: ["**/*.json"], language: "json/json", extends: [json.configs.recommended, eslintPluginPrettierRecommended],
    rules: {
      "prettier/prettier": "warn"
    },
  },
  {
    files: ["**/*.jsonc"], language: "json/jsonc", extends: [json.configs.recommended],
    rules: {
      "prettier/prettier": "off"
    },
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/commonmark",
    extends: [markdown.configs.recommended],
    rules: {
      "markdown/no-multiple-h1": "warn",
    }
  },
);
