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
      // TODO: Migrate all components to OnPush — see https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1255
      // Temporarily set to warn: Angular 22 migration added ChangeDetectionStrategy.Eager (= old Default) to 68 components.
      // Full OnPush migration requires adding markForCheck() to all subscribe() callbacks.
      "@angular-eslint/prefer-on-push-component-change-detection": "warn",
      // TODO: Migrate constructor injection to inject() function — see https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1256
      // Temporarily set to warn: can be auto-fixed via: ng generate @angular/core:inject
      "@angular-eslint/prefer-inject": "warn",
      "@angular-eslint/prefer-standalone": "off",
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
    },
  },
]);
