'use strict';
const db = require('../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require("dotenv");
dotenv.config();
const cloudinaryConfig = require('../config/cloudinary.config');

// Helper function to upload avatar
const uploadAvatar = async (file) => {
    if (!file) return null;
    
    // In production, upload to Cloudinary
    if (process.env.NODE_ENV === 'production') {
        try {
            const result = await cloudinaryConfig.uploadImage(file.path, 'avatars');
            // Delete local temp file after upload
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
            if (result.success) {
                return result.url;
            }
            console.error('Cloudinary upload failed:', result.error);
            return null;
        } catch (error) {
            console.error('Avatar upload error:', error);
            return null;
        }
    }
    
    // In development, use local storage
    return `/uploads/${file.filename}`;
};

/**
 * @route   GET /api/profile
 * @desc    Lấy thông tin profile của user hiện tại
 * @access  Private
 */
exports.getProfile = async (req, res) => {
    try {
        const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
        const user = await db.User.findByPk(req.user.id, {
            attributes: ['UserID', 'Username', 'Email', 'FullName', 'Phone', 'AvatarURL']
        });

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }
        
        // Tạo object trả về nhất quán
        // Nếu AvatarURL đã là URL đầy đủ (Cloudinary), trả về nguyên, nếu không thì thêm BASE_URL
        const avatarUrl = user.AvatarURL 
            ? (user.AvatarURL.startsWith('http') ? user.AvatarURL : `${BASE_URL}${user.AvatarURL}`)
            : null;
            
        const userProfile = {
            id: user.UserID,
            username: user.Username,
            email: user.Email,
            fullName: user.FullName, // Chuyển thành camelCase
            phone: user.Phone,
            avatar: avatarUrl
        };

        res.json(userProfile);

    } catch (error) {
        console.error('Profile GET error:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
};

/**
 * @route   PUT /api/profile
 * @desc    Cập nhật thông tin profile (bao gồm avatar)
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { fullName, email, phone } = req.body;

        const user = await db.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        // Kiểm tra email trùng lặp (nếu có thay đổi)
        if (email && email !== user.Email) {
            const existingUser = await db.User.findOne({
                where: { Email: email, UserID: { [Op.ne]: userId } }
            });
            if (existingUser) {
                return res.status(409).json({ message: 'Email đã được sử dụng bởi tài khoản khác.' });
            }
            user.Email = email;
        }

        // Cập nhật các trường khác
        if (fullName !== undefined) user.FullName = fullName;
        if (phone !== undefined) user.Phone = phone;

        // Cập nhật avatar nếu có file mới
        if (req.file) {
            // Delete old local avatar if exists
            if (user.AvatarURL && !user.AvatarURL.startsWith('http')) {
                const oldPath = path.join(__dirname, '../../', user.AvatarURL);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            // Upload new avatar
            const newAvatarUrl = await uploadAvatar(req.file);
            if (newAvatarUrl) {
                user.AvatarURL = newAvatarUrl;
            }
        }
        
        await user.save();

        const updatedProfile = {
            id: user.UserID,
            username: user.Username,
            email: user.Email,
            fullName: user.FullName,
            phone: user.Phone,
            avatar: user.AvatarURL
        };

        res.json({ message: 'Cập nhật thông tin thành công.', profile: updatedProfile });

    } catch (error) {
        console.error('Profile PUT error:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật thông tin.' });
    }
};