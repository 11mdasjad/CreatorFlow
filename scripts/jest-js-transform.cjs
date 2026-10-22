// Jest 29 runs CJS tests; NestJS 12 is ESM. Transform dependency syntax only.
const ts = require('typescript');
module.exports = {
  process(source, filename) {
    if (/(?:const|let) require\s*=/.test(source))
      source = source.replace(/\brequire\b/g, 'nativeRequire');
    const code = source.replace(
      /import\.meta\.url/g,
      JSON.stringify(require('node:url').pathToFileURL(filename).href),
    );
    return {
      code: ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
          allowJs: true,
        },
        fileName: filename,
      }).outputText,
    };
  },
};
