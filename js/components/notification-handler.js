import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/src/sweetalert2.js';
import { showToast } from '../utils.js';
import { db } from '../services/firebase.js';
import { doc, updateDoc, addDoc, serverTimestamp, collection, deleteDoc, getDocs, query, where, orderBy, limit, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const encodeData = (value) => encodeURIComponent(String(value ?? ''));
const decodeData = (value) => decodeURIComponent(value || '');

export const getNotifications = async (userId, role) => {
    if (!userId) return [];
    const notificationsRef = collection(db, "notifications");
    const q = query(
        notificationsRef,
        where("to", "==", role === 'admin' ? 'admin' : userId),
        orderBy("createdAt", "desc"),
        limit(20)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const handleNotificationClick = (notifications) => {
    if (!notifications.length) {
        showToast('info', 'No notifications');
        return;
    }

    const listHtml = notifications.map((n) => `
        <div class="relative text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition group ${!n.isRead ? 'bg-purple-50' : ''}">
            <button
                type="button"
                class="noti-open w-full text-left cursor-pointer pr-8"
                data-id="${escapeHtml(n.id)}"
                data-type="${escapeHtml(encodeData(n.type))}"
                data-from="${escapeHtml(encodeData(n.from || n.senderName || ''))}"
                data-message="${escapeHtml(encodeData(n.message || ''))}"
                data-link="${escapeHtml(encodeData(n.link || ''))}"
                data-amount="${Number(n.amount || 0)}"
                data-sender-id="${escapeHtml(encodeData(n.senderId || n.userId || ''))}"
            >
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${getTypeColor(n.type)} text-white tracking-wider">${escapeHtml(n.type || 'system')}</span>
                    <span class="text-sm font-semibold text-gray-700 truncate w-32">${escapeHtml(n.title || 'Notification')}</span>
                    ${!n.isRead ? '<span class="w-2 h-2 rounded-full bg-red-500 ml-auto"></span>' : ''}
                </div>
                <p class="text-xs text-gray-500 mt-1">${escapeHtml(n.message || '')}</p>
            </button>

            <button type="button" data-id="${escapeHtml(n.id)}" class="noti-delete absolute top-3 right-3 text-gray-300 hover:text-red-400 transition p-1" title="Delete notification">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');

    Swal.fire({
        title: 'Notifications',
        html: `<div class="max-h-80 overflow-y-auto custom-scrollbar">${listHtml}</div>`,
        showConfirmButton: false,
        showCloseButton: true,
        width: '420px',
        customClass: { popup: 'rounded-2xl font-mali' },
        didOpen: () => {
            const popup = Swal.getPopup();
            popup?.querySelectorAll('.noti-delete').forEach((btn) => {
                btn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const docId = btn.getAttribute('data-id');
                    if (docId) await window.deleteNoti(event, docId);
                });
            });
            popup?.querySelectorAll('.noti-open').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const docId = btn.getAttribute('data-id') || '';
                    const type = decodeData(btn.getAttribute('data-type'));
                    const fromUser = decodeData(btn.getAttribute('data-from'));
                    const fullMessage = decodeData(btn.getAttribute('data-message'));
                    const link = decodeData(btn.getAttribute('data-link'));
                    const amount = Number(btn.getAttribute('data-amount') || 0);
                    const senderId = decodeData(btn.getAttribute('data-sender-id'));
                    window.triggerNotiAction(docId, type, fromUser, fullMessage, link, amount, senderId);
                });
            });
        }
    });
};

const getTypeColor = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'topup') return 'bg-blue-400';
    if (t === 'coffee') return 'bg-yellow-400';
    if (t === 'comment') return 'bg-green-400';
    if (t === 'contact' || t === 'contact_msg') return 'bg-purple-400';
    return 'bg-gray-400';
};

window.deleteNoti = async (event, docId) => {
    event.stopPropagation();
    try {
        // 1. ปิดหน้าต่างลิสต์แจ้งเตือนเดิมก่อน
        Swal.close();
        
        // 2. แสดงสถานะกำลังโหลด
        Swal.fire({
            title: 'กำลังลบ...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            customClass: { popup: 'font-mali' }
        });

        // 3. สั่งลบข้อมูลใน Database
        await deleteDoc(doc(db, "notifications", docId));
        
        // 4. แสดง PopUp แจ้งว่าลบสำเร็จแล้ว
        Swal.fire({
            icon: 'success',
            title: 'ลบแจ้งเตือนเรียบร้อยแล้ว',
            showConfirmButton: false,
            timer: 1500, // แสดงค้างไว้ 1.5 วินาทีแล้วปิดเอง
            customClass: { popup: 'font-mali' }
        }).then(() => {
            window.location.reload(); // รีเฟรชหน้าเพื่ออัปเดตตัวเลขกระดิ่งและลิสต์ใหม่
        });

    } catch (error) {
        console.error("Delete Error:", error);
        Swal.fire('Error', 'ไม่สามารถลบแจ้งเตือนได้', 'error');
    }
};

window.triggerNotiAction = async (docId, type, fromUser, fullMessage, link, amount, senderId) => {
    Swal.close();

    try {
        await updateDoc(doc(db, "notifications", docId), { isRead: true });
    } catch (e) {
        console.error(e);
    }

    const t = (type || '').toLowerCase();
    if (t === 'topup') {
        // Redirect to manage-topup page instead of opening modal
        window.location.href = 'manage-topup.html';

    } else if (t === 'coffee') {
        Swal.fire({
            title: 'Coffee support',
            text: fullMessage,
            imageUrl: 'https://cdn-icons-png.flaticon.com/512/751/751621.png',
            imageWidth: 80,
            imageHeight: 80,
            showCancelButton: true,
            confirmButtonText: 'Send thanks',
            confirmButtonColor: '#FDE68A',
            cancelButtonText: 'Close'
        }).then(async (result) => {
            if (result.isConfirmed) {
                if (senderId) {
                    await addDoc(collection(db, "notifications"), {
                        to: senderId,
                        type: 'system',
                        title: 'Thanks for your support!',
                        message: 'Thank you for supporting the writer.',
                        isRead: false,
                        createdAt: serverTimestamp()
                    });
                    showToast('success', 'Thanks sent');
                } else {
                    showToast('error', 'Cannot find sender');
                }
            }
        });
    } else if (t === 'comment') {
        if (link) window.location.href = link;
    } else if (t === 'contact' || t === 'contact_msg') {
        Swal.fire({
            title: `Message from ${escapeHtml(fromUser)}`,
            text: fullMessage,
            input: 'textarea',
            inputLabel: 'Reply',
            inputPlaceholder: 'Type your reply...',
            showCancelButton: true,
            confirmButtonText: 'Send',
            confirmButtonColor: '#D8B4FE'
        }).then(async (result) => {
            if (result.isConfirmed && result.value && senderId) {
                await addDoc(collection(db, "notifications"), {
                    to: senderId,
                    type: 'system',
                    title: 'Reply from admin',
                    message: result.value,
                    isRead: false,
                    createdAt: serverTimestamp()
                });
                showToast('success', 'Reply sent');
            }
        });
    }
};
