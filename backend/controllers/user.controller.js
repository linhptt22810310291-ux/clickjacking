'use strict';
const db = require('../models');
const { Op, Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const emailService = require('../services/email.service');
const crypto = require('crypto'); // Đã import
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

// ... (Giữ nguyên các hàm getAllUsers, getUserById, createUser, updateUser, deleteUser) ...

exports.getAllUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
        const offset = (page - 1) * limit;
        const { keyword } = req.query;

        const whereClause = {};
        if (keyword) {
            whereClause[Op.or] = [
                { Username: { [Op.like]: `%${keyword}%` } },
                { Email: { [Op.like]: `%${keyword}%` } },
                { FullName: { [Op.like]: `%${keyword}%` } }
            ];
        }

        const { count, rows } = await db.User.findAndCountAll({
            where: whereClause,
            attributes: { exclude: ['Password'] },
            limit,
            offset,
            order: [['CreatedAt', 'ASC']]
        });

        res.json({ users: rows, total: count, page, limit });
    } catch (error) {
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.params.id, {
            attributes: { exclude: ['Password'] },
            include: [{
                model: db.Order,
                as: 'orders',
                limit: 10,
                order: [['OrderDate', 'DESC']]
            }]
        });
        if (!user) return res.status(404).json({ errors: [{ msg: 'Không tìm thấy người dùng' }] });
        
        res.json({ user: user, orders: user.orders || [] });
    } catch (error) {
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

exports.createUser = async (req, res) => {
    const { Username, Email, Password, Role, FullName, Phone, Address } = req.body;
    try {
        const existingUser = await db.User.findOne({ where: { [Op.or]: [{ Username }, { Email }] } });
        if (existingUser) return res.status(409).json({ errors: [{ msg: 'Tên đăng nhập hoặc email đã tồn tại' }] });

        const hashedPassword = await bcrypt.hash(Password, 10);
        const avatarUrl = await uploadAvatar(req.file);

        const newUser = await db.User.create({
            Username, Email, Password: hashedPassword, Role, FullName, Phone, Address, AvatarURL: avatarUrl
        });

        const userJson = newUser.toJSON();
        delete userJson.Password;

        res.status(201).json({ message: 'Thêm người dùng thành công', user: userJson });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi khi thêm người dùng' }] });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ errors: [{ msg: 'Không tìm thấy người dùng' }] });

        const { Email } = req.body;
        if (Email && Email !== user.Email) {
            const existing = await db.User.findOne({ where: { Email, UserID: { [Op.ne]: req.params.id } } });
            if (existing) return res.status(409).json({ errors: [{ msg: 'Email đã được sử dụng' }] });
        }

        // Handle avatar upload
        if (req.file) {
            // Delete old avatar if it's a local file (not Cloudinary URL)
            if (user.AvatarURL && !user.AvatarURL.startsWith('http')) {
                const oldAvatarPath = path.join(__dirname, '../../', user.AvatarURL);
                if (fs.existsSync(oldAvatarPath)) fs.unlinkSync(oldAvatarPath);
            }
            // Upload new avatar
            const newAvatarUrl = await uploadAvatar(req.file);
            if (newAvatarUrl) {
                req.body.AvatarURL = newAvatarUrl;
            }
        }
        
        const { Password, ...updateData } = req.body;
        delete updateData.TwoFactorEnabled;
        delete updateData.TwoFactorSecret;
        
        await user.update(updateData);

        const userJson = user.toJSON();
        delete userJson.Password;

        res.json({ message: 'Cập nhật người dùng thành công', user: userJson });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

exports.deleteUser = async (req, res) => {
    const currentUserId = (req.user || req.auth).id;
    const userIdToDelete = parseInt(req.params.id, 10);
    
    try {
        if (userIdToDelete === currentUserId) {
            return res.status(403).json({ errors: [{ msg: 'Không thể xóa tài khoản đang đăng nhập' }] });
        }

        const user = await db.User.findByPk(userIdToDelete);
        if (!user) return res.status(404).json({ errors: [{ msg: 'Không tìm thấy người dùng' }] });

        if (user.Role === 'admin') {
            const adminCount = await db.User.count({ where: { Role: 'admin' } });
            if (adminCount <= 1) return res.status(403).json({ errors: [{ msg: 'Không thể xóa admin cuối cùng' }] });
        }

        await user.destroy();
        
        if (user.AvatarURL) {
            const avatarPath = path.join(__dirname, '../../', user.AvatarURL);
            if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
        }

        res.json({ message: 'Xóa người dùng thành công' });
    } catch (error) {
        if (error instanceof Sequelize.ForeignKeyConstraintError) {
            return res.status(409).json({ errors: [{ msg: 'Không thể xóa. Người dùng đã có đơn hàng hoặc dữ liệu liên quan.' }] });
        }
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

// SỬA: Logic hàm resetPasswordByAdmin
exports.resetPasswordByAdmin = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ errors: [{ msg: 'Không tìm thấy người dùng' }] });

        // 1. Tạo OTP (SỬA: Dùng crypto.randomBytes)
        // const otp = crypto.randomInt(100000, 999999).toString(); // Lỗi
        
        // CÁCH THAY THẾ (Tương thích Node.js cũ)
        const value = parseInt(crypto.randomBytes(4).toString('hex'), 16);
        const otp = ((value % 900000) + 100000).toString(); // Đảm bảo là 6 chữ số

        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

        // 2. Lưu OTP (đã băm)
        const hashedOtp = await bcrypt.hash(otp, 10);
        await user.update({
            ResetToken: hashedOtp,
            ResetTokenExpiry: expiry
        });

        // 3. Gửi email OTP cho người dùng
        console.log('📧 [Admin Reset Password] Sending email to:', user.Email);
        try {
            await emailService.sendOtpEmail(user.Email, otp);
            console.log('✅ [Admin Reset Password] Email sent successfully to:', user.Email);
        } catch (emailError) {
            console.error('❌ [Admin Reset Password] Email sending failed:', emailError.message);
            return res.status(500).json({ errors: [{ msg: 'Không thể gửi email. Vui lòng kiểm tra cấu hình email.' }] });
        }
        
        res.json({ message: 'Đã gửi email chứa mã OTP reset mật khẩu cho người dùng.' });

    } catch (error) {
        console.error('❌ Lỗi khi admin reset password:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ khi gửi email reset' }] });
    }
};

// Hàm này đã bị xóa trong file routes, nhưng để đây cũng không ảnh hưởng
// exports.toggleTwoFactor = ...