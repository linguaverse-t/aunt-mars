import { auth, db } from '../services/firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showAuthModal } from './auth-modal.js';
import { handleNotificationClick, getNotifications } from './notification-handler.js';
import { showToast, linkTo } from '../utils.js';

export const renderNavbar = () => {
    const nav = document.getElementById('navbar-container');
    
    // โครงสร้าง HTML (เพิ่ม Mobile Menu Button และ Overlay กัน Hover หลุด)
    nav.innerHTML = `
        <nav class="bg-white/90 backdrop-blur-md shadow-md border-b border-pastel-purple relative z-50">
            <div class="container mx-auto px-4">
                <div class="flex justify-between items-center h-20">
                    
                    <a href="index.html" class="flex items-center space-x-3 group z-50">
                        <img src="images/logo.png" alt="Logo" class="h-10 w-10 object-contain transition-transform group-hover:scale-110" onerror="this.src='https://via.placeholder.com/40/D8B4FE/ffffff?text=L'">
                        <span class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pastel-purple to-pastel-pink">LinguaVerse</span>
                    </a>

                    <div class="hidden md:flex items-center space-x-6">
                        <a href="index.html" class="text-gray-600 hover:text-pastel-purple font-medium transition">หน้าแรก</a>
                        <a href="library.html" class="text-gray-600 hover:text-pastel-purple font-medium transition">นิยายทั้งหมด</a>
                        <a href="about.html" class="text-gray-600 hover:text-pastel-purple font-medium transition">About Us</a>
                        <a href="contact.html?page=ติดต่อเรา" class="text-gray-600 hover:text-pastel-purple font-medium transition">Contact Us</a>
                    </div>

                    <div class="flex items-center space-x-4">
                        
                        <div id="auth-section" class="flex items-center space-x-4">
                            <div class="animate-pulse w-20 h-8 bg-gray-200 rounded-full"></div>
                        </div>

                        <button id="mobile-menu-btn" class="md:hidden text-gray-500 hover:text-pastel-purple focus:outline-none ml-2">
                            <i class="fas fa-bars text-2xl"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div id="mobile-menu" class="hidden md:hidden absolute top-20 left-0 w-full bg-white border-t border-gray-100 shadow-lg p-4 flex-col space-y-4 animate-fade-in z-40">
                <a href="index.html" class="block text-gray-700 hover:text-pastel-purple font-medium">หน้าแรก</a>
                <a href="library.html" class="block text-gray-700 hover:text-pastel-purple font-medium">นิยายทั้งหมด</a>
                <a href="about.html" class="block text-gray-700 hover:text-pastel-purple font-medium">About Us</a>
                <a href="contact.html?page=Contact" class="block text-gray-700 hover:text-pastel-purple font-medium">Contact Us</a>
                <div id="mobile-auth-placeholder"></div>
            </div>
        </nav>
    `;

    // Logic Mobile Menu Toggle
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    mobileBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
        const icon = mobileBtn.querySelector('i');
        if (mobileMenu.classList.contains('hidden')) {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        } else {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        }
    });

    // Auth State Observer
    onAuthStateChanged(auth, async (user) => {
        const authSection = document.getElementById('auth-section');
        const mobileAuthPlace = document.getElementById('mobile-auth-placeholder');
        
        if (user) {
            // Logged In
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const userData = userDoc.exists() ? userDoc.data() : { role: 'user', points: 0, username: 'User', avatar: '' };
                const avatarUrl = userData.avatar || `https://ui-avatars.com/api/?name=${userData.username}&background=D8B4FE&color=fff`;
                const isAdminOrWriter = ['admin', 'writer'].includes(userData.role);

                // --- Desktop View ---
                authSection.innerHTML = `
                    <div class="relative cursor-pointer mr-2" id="noti-btn">
                        <i class="fa-solid fa-bell text-gray-500 text-xl hover:text-pastel-purple transition"></i>
                        <span class="absolute -top-1 -right-1 bg-red-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full" id="noti-count">0</span>
                    </div>

                    <div class="relative group h-10 flex items-center"> <button class="flex items-center space-x-2 focus:outline-none py-2">
                            <img src="${avatarUrl}" class="h-10 w-10 rounded-full border-2 border-pastel-purple object-cover">
                        </button>

                        <div class="absolute right-0 top-full pt-4 w-64 hidden group-hover:block z-50">
                            <div class="bg-white rounded-xl shadow-xl py-2 border border-gray-100 animate-fade-in">
                                <div class="px-4 py-3 border-b border-gray-100 bg-pastel-bg/30">
                                    <p class="text-sm font-bold text-gray-800 line-clamp-1">${userData.username}</p>
                                    <div class="flex items-center justify-between mt-1">
                                        <p class="text-xs text-gray-500">Points: <span class="text-pastel-purple font-bold text-sm">${userData.points}</span></p>
                                        <a href="topup.html?page=TopUp" class="text-xs bg-pastel-green text-white px-2 py-0.5 rounded-full hover:bg-green-400 cursor-pointer">+ เติม</a>
                                    </div>
                                </div>
                                <a href="profile.html?page=Profile" class="block px-4 py-2 text-sm text-gray-700 hover:bg-pastel-purple hover:text-white transition"><i class="fas fa-user-cog w-5"></i> Profile Management</a>
                                ${isAdminOrWriter ? `<a href="manage-novel.html?page=ManageNovel" class="block px-4 py-2 text-sm text-gray-700 hover:bg-pastel-purple hover:text-white transition"><i class="fas fa-book w-5"></i> Novel Management</a>` : ''}
                                ${isAdminOrWriter ? `<a href="manage-episode.html?page=ManageEpisode" class="block px-4 py-2 text-sm text-gray-700 hover:bg-pastel-purple hover:text-white transition"><i class="fas fa-file-pen w-5"></i> Episode Management</a>` : ''}
                                ${userData.role === 'admin' ? `<a href="admin-dashboard.html?page=Dashboard" class="block px-4 py-2 text-sm text-gray-700 hover:bg-pastel-purple hover:text-white transition"><i class="fas fa-chart-line w-5"></i> Dashboard</a>` : ''}
                                <div class="border-t border-gray-100 mt-1"></div>
                                <a href="#" id="logout-btn" class="block px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition"><i class="fas fa-sign-out-alt w-5"></i> ออกจากระบบ</a>
                            </div>
                        </div>
                    </div>
                `;

                // --- Mobile View Extra ---
                mobileAuthPlace.innerHTML = `
                    <div class="border-t border-gray-100 pt-4 mt-2">
                         <div class="flex items-center gap-3 mb-3">
                            <img src="${avatarUrl}" class="h-10 w-10 rounded-full">
                            <div>
                                <p class="font-bold text-gray-800">${userData.username}</p>
                                <p class="text-xs text-pastel-purple font-bold">${userData.points} Points</p>
                            </div>
                         </div>
                         <button id="mobile-logout-btn" class="w-full text-left text-red-500 text-sm">ออกจากระบบ</button>
                    </div>
                `;

                // Logout Logic
                const handleLogout = (e) => {
                    e.preventDefault();
                    signOut(auth).then(() => { showToast('success', 'ออกจากระบบเรียบร้อย'); window.location.reload(); });
                };
                document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
                document.getElementById('mobile-logout-btn')?.addEventListener('click', handleLogout);

                // Notifications
                const notifications = await getNotifications(user.uid, userData.role);

                // 🔥 แก้ไข: ให้นับเฉพาะแจ้งเตือนที่ยังไม่ได้อ่าน (isRead เป็น false)
                const unreadCount = notifications.filter(n => n.isRead === false).length;
                const notiCountElement = document.getElementById('noti-count');
                
                notiCountElement.innerText = unreadCount;

                // (Option เสริม) ซ่อนวงกลมสีแดงถ้าไม่มีข้อความใหม่เลย เพื่อให้เว็บดูสะอาดตา
                if (unreadCount === 0) {
                    notiCountElement.classList.add('hidden');
                } else {
                    notiCountElement.classList.remove('hidden');
                }

                document.getElementById('noti-btn').addEventListener('click', () => handleNotificationClick(notifications));

            } catch (error) { console.error(error); }

        } else {
            // Not Logged In
            const loginBtnHtml = `
                <button class="nav-signin-btn text-gray-500 hover:text-pastel-purple font-medium px-3 py-2 transition">Sign In</button>
                <button class="nav-signup-btn bg-gradient-to-r from-pastel-purple to-pastel-pink text-white font-medium px-5 py-2 rounded-full shadow-md hover:shadow-lg transition">Sign Up</button>
            `;
            authSection.innerHTML = loginBtnHtml;
            mobileAuthPlace.innerHTML = `<div class="flex gap-4 mt-4">${loginBtnHtml}</div>`;

            document.querySelectorAll('.nav-signin-btn').forEach(b => b.addEventListener('click', () => showAuthModal('signin')));
            document.querySelectorAll('.nav-signup-btn').forEach(b => b.addEventListener('click', () => showAuthModal('signup')));
        }
    });
};
