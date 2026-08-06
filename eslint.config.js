import {defineConfig} from "eslint/config";
import js from "@eslint/js";
import angular from "angular-eslint";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

const noDirectTrainrunSectionSetTrainrunRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      noDirectCall:
        "Do not call setTrainrun() directly. Use TrainrunSectionService.updateTrainrunReference() so the section lookup index stays in sync.",
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;
    if (!parserServices?.program || !parserServices?.esTreeNodeToTSNodeMap) {
      return {};
    }

    const checker = parserServices.program.getTypeChecker();

    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.property.type !== "Identifier" ||
          node.callee.property.name !== "setTrainrun"
        ) {
          return;
        }

        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        const signature = checker.getResolvedSignature(tsNode);
        const declaration = signature?.declaration;
        if (!declaration) {
          return;
        }

        const sourceFile = declaration.getSourceFile().fileName.replaceAll("\\", "/");
        const isTrainrunSectionModel = sourceFile.endsWith(
          "/src/app/models/trainrunsection.model.ts",
        );
        if (!isTrainrunSectionModel) {
          return;
        }

        context.report({
          node,
          messageId: "noDirectCall",
        });
      },
    };
  },
};

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
    plugins: {
      local: {
        rules: {
          "no-direct-trainrunsection-settrainrun": noDirectTrainrunSectionSetTrainrunRule,
        },
      },
    },
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
      "local/no-direct-trainrunsection-settrainrun": "error",
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
  {
    files: [
      "src/app/services/data/trainrunsection.service.ts",
      "src/app/services/util/port-ordering.test-helpers.ts",
    ],
    rules: {
      "local/no-direct-trainrunsection-settrainrun": "off",
    },
  },
]);
