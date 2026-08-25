import {defineConfig} from "eslint/config";
import js from "@eslint/js";
import angular from "angular-eslint";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default defineConfig([
  {
    ignores: ["projects/**/*", "src/app/api/generated/**/*"],
  },
  {
    files: ["**/*.ts", "**/*.js"],
    extends: [
      ...tseslint.config(js.configs.recommended, ...tseslint.configs.recommended),
      angular.configs.tsRecommended,
      eslintPluginPrettierRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        project: ["tsconfig.json"],
        createDefaultProgram: true,
      },
    },
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "sbb",
          style: "kebab-case",
        },
      ],
      // TODO: enable all recommended @angular-eslint rules
      "@angular-eslint/prefer-standalone": "off",
      "@angular-eslint/prefer-inject": "off",
      "@angular-eslint/prefer-on-push-component-change-detection": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-empty-function": [
        "off",
        {
          allow: ["private-constructors"],
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": [
        "error",
        {
          allowShortCircuit: true,
          allowTernary: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // This rule is not in tseslint's recommended preset,
      // so the base rule must be disabled by hand here.
      "no-unused-private-class-members": "off",
      "@typescript-eslint/no-unused-private-class-members": "error",
      "@typescript-eslint/no-deprecated": "warn",
      "consistent-return": "error",
      eqeqeq: "error",
      "no-unneeded-ternary": "error",
      "nonblock-statement-body-position": "error",
      "object-curly-spacing": "error",
      "no-extra-boolean-cast": "off",
    },
  },
  {
    files: ["**/*.html"],
    extends: [...angular.configs.templateRecommended],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      // TODO: enable all recommended @angular-eslint rules
      "@angular-eslint/template/prefer-control-flow": "off",
    },
  },
]);
