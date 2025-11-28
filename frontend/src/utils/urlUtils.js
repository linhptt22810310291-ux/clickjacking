// src/utils/urlUtils.js

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:5000';
const PLACEHOLDER_IMAGE = 'https://placehold.co/400x400/e2e8f0/64748b?text=No+Image';

/**
 * Resolve image URL - handles both relative paths and full URLs (like Cloudinary)
 * @param {string} imagePath - The image path/URL
 * @param {string} placeholder - Optional placeholder image
 * @returns {string} - Full image URL
 */
export const resolveImageUrl = (imagePath, placeholder = PLACEHOLDER_IMAGE) => {
  // If no image path, return placeholder
  if (!imagePath) {
    return placeholder;
  }

  // If already a full URL (Cloudinary, etc.), return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // Otherwise, prepend backend URL
  const correctedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}${correctedPath}`;
};

export const resolveAvatarUrl = (avatarPath) => {
  // Nếu không có avatar, trả về ảnh mặc định
  if (!avatarPath) {
    return '/default-avatar.png'; // Đảm bảo file này có trong thư mục /public
  }

  // Nếu đã là URL đầy đủ (từ Google, Facebook), trả về chính nó
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }

  // Nếu là đường dẫn tương đối, nối với Base URL của backend
  // Đảm bảo đường dẫn bắt đầu bằng dấu gạch chéo
  const correctedPath = avatarPath.startsWith('/') ? avatarPath : `/${avatarPath}`;
  return `${API_BASE_URL}${correctedPath}`;
};