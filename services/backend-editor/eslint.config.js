import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";


export default tseslint.config(
  { ignores: ['dist', '.husky', 'node_modules', 'package-lock.json'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    files: ['**/*.{ts}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      },
    },
    rules: {

    },
  },
  {
    extends: [js.configs.recommended],
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
  },
  { files: ["**/*.json"], language: "json/json", extends: [json.configs.recommended] },
  { files: ["**/*.jsonc", "**/tsconfig.json"], language: "json/jsonc", extends: [json.configs.recommended] },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/commonmark",
    extends: [markdown.configs.recommended],
    rules: {
      "markdown/no-multiple-h1": "warn",
    }
  }
);
