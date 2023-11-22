# auto-inspect-errors README

* an auto inspect-errors for .ts and count error file num so on.

## Features

take it easy and only use `ctrl + shift + p`,then choose `auto-inspect-errors` command and then u will paly with style errors.

## Requirements

if you want to use auto-inspect-errors's features of eslint, you must config your package.json before.this is the default configuration. Just add the following to your package.json.

```json
  "lint-fix": "eslint --fix ."
```

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* 1 autoInspectErrors.excludedPatterns config for files，dictionaries and patterns.

```json
"autoInspectErrors.excludedPatterns": ["fileToExclude.ts"]
"autoInspectErrors.excludedPatterns": ["folderToExclude/"]
"autoInspectErrors.excludedPatterns": ["**/*.spec.ts"]
"autoInspectErrors.excludedPatterns": [
    "fileToExclude.ts",
    "folderToExclude/",
    "**/*.spec.ts"
]
```

* 2 autoInspectErrors.customErrorRules config

```json
  "autoInspectErrors.customErrorRules": [
        "TODO:",
        "FIXME:",
        "\\bconsole\\.(log|error|warn)\\("
    ]
```

## Known Issues

now it's 0

## Release Notes

now it is first versions

### 1.0.0

Initial release of ...

---

**Enjoy!**
