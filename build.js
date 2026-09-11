// Obfuscates the readable source in src/ into the paths the extension
// actually loads (manifest.json / popup.html / options.html point here).
// Edit files under src/, then run `npm run build` to regenerate.
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const targets = [
  { src: 'src/background.js', out: 'background.js' },
  { src: 'src/js/popup.js', out: 'js/popup.js' },
  { src: 'src/js/options.js', out: 'js/options.js' }
];

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 1,
  rotateStringArray: true,
  shuffleStringArray: true,
  splitStrings: true,
  splitStringsChunkLength: 6,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: true,
  disableConsoleOutput: false,
  numbersToExpressions: true,
  simplify: true,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

for (const target of targets) {
  const srcPath = path.join(__dirname, target.src);
  const outPath = path.join(__dirname, target.out);
  const code = fs.readFileSync(srcPath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions);
  fs.writeFileSync(outPath, result.getObfuscatedCode(), 'utf8');
  console.log('Obfuscated ' + target.src + ' -> ' + target.out);
}
