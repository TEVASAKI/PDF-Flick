/**
 * 20個のテスト用PDFファイルを生成し、Androidエミュレータに配置するスクリプト
 *
 * 使い方:
 *   node scripts/create-test-pdfs.js
 *   node scripts/create-test-pdfs.js --push   (ADB経由でエミュレータに転送)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PUSH_TO_EMULATOR = process.argv.includes('--push');
const OUT_DIR = path.join(__dirname, '..', 'test-pdfs');

function createPDF(title) {
  const streamContent = `BT /F1 12 Tf 72 720 Td (${title}) Tj ET`;

  const obj1 = '1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n';
  const obj2 = '2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n';
  const obj3 = `3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n`;
  const obj4 = `4 0 obj\n<</Length ${streamContent.length}>>\nstream\n${streamContent}\nendstream\nendobj\n`;
  const obj5 = '5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n';

  const header = '%PDF-1.4\n';

  let pos = header.length;
  const o1 = pos; pos += obj1.length;
  const o2 = pos; pos += obj2.length;
  const o3 = pos; pos += obj3.length;
  const o4 = pos; pos += obj4.length;
  const o5 = pos; pos += obj5.length;

  const xrefPos = pos;
  const fmt = n => String(n).padStart(10, '0');

  const xref = [
    'xref',
    '0 6',
    '0000000000 65535 f ',
    `${fmt(o1)} 00000 n `,
    `${fmt(o2)} 00000 n `,
    `${fmt(o3)} 00000 n `,
    `${fmt(o4)} 00000 n `,
    `${fmt(o5)} 00000 n `,
    '',
  ].join('\n');

  const trailer = `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`;

  return header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer;
}

// PDFファイル生成
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const files = [];
for (let i = 1; i <= 20; i++) {
  const label = String(i).padStart(2, '0');
  const title = `Test PDF ${label}`;
  const filename = `test_${label}.pdf`;
  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, createPDF(title), { encoding: 'ascii' });
  files.push({ filename, filepath });
  console.log(`✓ Created: ${filename}`);
}

console.log(`\n20個のPDFを ${OUT_DIR} に生成しました。`);

// ADB転送
if (PUSH_TO_EMULATOR) {
  console.log('\nエミュレータに転送中...');
  try {
    execSync('adb devices', { stdio: 'pipe' });
  } catch {
    console.error('エラー: adb が見つかりません。Android Studio の Platform Tools にPATHを通してください。');
    process.exit(1);
  }

  let ok = 0;
  for (const { filename, filepath } of files) {
    try {
      execSync(`adb push "${filepath}" "/sdcard/Download/${filename}"`, { stdio: 'pipe' });
      console.log(`  → /sdcard/Download/${filename}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ 失敗: ${filename}`);
    }
  }
  console.log(`\n${ok}/20 ファイルを転送しました。`);
  console.log('アプリを再起動するかリフレッシュしてください。');
} else {
  console.log('\nエミュレータに転送するには:');
  console.log('  node scripts/create-test-pdfs.js --push');
}
