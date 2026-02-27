import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db, auth } from '../services/firebase.js';
// [CHANGE] ใช้ getDocs เท่านั้น
import { doc, getDoc, collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, increment, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { setupScrollToTop, showToast } from '../utils.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/src/sweetalert2.js';

let novelId = null;
let episodeNumber = null;
let currentFontSize = 18;
let currentUser = null;
let novelData = null;
let currentUserRole = 'guest';
let unlockedEpisodes = [];
let currentEpisodeDocId = null;
const FREE_MODE = false;
let currentUserData = null; // สำหรับเก็บข้อมูลจาก Firestore (เพื่อให้ได้ Username ที่ถูกต้อง)
let replyingToId = null;    // สำหรับเก็บ ID ของคอมเมนต์หลักเวลาเรากด Reply

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeUrl = (value, fallback = 'https://ui-avatars.com/api/?name=User&background=D8B4FE&color=fff') => {
    try {
        const url = new URL(String(value || ''), window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
        return fallback;
    } catch {
        return fallback;
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    renderNavbar();
    renderFooter();
    setupScrollToTop();
    loadSettings();

    const urlParams = new URLSearchParams(window.location.search);
    novelId = urlParams.get('id');
    episodeNumber = parseInt(urlParams.get('ep'));

    if (!novelId || !episodeNumber) {
        window.location.href = 'library.html';
        return;
    }

    await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            if (user) {
                const userSnap = await getDoc(doc(db, "users", user.uid));
                if (userSnap.exists()) {
                    const data = userSnap.data();
		    currentUserData = data;
                    currentUserRole = data.role || 'user';
                    unlockedEpisodes = data.unlockedEpisodes || [];
                } else {
                    currentUserRole = 'user';
                    unlockedEpisodes = [];
                }
            } else {
                currentUserRole = 'guest';
                unlockedEpisodes = [];
            }
            updateCommentUserUI();
            unsub();
            resolve();
        });
    });

    await loadContent();
    loadComments();

    setupCopyProtection();
    
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
});

async function loadContent() {
    try {
        const novelSnap = await getDoc(doc(db, "novels", novelId));
        if (!novelSnap.exists()) throw new Error("Novel not found");
        novelData = novelSnap.data();
        
        document.getElementById('novelTitle').innerText = novelData.titleEN;
        document.getElementById('backToDetail').href = `novel-detail.html?id=${novelId}`;

        const epRef = collection(db, "novels", novelId, "episodes");
        const isAdminOrWriter = ['admin', 'writer'].includes(currentUserRole);
        const q = isAdminOrWriter
            ? query(epRef, where("episodeNumber", "==", episodeNumber))
            : query(epRef, where("episodeNumber", "==", episodeNumber), where("isPublished", "==", true));
        const epSnap = await getDocs(q);
        
        if (epSnap.empty) {
            document.getElementById('novel-content').innerHTML = `<div class="text-center py-20 text-red-400">ไม่พบเนื้อหาของตอนที่ ${episodeNumber}</div>`;
            return;
        }

        const epDoc = epSnap.docs[0];
        const epData = epDoc.data();
        currentEpisodeDocId = epDoc.id;
        const isPublished = epData.isPublished === true;
        const publishAt = epData.publishAt?.toDate ? epData.publishAt.toDate() : null;
        const isAccessibleByPublish = isPublished && (!publishAt || publishAt <= new Date());
        if (!isAdminOrWriter && !isAccessibleByPublish) {
            Swal.fire('Error', 'Episode is not published yet', 'error').then(() => {
                window.location.href = `novel-detail.html?id=${novelId}`;
            });
            return;
        }

        const price = epData.requiredPoints || 0;
        const isFree = price === 0 || epData.accessType === 'free';
        const episodeKey = `${novelId}_${epData.episodeNumber}`;
        const canRead = FREE_MODE || isAdminOrWriter || isFree || unlockedEpisodes.includes(episodeKey);
        if (!canRead) {
            Swal.fire('Locked', `This episode requires ${price} points`, 'warning').then(() => {
                window.location.href = `novel-detail.html?id=${novelId}`;
            });
            return;
        }

        let contentHtml = epData.content || '';
        const separatorImg = '<img src="https://res.cloudinary.com/dndzxxk8x/image/upload/v1771080049/%E0%B9%80%E0%B8%AA%E0%B9%89%E0%B8%99%E0%B8%84%E0%B8%B1%E0%B9%88%E0%B8%99-Dog-removebg-preview_uera2l.png" class="custom-separator" alt="separator">';
        contentHtml = contentHtml.replace(/<hr[^>]*\/?>/gi, separatorImg);
        
        document.title = `ตอนที่ ${epData.episodeNumber}: ${epData.title} - LinguaVerse`;
        document.getElementById('epTitle').innerText = epData.title;
        document.getElementById('epTitleHeader').innerText = `ตอนที่ ${epData.episodeNumber}: ${epData.title}`;
        document.getElementById('novel-content').innerHTML = contentHtml;
        
        applyFontSize();

        setupNavigation(episodeNumber, novelData.totalEpisodes, novelData.latestEpisodeNumber);
        loadToc(novelData.latestEpisodeNumber);

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'ไม่สามารถโหลดเนื้อหาได้', 'error');
    }
}

function setupNavigation(current, total, latest) {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (current > 1) {
        prevBtn.onclick = () => window.location.href = `read-episode.html?id=${novelId}&ep=${current - 1}`;
        prevBtn.disabled = false;
    } else {
        prevBtn.disabled = true;
    }

    if (current < latest) {
        nextBtn.onclick = () => window.location.href = `read-episode.html?id=${novelId}&ep=${current + 1}`;
        nextBtn.disabled = false;
        nextBtn.innerHTML = `ตอนถัดไป <i class="fas fa-arrow-right ml-2"></i>`;
    } else {
        nextBtn.disabled = true;
        nextBtn.innerText = "ถึงตอนล่าสุดแล้ว";
    }
}

async function loadToc(latestEp) {
    const tocList = document.getElementById('tocList');
    try {
        const epRef = collection(db, "novels", novelId, "episodes");
        const isAdminOrWriter = ['admin', 'writer'].includes(currentUserRole);
        const q = isAdminOrWriter
            ? query(epRef, orderBy("episodeNumber", "asc"))
            : query(epRef, where("isPublished", "==", true), orderBy("episodeNumber", "asc"));
        const snapshot = await getDocs(q);
        
        let html = '';
        snapshot.forEach(doc => {
            const d = doc.data();
            const isPublished = d.isPublished === true;
            const publishAt = d.publishAt?.toDate ? d.publishAt.toDate() : null;
            const isAccessibleByPublish = isPublished && (!publishAt || publishAt <= new Date());
            if (!isAdminOrWriter && !isAccessibleByPublish) return;
            const isActive = d.episodeNumber === episodeNumber 
                ? 'bg-pastel-purple text-white shadow-md transform scale-105' 
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700';
            
            const coinIcon = (d.requiredPoints > 0 && d.accessType !== 'free') 
                ? '<i class="fas fa-coins text-yellow-400 ml-2"></i>' 
                : '';

            html += `
                <a href="read-episode.html?id=${novelId}&ep=${d.episodeNumber}" class="block p-3 rounded-lg ${isActive} transition flex justify-between items-center mb-1">
                    <span class="truncate text-sm">ตอนที่ ${d.episodeNumber}: ${escapeHtml(d.title || 'Untitled')}</span>
                    ${coinIcon}
                </a>
            `;
        });
        tocList.innerHTML = html || '<p class="text-center text-gray-400 p-4">ไม่มีข้อมูลสารบัญ</p>';
    } catch (e) {
        console.error("TOC Load Error:", e);
    }
}

function loadSettings() {
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
        updateThemeIcon(true);
    }
    const savedFont = localStorage.getItem('fontSize');
    if (savedFont) currentFontSize = parseInt(savedFont);
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const icon = document.querySelector('#themeToggle i');
    icon.className = isDark ? 'fas fa-sun text-yellow-300' : 'fas fa-moon text-gray-400';
}

window.changeFontSize = (change) => {
    currentFontSize += change;
    if (currentFontSize < 14) currentFontSize = 14;
    if (currentFontSize > 32) currentFontSize = 32;
    applyFontSize();
    localStorage.setItem('fontSize', currentFontSize);
}

function applyFontSize() {
    const content = document.getElementById('novel-content');
    if(content) content.style.fontSize = `${currentFontSize}px`;
}

function updateCommentUserUI() {
    if (currentUser) {
        // ใช้ Username จาก Firestore แทนอีเมล
        const displayUsername = currentUserData?.username || currentUser.displayName || currentUser.email.split('@')[0];
        document.getElementById('currentUserName').innerText = displayUsername;
        
        const avatarUrl = safeUrl(currentUserData?.avatar || currentUser.photoURL || `https://ui-avatars.com/api/?name=${displayUsername}&background=D8B4FE&color=fff`);
        document.getElementById('currentUserAvatar').innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover">`;
        document.getElementById('commentInput').disabled = false;
        document.getElementById('commentInput').placeholder = "แสดงความคิดเห็นเกี่ยวกับตอนนี้...";
    } else {
        document.getElementById('currentUserName').innerText = 'กรุณาเข้าสู่ระบบเพื่อแสดงความคิดเห็น';
        document.getElementById('currentUserAvatar').innerHTML = `<div class="w-full h-full bg-gray-300 flex items-center justify-center"><i class="fas fa-user text-gray-500"></i></div>`;
        document.getElementById('commentInput').disabled = true;
    }
}

window.postComment = async () => {
    if (!currentEpisodeDocId) return Swal.fire('Error', 'Cannot find current episode', 'error');
    if (!currentUser) return Swal.fire({ title: 'กรุณาเข้าสู่ระบบ', icon: 'warning' });
    
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    if (!text) return showToast('warning', 'กรุณาพิมพ์ข้อความก่อนส่ง');

    try {
        const displayUsername = currentUserData?.username || currentUser.displayName || 'Reader';
        
        const commentData = {
            userId: currentUser.uid,
            username: displayUsername,
            avatar: currentUserData?.avatar || currentUser.photoURL || `https://ui-avatars.com/api/?name=${displayUsername}&background=random`,
            content: text,
            likes: 0,
            parentId: replyingToId, // เก็บ ID ของคอมเมนต์หลัก ถ้ามี
            createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, "novels", novelId, "episodes", currentEpisodeDocId, "comments"), commentData);

        // --- ระบบแจ้งเตือน (แก้บั๊กแล้ว) ---
        // กำหนดผู้รับ: ถ้าไม่มี authorId ในนิยาย ให้ส่งหา admin แทน
        const targetUserId = novelData.authorId || 'admin'; 
        
        if (targetUserId !== currentUser.uid) { 
             await addDoc(collection(db, "notifications"), {
                to: targetUserId,
                type: 'comment',
                title: `ความคิดเห็นใหม่จาก ${commentData.username}`,
                message: `ตอนที่ ${episodeNumber}: "${text.substring(0, 30)}..."`,
                link: window.location.href, // ลิงก์สำหรับกดเพื่อเข้ามาดูคอมเมนต์
                isRead: false,
                createdAt: serverTimestamp()
            });
        }

        input.value = '';
        replyingToId = null; // รีเซ็ตสถานะ Reply
        input.placeholder = "แสดงความคิดเห็นเกี่ยวกับตอนนี้...";
        showToast('success', 'คอมเมนต์เรียบร้อย');
        
        loadComments(); // โหลดคอมเมนต์ใหม่

    } catch (e) { 
        console.error("Post Comment Error:", e);
        Swal.fire('Error', 'ส่งคอมเมนต์ไม่สำเร็จ', 'error');
    }
};

// ฟังก์ชันใหม่สำหรับกด Like
window.likeComment = async (commentId) => {
    if (!currentUser) return showToast('warning', 'กรุณาเข้าสู่ระบบเพื่อกดถูกใจ');
    try {
        const commentRef = doc(db, "novels", novelId, "episodes", currentEpisodeDocId, "comments", commentId);
        await updateDoc(commentRef, {
            likes: increment(1)
        });
        loadComments(); // โหลดใหม่เพื่อโชว์ยอดไลก์
    } catch (e) {
        console.error("Like Error:", e);
        showToast('error', 'กดถูกใจไม่สำเร็จ');
    }
};

window.prepareReply = (commentId, username) => {
    replyingToId = commentId; // จำ ID คอมเมนต์หลักไว้
    const input = document.getElementById('commentInput');
    input.value = `@${username} `;
    input.placeholder = `ตอบกลับ ${username}... (ลบข้อความเพื่อยกเลิกการตอบกลับ)`;
    input.focus();
    
    // ถ้ายูสเซอร์ลบข้อความจนหมด ให้ยกเลิกการ Reply
    input.oninput = () => {
        if (input.value.trim() === '') {
            replyingToId = null;
            input.placeholder = "แสดงความคิดเห็นเกี่ยวกับตอนนี้...";
        }
    };
}

async function loadComments() {
    const list = document.getElementById('commentsList');
    if (!currentEpisodeDocId) {
        list.innerHTML = '<p class="text-center text-gray-400">No comments available</p>';
        return;
    }
    try {
        const commentsRef = collection(db, "novels", novelId, "episodes", currentEpisodeDocId, "comments");
        const q = query(commentsRef, orderBy("createdAt", "asc")); // เรียงจากเก่าไปใหม่ เพื่อให้ Reply เรียงถูกต้อง
        const snapshot = await getDocs(q);
        
        document.getElementById('commentCount').innerText = snapshot.size;
        
        if (snapshot.empty) {
            list.innerHTML = '<p class="text-center text-gray-400">ยังไม่มีความคิดเห็น เป็นคนแรกสิ!</p>';
            return;
        }

        const allComments = [];
        snapshot.forEach(doc => allComments.push({ id: doc.id, ...doc.data() }));

        // แยกคอมเมนต์หลัก และ Reply ออกจากกัน
        const parentComments = allComments.filter(c => !c.parentId);
        const childComments = allComments.filter(c => c.parentId);

        let html = '';
        
        // ฟังก์ชันช่วยสร้าง HTML การ์ดคอมเมนต์
        const renderCommentCard = (c, isReply = false) => {
            const time = c.createdAt ? new Date(c.createdAt.toDate()).toLocaleString('th-TH') : 'Just now';
            const username = escapeHtml(c.username || 'User');
            const content = escapeHtml(c.content || '');
            const avatar = c.avatar ? safeUrl(c.avatar) : '';
            const initial = username.charAt(0).toUpperCase();
            const bgClass = isReply ? 'bg-white dark:bg-gray-800 border-l-4 border-pastel-pink' : 'bg-gray-50 dark:bg-gray-700/50';
            
            return `
            <div class="flex gap-4 p-4 ${bgClass} rounded-xl border border-gray-100 dark:border-gray-700 w-full">
                <div class="w-10 h-10 min-w-[40px] rounded-full bg-pastel-purple flex items-center justify-center text-white font-bold text-sm overflow-hidden shadow-sm">
                    ${avatar ? `<img src="${avatar}" class="w-full h-full object-cover">` : initial}
                </div>
                <div class="flex-grow overflow-hidden">
                    <div class="flex justify-between items-start">
                        <span class="font-bold text-gray-800 dark:text-gray-200">${username}</span>
                        <span class="text-xs text-gray-400 whitespace-nowrap ml-2">${time}</span>
                    </div>
                    <p class="text-gray-600 dark:text-gray-300 mt-1 font-saraban break-words">${content}</p>
                    
                    <div class="flex gap-4 mt-3 text-xs font-bold text-gray-400">
                        <button onclick="likeComment('${c.id}')" class="hover:text-pastel-pink flex items-center gap-1 transition-colors">
                            <i class="far fa-heart"></i> ${c.likes || 0}
                        </button>
                        ${!isReply ? `<button class="hover:text-pastel-purple transition-colors" onclick="prepareReply('${c.id}', '${username}')"><i class="fas fa-reply mr-1"></i> Reply</button>` : ''}
                    </div>
                </div>
            </div>
            `;
        };

        // วนลูปแสดงคอมเมนต์หลักแบบกลับด้าน (ใหม่สุดอยู่บน)
        parentComments.reverse().forEach(parent => {
            html += renderCommentCard(parent, false);
            
            // หา Reply ที่เป็นลูกของคอมเมนต์นี้
            const replies = childComments.filter(child => child.parentId === parent.id);
            if (replies.length > 0) {
		html += `<div class="ml-10 md:ml-14 mt-2 mb-4 space-y-2 flex flex-col">`;
                //html += `<div class="ml-8 md:ml-12 mt-2 mb-4 space-y-2 flex flex-col items-end">`;
                // แสดง Reply เรียงตามเวลา (เก่าไปใหม่)
                replies.forEach(reply => {
                    html += renderCommentCard(reply, true);
                });
                html += `</div>`;
            } else {
                html += `<div class="mb-4"></div>`; // เว้นระยะถ้าไม่มี reply
            }
        });
        
        list.innerHTML = html;

    } catch (error) {
        console.error("Load Comments Error:", error);
        list.innerHTML = '<p class="text-center text-red-400">โหลดความคิดเห็นไม่สำเร็จ</p>';
    }
}

function setupCopyProtection() {
    const contentArea = document.getElementById('novel-content');
    if (!contentArea) return;

    // 1. บล็อคคลิกขวา (Context Menu) เฉพาะในพื้นที่เนื้อหานิยาย
    contentArea.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // สามารถเรียกใช้ showToast('warning', 'ไม่อนุญาตให้คลิกขวาค่ะ/ครับ'); ตรงนี้ได้
    });

    // 2. บล็อคคีย์ลัด (Ctrl+C, Ctrl+A, Cmd+C, Cmd+A, Ctrl+X) ทั่วทั้งหน้าจอ
    document.addEventListener('keydown', (e) => {
        // สำคัญ: ยกเว้นให้ใช้งานคีย์ลัดได้หากกำลังพิมพ์ในช่องคอมเมนต์ (Input/Textarea)
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        if (isInput) return;

        // รองรับทั้ง Windows (Ctrl) และ Mac (Cmd)
        const cmdKey = e.ctrlKey || e.metaKey; 

        if (cmdKey && (e.key === 'c' || e.key === 'C' || e.key === 'a' || e.key === 'A' || e.key === 'x' || e.key === 'X')) {
            e.preventDefault();
            // showToast('warning', 'ไม่อนุญาตให้ใช้คีย์ลัดเพื่อคัดลอกค่ะ/ครับ');
        }
    });

    // 3. Copy Hijack (ดักจับการ Copy และแทรกข้อความอื่นลงใน Clipboard แทน)
    contentArea.addEventListener('copy', (e) => {
        e.preventDefault(); // ยกเลิกการคัดลอกข้อความจริง
        
        // ใส่ข้อความขยะหรือคำเตือนลงไปแทน
        const warningMessage = "สงวนลิขสิทธิ์ ไม่อนุญาตให้คัดลอกเนื้อหานิยายจาก LinguaVerse";
        
        if (e.clipboardData) {
            e.clipboardData.setData('text/plain', warningMessage);
        } else if (window.clipboardData) {
            window.clipboardData.setData('Text', warningMessage);
        }
    });
}
