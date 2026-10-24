'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
async function run() {
  const folder=__dirname;
  const vector=await fs.readFile(path.join(folder,'brand-icon.svg'));
  await sharp(vector).resize(1024,1024).png().toFile(path.join(folder,'icon.png'));
  console.log('Created icon.png (1024 × 1024)');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
