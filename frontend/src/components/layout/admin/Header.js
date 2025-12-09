import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

// Import các action và selector từ Redux
import { logout, selectUser } from "../../../redux/userSlice";
import "../../../styles/components/Header.css";

export default function Header() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    
    // Lấy state từ Redux
    const user = useSelector(selectUser);

    // State cục bộ cho UI
    const [dropdownOpen, setDropdownOpen] = useState(false);
    
    const dropdownRef = useRef(null);

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        dispatch(logout());
        navigate("/login", { replace: true });
    };

    const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    const avatarUrl = user?.avatar || defaultAvatar;

    return (
        <header className="admin-header">
            <h3 className="logo">LilyShoe</h3>

            <div className="dropdown-wrapper" ref={dropdownRef}>
                <div className="user-info" onClick={() => setDropdownOpen(!dropdownOpen)}>
                    <img src={avatarUrl} alt="avatar" className="avatar" onError={(e) => { e.target.src = defaultAvatar; }} />
                    <span className="username">{user?.username || "Admin"}</span>
                </div>

                <ul className={`dropdown-menu ${dropdownOpen ? "show" : ""}`}>
                    <li onClick={handleLogout}>Đăng xuất</li>
                </ul>
            </div>
        </header>
    );
}