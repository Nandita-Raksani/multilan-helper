/**
 * Convert .tra files from various encodings to UTF-8
 * Supports Windows-1252, ISO-8859-1, and UTF-8 detection
 */

const fs = require('fs');
const path = require('path');

// Windows-1252 to Unicode mapping for bytes 128-159
const WINDOWS_1252_MAP = {
  0x80: 0x20AC, // €
  0x82: 0x201A, // ‚
  0x83: 0x0192, // ƒ
  0x84: 0x201E, // „
  0x85: 0x2026, // …
  0x86: 0x2020, // †
  0x87: 0x2021, // ‡
  0x88: 0x02C6, // ˆ
  0x89: 0x2030, // ‰
  0x8A: 0x0160, // Š
  0x8B: 0x2039, // ‹
  0x8C: 0x0152, // Œ
  0x8E: 0x017D, // Ž
  0x91: 0x2018, // '
  0x92: 0x2019, // '
  0x93: 0x201C, // "
  0x94: 0x201D, // "
  0x95: 0x2022, // •
  0x96: 0x2013, // –
  0x97: 0x2014, // —
  0x98: 0x02DC, // ˜
  0x99: 0x2122, // ™
  0x9A: 0x0161, // š
  0x9B: 0x203A, // ›
  0x9C: 0x0153, // œ
  0x9E: 0x017E, // ž
  0x9F: 0x0178, // Ÿ
};

/**
 * Detect if buffer is valid UTF-8
 */
function isValidUtf8(buffer) {
  let i = 0;
  while (i < buffer.length) {
    const byte = buffer[i];

    if (byte <= 0x7F) {
      // ASCII
      i++;
    } else if ((byte & 0xE0) === 0xC0) {
      // 2-byte sequence
      if (i + 1 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80) {
        return false;
      }
      i += 2;
    } else if ((byte & 0xF0) === 0xE0) {
      // 3-byte sequence
      if (i + 2 >= buffer.length ||
          (buffer[i + 1] & 0xC0) !== 0x80 ||
          (buffer[i + 2] & 0xC0) !== 0x80) {
        return false;
      }
      i += 3;
    } else if ((byte & 0xF8) === 0xF0) {
      // 4-byte sequence
      if (i + 3 >= buffer.length ||
          (buffer[i + 1] & 0xC0) !== 0x80 ||
          (buffer[i + 2] & 0xC0) !== 0x80 ||
          (buffer[i + 3] & 0xC0) !== 0x80) {
        return false;
      }
      i += 4;
    } else {
      return false;
    }
  }
  return true;
}

/**
 * Convert Windows-1252/ISO-8859-1 buffer to UTF-8 string
 */
function convertToUtf8(buffer) {
  let result = '';

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];

    if (byte <= 0x7F) {
      // ASCII - pass through
      result += String.fromCharCode(byte);
    } else if (byte >= 0x80 && byte <= 0x9F) {
      // Windows-1252 special characters
      const unicode = WINDOWS_1252_MAP[byte];
      if (unicode) {
        result += String.fromCharCode(unicode);
      } else {
        // Undefined in Windows-1252, use replacement character
        result += '\uFFFD';
      }
    } else {
      // ISO-8859-1 range (0xA0-0xFF maps directly to Unicode)
      result += String.fromCharCode(byte);
    }
  }

  return result;
}

/**
 * Read file and convert to UTF-8 if needed
 */
function readFileAsUtf8(filePath) {
  const buffer = fs.readFileSync(filePath);

  // Check for BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    // UTF-8 BOM - skip it and decode as UTF-8
    console.log(`  ${path.basename(filePath)}: UTF-8 with BOM`);
    return buffer.slice(3).toString('utf8');
  }

  // Check if valid UTF-8
  if (isValidUtf8(buffer)) {
    // Check if it has any non-ASCII characters that would indicate UTF-8
    let hasUtf8Sequences = false;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] > 0x7F) {
        hasUtf8Sequences = true;
        break;
      }
    }

    if (hasUtf8Sequences) {
      console.log(`  ${path.basename(filePath)}: UTF-8`);
      return buffer.toString('utf8');
    }

    // Pure ASCII - treat as UTF-8
    console.log(`  ${path.basename(filePath)}: ASCII`);
    return buffer.toString('utf8');
  }

  // Not valid UTF-8, assume Windows-1252
  console.log(`  ${path.basename(filePath)}: Windows-1252 -> UTF-8`);
  return convertToUtf8(buffer);
}

/**
 * Main conversion function
 */
function convertTraFiles() {
  const traDir = path.join(__dirname, '..', 'src', 'translations');
  const outputDir = path.join(__dirname, '..', 'src', 'translations', 'converted');

  // Create output directory if needed
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const traFiles = ['en-BE.tra', 'fr-BE.tra', 'nl-BE.tra', 'de-BE.tra'];

  console.log('Converting .tra files to UTF-8...');

  for (const file of traFiles) {
    const inputPath = path.join(traDir, file);
    const outputPath = path.join(outputDir, file);

    if (fs.existsSync(inputPath)) {
      const content = readFileAsUtf8(inputPath);
      fs.writeFileSync(outputPath, content, 'utf8');
    } else {
      console.log(`  ${file}: NOT FOUND - skipping`);
    }
  }

  console.log('Done! Converted files are in src/translations/converted/');
}

// Also export a function to generate a TypeScript module with the content
function generateTraModule() {
  const traDir = path.join(__dirname, '..', 'src', 'translations');
  const outputPath = path.join(traDir, 'tra-bundle.ts');

  const traFiles = {
    en: 'en-BE.tra',
    fr: 'fr-BE.tra',
    nl: 'nl-BE.tra',
    de: 'de-BE.tra'
  };

  console.log('Generating tra-bundle.ts...');

  let moduleContent = '// Auto-generated file - DO NOT EDIT\n';
  moduleContent += '// Generated by scripts/convert-tra-files.js\n\n';
  moduleContent += 'export const traFileContents = {\n';

  for (const [lang, file] of Object.entries(traFiles)) {
    const inputPath = path.join(traDir, file);

    if (fs.existsSync(inputPath)) {
      const content = readFileAsUtf8(inputPath);
      // Escape backticks and backslashes for template literal
      const escaped = content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
      moduleContent += `  ${lang}: \`${escaped}\`,\n`;
    } else {
      console.log(`  ${file}: NOT FOUND - using empty string`);
      moduleContent += `  ${lang}: '',\n`;
    }
  }

  moduleContent += '};\n';

  fs.writeFileSync(outputPath, moduleContent, 'utf8');
  console.log('Done! Generated src/translations/tra-bundle.ts');
}

// Run based on command line argument
const arg = process.argv[2];

if (arg === '--module') {
  generateTraModule();
} else if (arg === '--convert') {
  convertTraFiles();
} else {
  // Default: generate module
  generateTraModule();
}
