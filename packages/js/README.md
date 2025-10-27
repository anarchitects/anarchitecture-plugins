# @anarchitects/nx-js

`@anarchitects/nx-js` extends the official [`@nx/js`](https://nx.dev/packages/js) plugin to give Rails-inspired Nx monorepos a native JavaScript experience, including first-class secondary entry point generation for libraries.

## Installation

```bash
yarn add -D @anarchitects/nx-js
# or
npm install -D @anarchitects/nx-js
```

## What You Get

- Composition of the standard `@nx/js` generators and executors.
- A secondary entry point generator that:
  - Scaffolds `src/<segment>/index.ts` + `lib/<segment>.ts` files.
  - Updates build targets for supported bundlers (`tsc`, `swc`, `rollup`, `vite`).
  - Leaves `package.json` exports to your bundler configuration via Nx’s `generateExportsField` option.

## Usage

Create a library and add secondary entry points:

```bash
yarn nx g @anarchitects/nx-js:library my-lib --bundler=tsc
yarn nx g @anarchitects/nx-js:secondary-entry-point --project=my-lib --name=feature
```

### Building

```bash
yarn nx build nx-js
```

### Testing

```bash
yarn nx test nx-js
```

## License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
