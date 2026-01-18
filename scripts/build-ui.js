const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

async function buildUI() {
  // Bundle the TypeScript/JavaScript
  const result = await esbuild.build({
    entryPoints: ['src/ui/main.ts'],
    bundle: true,
    write: false,
    target: 'es2017',
    format: 'iife',
    minify: !isWatch,
  });

  const jsCode = result.outputFiles[0].text;

  // Read the CSS
  const cssPath = path.join(__dirname, '../src/ui/styles/main.css');
  const cssCode = fs.readFileSync(cssPath, 'utf-8');

  // Read the HTML template
  const htmlPath = path.join(__dirname, '../src/ui/index.html');
  let htmlCode = fs.readFileSync(htmlPath, 'utf-8');

  // Remove the external CSS link and script tag, replace with inline versions
  htmlCode = htmlCode
    .replace('<link rel="stylesheet" href="./styles/main.css">', `<style>\n${cssCode}\n</style>`)
    .replace('<script type="module" src="./main.ts"></script>', `<script>\n${jsCode}\n</script>`);

  // Add build timestamp
  const timestamp = new Date().toLocaleString();
  htmlCode = htmlCode.replace('</head>', `  <!-- Built: ${timestamp} -->\n</head>`);

  // Ensure dist directory exists
  const distDir = path.join(__dirname, '../dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Write the output
  const outputPath = path.join(distDir, 'ui.html');
  fs.writeFileSync(outputPath, htmlCode);

  console.log(`UI built successfully: ${outputPath}`);
}

if (isWatch) {
  // Watch mode
  const chokidar = require('chokidar');

  console.log('Watching for UI changes...');

  const watcher = chokidar.watch([
    'src/ui/**/*.ts',
    'src/ui/**/*.css',
    'src/ui/**/*.html',
    'src/shared/**/*.ts'
  ], {
    ignoreInitial: true,
    cwd: path.join(__dirname, '..')
  });

  watcher.on('change', async (filepath) => {
    console.log(`File changed: ${filepath}`);
    try {
      await buildUI();
    } catch (err) {
      console.error('Build error:', err.message);
    }
  });

  // Initial build
  buildUI().catch(err => {
    console.error('Initial build error:', err.message);
  });
} else {
  // Single build
  buildUI().catch(err => {
    console.error('Build error:', err.message);
    process.exit(1);
  });
}
