import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db, auth } from '../services/firebase.js';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, documentId } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from '../utils.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);
            loadReadingHistory(user.uid); // ฟังก์ชันนี้ต้องมีข้อมูลใน DB จริงถึงจะขึ้น
            loadFavorites(user.uid);      // เช่นกัน
        } else {
            window.location.href = 'index.html';
        }
    });

    //ฟังก์ชันพรีวิวรูปภาพอัตโนมัติเมื่อมีการวางลิงก์หรือพิมพ์ (ไม่ต้องใช้ปุ่มกด)
    document.getElementById('editAvatarUrl')?.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
            document.getElementById('profileAvatar').src = url;
        } else {
            // หากลบ URL ออก ให้กลับไปใช้รูป Placeholder ชั่วคราว
            document.getElementById('profileAvatar').src = 'https://via.placeholder.com/150';
        }
    });

    // Form Submit
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newUsername = document.getElementById('editUsername').value;
        const newAvatar = document.getElementById('editAvatarUrl').value;
        const newPassword = document.getElementById('editPassword').value;

        try {
            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            // 1. อัปเดตข้อมูลส่วนตัว (Username, Avatar)
            await updateDoc(doc(db, "users", currentUser.uid), {
                username: newUsername,
                avatar: newAvatar
            });

            // 2. อัปเดตรหัสผ่าน (หากมีการพิมพ์รหัสใหม่)
            if (newPassword && newPassword.trim() !== '') {
                if (newPassword.length < 6) {
                    Swal.close();
                    return Swal.fire('คำเตือน', 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'warning');
                }
                await updatePassword(currentUser, newPassword);
                document.getElementById('editPassword').value = ''; // เคลียร์ช่องรหัสผ่านหลังเปลี่ยนสำเร็จ
            }

            Swal.close();
            showToast('success', 'อัปเดตข้อมูลสำเร็จ');
            loadUserProfile(currentUser.uid); // Refresh UI

        } catch (error) {
            console.error(error);
            Swal.close();
            // จัดการ Error หากเซสชันเข้าสู่ระบบนานเกินไป Firebase จะบังคับให้ Login ใหม่ก่อนเปลี่ยนรหัส
            if (error.code === 'auth/requires-recent-login') {
                Swal.fire('ข้อผิดพลาด', 'เพื่อความปลอดภัย กรุณาออกจากระบบและเข้าสู่ระบบใหม่อีกครั้งก่อนทำการเปลี่ยนรหัสผ่าน', 'error');
            } else {
                Swal.fire('ข้อผิดพลาด', error.message, 'error');
            }
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = 'index.html');
    });
});

async function loadUserProfile(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Header
            document.getElementById('profileName').innerText = data.username || 'User';
            document.getElementById('profileEmail').innerText = data.email;
            document.getElementById('profilePoints').innerText = (data.points || 0).toLocaleString();
            document.getElementById('profileRole').innerText = data.role || 'User';
            
            const avatarUrl = data.avatar || `https://ui-avatars.com/api/?name=${data.username}&background=D8B4FE&color=fff`;
            document.getElementById('profileAvatar').src = avatarUrl;

            // Form
            document.getElementById('editUsername').value = data.username || '';
            document.getElementById('editEmail').value = data.email || '';
            document.getElementById('editAvatarUrl').value = data.avatar || '';
        }
    } catch (e) { console.error(e); }
}

async function loadReadingHistory(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        const historyIds = userDoc.data().readingHistory || [];
        // ใช้ reverse() เพื่อนำ ID ล่าสุด (ที่ถูก Push เข้ามาท้ายสุด) ขึ้นมาแสดงก่อน
        await fetchAndRenderNovels('historyList', [...historyIds].reverse()); 
    } catch (error) {
        console.error("Error loading history:", error);
    }
}

async function loadFavorites(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        const favIds = userDoc.data().favorites || [];
        await fetchAndRenderNovels('favList', [...favIds].reverse());
    } catch (error) {
        console.error("Error loading favorites:", error);
    }
}

// Helper to fetch and render novels safely from an array of IDs
async function fetchAndRenderNovels(containerId, novelIds) {
    const container = document.getElementById(containerId);
    
    // [ADD] กรองเอาเฉพาะ ID ที่เป็น String และไม่ว่างเปล่า เพื่อป้องกัน Error: Invalid document reference
    const validIds = (novelIds || []).filter(id => id && typeof id === 'string' && id.trim() !== '');

    if (validIds.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-6">ยังไม่มีรายการนิยาย</div>';
        return;
    }

    container.innerHTML = '<div class="col-span-full text-center text-pastel-purple py-4"><i class="fas fa-circle-notch fa-spin mr-2"></i> กำลังโหลดข้อมูล...</div>';

    try {
        // ดึงข้อมูลสูงสุด 20 เรื่องล่าสุด เพื่อป้องกันการใช้งานโควต้า Database มากเกินความจำเป็น
        const idsToFetch = validIds.slice(0, 20);
        
        // ใช้ Promise.all ดึงข้อมูลโดยตรงทีละ Document (แม่นยำและไม่ติดข้อจำกัด 'in' limit 10)
        const promises = idsToFetch.map(id => getDoc(doc(db, "novels", id)));
        const docSnaps = await Promise.all(promises);
        
        container.innerHTML = '';
        let hasValidDoc = false;

        docSnaps.forEach(docSnap => {
            if (docSnap.exists()) {
                hasValidDoc = true;
                const d = docSnap.data();
                container.innerHTML += `
                    <a href="novel-detail.html?page=NovelDetail&id=${docSnap.id}" class="flex gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-pastel-purple hover:shadow-md transition">
                        <img src="${d.coverUrl || 'https://via.placeholder.com/150'}" class="w-20 h-28 object-cover rounded-lg">
                        <div class="flex flex-col justify-center">
                            <h4 class="font-bold text-brand-dark line-clamp-1 font-mali">${d.titleTH || d.titleEN || 'No Title'}</h4>
                            <p class="text-xs text-gray-500 line-clamp-1 mb-2 font-saraban">${d.titleEN || '-'}</p>
                            <div>
                                <span class="text-xs bg-pastel-bg border border-pastel-pink text-gray-600 px-2 py-1 rounded-lg font-bold shadow-sm">
                                    <i class="fas fa-list text-pastel-purple mr-1"></i> ${d.totalEpisodes || 0} ตอน
                                </span>
                            </div>
                        </div>
                    </a>
                `;
            }
        });

        if (!hasValidDoc) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-6">ไม่พบข้อมูลนิยาย (อาจถูกลบไปแล้ว)</div>';
        }

    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="col-span-full text-center text-red-400 p-4 bg-red-50 rounded-xl">เกิดข้อผิดพลาดในการโหลดข้อมูลนิยาย</div>';
    }
}