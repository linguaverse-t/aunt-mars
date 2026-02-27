import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db, auth } from '../services/firebase.js';
import { collection, query, orderBy, getDocs, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from '../utils.js';

let currentUser = null;
let allUsersData = [];

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();

    // Verify Admin Auth
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = 'index.html'; return; }
        currentUser = user;
        
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.data()?.role !== 'admin') {
                Swal.fire('Access Denied', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'error').then(() => window.location.href = 'index.html');
                return;
            }
            // Load data
            loadUsers();
            setupSearch();
        } catch (error) {
            console.error("Auth check error:", error);
        }
    });
});

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    try {
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        allUsersData = [];
        snapshot.forEach(docSnap => {
            allUsersData.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderUsersTable(allUsersData);

    } catch (error) {
        console.error("Error loading users:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-400 font-mali">เกิดข้อผิดพลาดในการดึงข้อมูล<br><span class="text-xs">(${error.message})</span></td></tr>`;
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400 font-mali">ไม่พบรายชื่อผู้ใช้</td></tr>`;
        return;
    }

    let html = '';
    users.forEach(u => {
        const dateStr = u.createdAt && typeof u.createdAt.toDate === 'function' ? new Date(u.createdAt.toDate()).toLocaleDateString('th-TH') : '-';
        const role = u.role || 'user';
        const avatarUrl = u.avatar || `https://ui-avatars.com/api/?name=${u.username || 'User'}&background=D8B4FE&color=fff`;

        // Role Badge Styling
        let roleBadge = '';
        if (role === 'admin') roleBadge = `<span class="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase"><i class="fas fa-crown mr-1"></i> Admin</span>`;
        else if (role === 'writer') roleBadge = `<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase"><i class="fas fa-pen mr-1"></i> Writer</span>`;
        else roleBadge = `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">User</span>`;

        html += `
            <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm">
                        <div>
                            <p class="font-bold text-gray-800 line-clamp-1">${u.username || 'No Name'}</p>
                            <p class="text-xs text-gray-400 font-saraban">${u.email || '-'}</p>
                        </div>
                    </div>
                </td>
                <td class="p-4 text-sm text-gray-500 font-saraban">${dateStr}</td>
                <td class="p-4 text-center font-bold text-yellow-500"><i class="fas fa-coins mr-1 text-xs"></i> ${(u.points || 0).toLocaleString()}</td>
                <td class="p-4 text-center">${roleBadge}</td>
                <td class="p-4 text-center">
                    <button onclick="window.editUserRole('${u.id}', '${role}', '${u.username}')" class="text-pastel-purple hover:bg-pastel-purple hover:text-white border border-pastel-purple px-3 py-1 rounded-lg text-xs font-bold transition shadow-sm" title="เปลี่ยนบทบาท">
                        <i class="fas fa-user-edit mr-1"></i> ปรับยศ
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function setupSearch() {
    const input = document.getElementById('searchUserInput');
    if (!input) return;
    
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            renderUsersTable(allUsersData);
            return;
        }
        const filtered = allUsersData.filter(u => 
            (u.username && u.username.toLowerCase().includes(term)) || 
            (u.email && u.email.toLowerCase().includes(term))
        );
        renderUsersTable(filtered);
    });
}

// Global Function สำหรับแก้ไข Role
window.editUserRole = async (userId, currentRole, username) => {
    // ป้องกัน Admin เผลอเปลี่ยนยศตัวเอง
    if (userId === currentUser.uid) {
        return Swal.fire('ไม่สามารถแก้ไขได้', 'คุณไม่สามารถเปลี่ยนบทบาท (Role) ของตัวเองได้', 'warning');
    }

    const { value: newRole } = await Swal.fire({
        title: `ปรับยศของ ${username}`,
        input: 'select',
        inputOptions: {
            'user': 'ผู้ใช้ทั่วไป (User)',
            'writer': 'นักเขียน (Writer)',
            'admin': 'ผู้ดูแลระบบ (Admin)'
        },
        inputValue: currentRole,
        showCancelButton: true,
        confirmButtonColor: '#D8B4FE',
        confirmButtonText: 'บันทึกการเปลี่ยนแปลง',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'font-mali !overflow-visible pb-8', htmlContainer: '!overflow-visible' }
    });

    if (newRole && newRole !== currentRole) {
        try {
            Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            await updateDoc(doc(db, "users", userId), { role: newRole });
            
            Swal.close();
            showToast('success', `เปลี่ยนบทบาทเป็น ${newRole} สำเร็จ`);
            loadUsers(); // โหลดตารางใหม่
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'ไม่สามารถเปลี่ยนบทบาทได้: ' + error.message, 'error');
        }
    }
};