'use strict';

/**
 * Script để upload tất cả ảnh sản phẩm lên Cloudinary
 * Chạy local: node scripts/uploadToCloudinary.js
 */

require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Cấu hình Cloudinary - hiển thị để debug
console.log('🔧 Cloudinary Config:');
console.log('  Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('  API Key:', process.env.CLOUDINARY_API_KEY);
console.log('  API Secret:', process.env.CLOUDINARY_API_SECRET ? '***' + process.env.CLOUDINARY_API_SECRET.slice(-4) : 'NOT SET');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Các thư mục chứa ảnh sản phẩm
const PRODUCT_FOLDERS = [
  'SPORT/MEN',
  'SPORT/WOMEN', 
  'OFFICE/MEN',
  'OFFICE/WOMEN',
  'SANDAL/MEN',
  'SANDAL/WOMEN',
  'SNEAKER/UNISEX'
];

const uploadedUrls = {};

async function uploadImage(localPath, cloudinaryFolder) {
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      folder: `webgiay/${cloudinaryFolder}`,
      use_filename: true,
      unique_filename: false,
      overwrite: true
    });
    return result.secure_url;
  } catch (error) {
    console.error(`❌ Error uploading ${localPath}:`, error.message);
    return null;
  }
}

async function uploadAllImages() {
  console.log('🚀 Starting upload to Cloudinary...\n');
  
  for (const folder of PRODUCT_FOLDERS) {
    const folderPath = path.join(UPLOADS_DIR, folder);
    
    if (!fs.existsSync(folderPath)) {
      console.log(`⚠️ Folder not found: ${folder}`);
      continue;
    }

    const files = fs.readdirSync(folderPath).filter(f => 
      f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')
    );

    console.log(`📁 Uploading ${folder} (${files.length} files)...`);

    for (const file of files) {
      const localPath = path.join(folderPath, file);
      const cloudinaryFolder = folder.replace(/\\/g, '/');
      
      const url = await uploadImage(localPath, cloudinaryFolder);
      
      if (url) {
        const key = `/uploads/${folder}/${file}`.replace(/\\/g, '/');
        uploadedUrls[key] = url;
        console.log(`  ✅ ${file} → ${url}`);
      }
    }
    console.log('');
  }

  // Upload blogs folder
  const blogsPath = path.join(UPLOADS_DIR, 'blogs');
  if (fs.existsSync(blogsPath)) {
    const blogFiles = fs.readdirSync(blogsPath).filter(f => 
      f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')
    );
    
    console.log(`📁 Uploading blogs (${blogFiles.length} files)...`);
    
    for (const file of blogFiles) {
      const localPath = path.join(blogsPath, file);
      const url = await uploadImage(localPath, 'blogs');
      
      if (url) {
        const key = `/uploads/blogs/${file}`;
        uploadedUrls[key] = url;
        console.log(`  ✅ ${file} → ${url}`);
      }
    }
  }

  // Lưu mapping ra file JSON
  const outputPath = path.join(__dirname, 'cloudinary-urls.json');
  fs.writeFileSync(outputPath, JSON.stringify(uploadedUrls, null, 2));
  console.log(`\n✅ Done! URLs saved to: ${outputPath}`);
  console.log(`📊 Total images uploaded: ${Object.keys(uploadedUrls).length}`);
  
  return uploadedUrls;
}

// Chạy script
uploadAllImages().catch(console.error);
