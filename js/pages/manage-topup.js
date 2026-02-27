import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db, auth } from '../services/firebase.js';
import { collection, query, where, orderBy, getDocs, updateDoc, doc, increment, addDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from '../utils.js';

let currentUser = null;

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
            // If admin, load data
            loadTopupRequests();
        } catch (error) {
            console.error("Auth check error:", error);
        }
    });
});

async function loadTopupRequests() {
    const tbody = document.getElementById('topupTableBody');
    try {
        // Query notifications for type 'topup'
        const q = query(collection(db, "notifications"), where("type", "==", "topup"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400 font-mali">ยังไม่มีรายการแจ้งเติมเงินในระบบ</td></tr>`;
            return;
        }

        let html = '';
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            const dateStr = d.createdAt ? new Date(d.createdAt.toDate()).toLocaleString('th-TH') : '-';
            const status = d.status || 'pending';
            
            // Status Badge Styling
            let statusBadge = '';
            let actionButtons = '-';

            if (status === 'pending') {
                statusBadge = `<span class="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold border border-yellow-200">รอตรวจ</span>`;
                actionButtons = `
                    <div class="flex justify-center gap-2">
                        <button onclick="window.approveTopup('${id}', '${d.senderId}', ${d.amount})" class="w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-500 hover:text-white transition shadow-sm" title="อนุมัติ">
                            <i class="fas fa-check"></i>
                        </button>
                        <button onclick="window.rejectTopup('${id}', '${d.senderId}')" class="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-500 hover:text-white transition shadow-sm" title="ปฏิเสธ">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            } else if (status === 'approved') {
                statusBadge = `<span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">อนุมัติแล้ว</span>`;
            } else if (status === 'rejected') {
                statusBadge = `<span class="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">ปฏิเสธแล้ว</span>`;
            }

            html += `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td class="p-4 text-sm text-gray-500 font-saraban">${dateStr}</td>
                    <td class="p-4 font-bold text-gray-700">${d.from || '-'}</td>
                    <td class="p-4 text-sm text-gray-600 font-saraban line-clamp-1">${d.message || '-'}</td>
                    <td class="p-4 text-center font-bold text-pastel-purple">+${(d.amount || 0).toLocaleString()}</td>
                    <td class="p-4 text-center">${statusBadge}</td>
                    <td class="p-4 text-center">${actionButtons}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error("Error loading topups:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-400 font-mali">เกิดข้อผิดพลาดในการดึงข้อมูล<br><span class="text-xs">(${error.message})</span></td></tr>`;
    }
}

// Global functions for inline HTML button calls
window.approveTopup = async (notiId, senderId, amount) => {
    if (!senderId) return Swal.fire('Error', 'ไม่พบรหัสผู้ใช้ ไม่สามารถอนุมัติได้', 'error');

    const result = await Swal.fire({
        title: 'ยืนยันการอนุมัติ?',
        text: `ระบบจะทำการเติม ${amount} Points ให้ผู้ใช้ทันที`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#86EFAC',
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'font-mali' }
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({ title: 'กำลังประมวลผล...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

            // 1. Update user points
            await updateDoc(doc(db, "users", senderId), {
                points: increment(amount)
            });

            // 2. Update notification status to 'approved'
            await updateDoc(doc(db, "notifications", notiId), {
                status: 'approved',
                isRead: true
            });

            // 3. Send success notification to user
            await addDoc(collection(db, "notifications"), {
                to: senderId,
                type: 'system',
                title: 'เติม Points สำเร็จ! 🎉',
                message: `ยอด ${amount} Points ถูกเพิ่มเข้าบัญชีของคุณเรียบร้อยแล้ว ขอบคุณที่สนับสนุนค่ะ`,
                isRead: false,
                createdAt: serverTimestamp()
            });

            Swal.close();
            showToast('success', 'อนุมัติรายการสำเร็จ');
            loadTopupRequests(); // Reload table

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + error.message, 'error');
        }
    }
};

window.rejectTopup = async (notiId, senderId) => {
    if (!senderId) return Swal.fire('Error', 'ไม่พบรหัสผู้ใช้', 'error');

    const { value: reason } = await Swal.fire({
        title: 'ปฏิเสธรายการ',
        input: 'text',
        inputLabel: 'ระบุเหตุผลที่ปฏิเสธ (จะส่งไปให้ผู้ใช้ทราบ)',
        inputPlaceholder: 'เช่น สลิปไม่ถูกต้อง, ยอดเงินไม่ตรง',
        showCancelButton: true,
        confirmButtonColor: '#FCA5A5',
        confirmButtonText: 'ปฏิเสธรายการ',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'font-mali' }
    });

    if (reason !== undefined) {
        try {
            Swal.fire({ title: 'กำลังประมวลผล...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

            // 1. Update notification status to 'rejected'
            await updateDoc(doc(db, "notifications", notiId), {
                status: 'rejected',
                isRead: true
            });

            // 2. Send rejection notification to user
            await addDoc(collection(db, "notifications"), {
                to: senderId,
                type: 'system',
                title: 'แจ้งเตือนการเติม Points ⚠️',
                // [OVERWRITE] เพิ่มคำว่า "กรุณาติดต่อแอดมิน" ต่อท้ายข้อความ
                message: `รายการเติมเงินของคุณถูกปฏิเสธ เหตุผล: ${reason || 'ข้อมูลไม่ถูกต้อง'} (กรุณาติดต่อแอดมิน)`,
                isRead: false,
                createdAt: serverTimestamp()
            });

            Swal.close();
            showToast('info', 'ปฏิเสธรายการเรียบร้อย');
            loadTopupRequests(); // Reload table

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + error.message, 'error');
        }
    }
};