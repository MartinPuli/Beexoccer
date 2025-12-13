const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sourceImage = path.join(__dirname, 'Gemini_Generated_Image_tfljzdtfljzdtflj.png');
const androidResPath = path.join(__dirname, 'frontend', 'android', 'app', 'src', 'main', 'res');

// Android launcher icon sizes
const iconSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

// Foreground icon sizes (larger for adaptive icons)
const foregroundSizes = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432
};

async function generateIcons() {
  console.log('Generating Android icons from:', sourceImage);
  
  for (const [folder, size] of Object.entries(iconSizes)) {
    const outputDir = path.join(androidResPath, folder);
    
    // ic_launcher.png
    await sharp(sourceImage)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, 'ic_launcher.png'));
    console.log(`Created ${folder}/ic_launcher.png (${size}x${size})`);
    
    // ic_launcher_round.png
    await sharp(sourceImage)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, 'ic_launcher_round.png'));
    console.log(`Created ${folder}/ic_launcher_round.png (${size}x${size})`);
  }
  
  // Generate foreground icons for adaptive icons
  for (const [folder, size] of Object.entries(foregroundSizes)) {
    const outputDir = path.join(androidResPath, folder);
    
    await sharp(sourceImage)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, 'ic_launcher_foreground.png'));
    console.log(`Created ${folder}/ic_launcher_foreground.png (${size}x${size})`);
  }
  
  console.log('Done!');
}

generateIcons().catch(console.error);
