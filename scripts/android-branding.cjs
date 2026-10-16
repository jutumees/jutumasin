// Resize the existing website artwork; no generated or redrawn branding.
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const res = path.join(root, 'android/app/src/main/res');
const logo = path.join(root, 'assets/logo.png');
async function write(relative, pipeline) {
  const file = path.join(res, relative);
  await fs.mkdir(path.dirname(file), {recursive:true});
  await pipeline.png().toFile(file);
}
(async()=>{
  const {width, height} = await sharp(logo).metadata();
  const mark = await sharp(logo).extract({left:0,top:0,width:Math.round(width * 273 / 900),height}).png().toBuffer();
  for (const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]) {
    const artwork = await sharp(mark).resize(Math.round(size*.65),Math.round(size*.65),{fit:'inside'}).toBuffer();
    await write(`mipmap-${density}/ic_launcher.png`,sharp({create:{width:size,height:size,channels:4,background:'#120014'}}).composite([{input:artwork,gravity:'centre'}]));
  }
  const foreground = await sharp(mark).resize(252,252,{fit:'inside'}).toBuffer();
  await write('drawable-xxxhdpi/ic_launcher_foreground.png',sharp({create:{width:432,height:432,channels:4,background:'#00000000'}}).composite([{input:foreground,gravity:'centre'}]));
  // Full wordmark inside Android's splash icon safe circle (288dp canvas).
  const wordmark = await sharp(logo).resize({width:736}).toBuffer();
  await write('drawable-xxxhdpi/splash_logo.png',sharp({create:{width:1152,height:1152,channels:4,background:'#00000000'}}).composite([{input:wordmark,gravity:'centre'}]));
  console.log('Android icons and splash artwork exported from assets/logo.png.');
})().catch(error=>{console.error(error);process.exitCode=1;});
