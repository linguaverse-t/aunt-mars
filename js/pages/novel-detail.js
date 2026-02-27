import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db, auth } from '../services/firebase.js';
import { doc, getDoc, collection, query, where, orderBy, getDocs, updateDoc, increment, arrayUnion, arrayRemove, addDoc, serverTimestamp, runTransaction, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { setupScrollToTop, showToast } from '../utils.js';
import { showAuthModal } from '../components/auth-modal.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/src/sweetalert2.js';

let currentNovelId = null;
let currentNovelData = null;
let currentUser = null;
let currentUserRole = 'user';
let userUnlockedEpisodes = [];
let userFavorites = [];
const FREE_MODE = false;

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeUrl = (value, fallback = 'https://placehold.co/300x450?text=No+Cover') => {
    try {
        const url = new URL(String(value || ''), window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
        return fallback;
    } catch {
        return fallback;
    }
};

// --- ตัวแปรสำหรับระบบ Load More แบบใหม่ (High Performance) ---
//const EPISODES_PER_BATCH = 30;
//const QUERY_TIMEOUT_MS = 12000;
//const MAX_RETRY = 2;
//const RETRY_BACKOFF_MS = 700;
//const CACHE_TTL_MS = 3 * 60 * 1000;

//const EPISODE_STATE = Object.freeze({
    //IDLE: 'idle',
    //LOADING: 'loading',
    //RETRYING: 'retrying',
    //EXHAUSTED: 'exhausted',
    //ERROR: 'error'
//});

//let lastVisibleDoc = null;
//let isSortAscending = true;
//let episodeState = EPISODE_STATE.IDLE;
//let episodesObserver = null;
//let requestVersion = 0;
//let episodesBuffer = [];

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();
    setupScrollToTop();

    const urlParams = new URLSearchParams(window.location.search);
    currentNovelId = urlParams.get('id');

    if (!currentNovelId) {
        window.location.href = 'library.html';
        return;
    }

    loadNovelDetails(currentNovelId);

    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (currentUser) {
            try {
                const userSnap = await getDoc(doc(db, "users", currentUser.uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    userUnlockedEpisodes = userData.unlockedEpisodes || [];
                    userFavorites = userData.favorites || []; // [ADD]
                    currentUserRole = userData.role || 'user';
                    
                    // [ADD] อัปเดตสีปุ่มถูกใจทันทีหากผู้ใช้เคยถูกใจนิยายเรื่องนี้แล้ว
                    const likeBtnEl = document.getElementById('likeBtn');
                    if (likeBtnEl && currentNovelId && userFavorites.includes(currentNovelId)) {
                        likeBtnEl.classList.remove('bg-white', 'text-pastel-pink');
                        likeBtnEl.classList.add('bg-pastel-pink', 'text-white');
                    }
                }
            } catch (e) { console.error("User fetch error", e); }
            if (currentNovelData) {
                setupEpisodesSystem();
            }
        } else {
            currentUserRole = 'user';
            if (currentNovelData) {
                setupEpisodesSystem();
            }
        }
    });
});

async function loadNovelDetails(id) {
    try {
        const docRef = doc(db, "novels", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            Swal.fire('ไม่พบนิยาย', 'นิยายเรื่องนี้อาจถูกลบไปแล้ว', 'error').then(() => window.location.href = 'library.html');
            return;
        }

        currentNovelData = docSnap.data();
        renderNovelInfo(currentNovelData);
        loadOtherWorks(currentNovelData.author);

    } catch (error) { console.error("Error:", error); }
}

function renderNovelInfo(data) {
    document.title = `${data.titleTH} - LinguaVerse`;
    const coverUrl = (data.coverUrl && data.coverUrl.startsWith('http')) ? data.coverUrl : 'https://placehold.co/300x450?text=No+Cover';
    document.getElementById('novelCover').src = coverUrl;

    if(data.isAdult) document.getElementById('adultBadge').classList.remove('hidden');
    if(data.hasLicense) document.getElementById('licenseBadge').classList.remove('hidden');
    
    document.getElementById('titleEN').innerText = data.titleEN || 'No Title';
    document.getElementById('titleTH').innerText = data.titleTH || 'ไม่มีชื่อไทย';
    document.getElementById('authorName').innerText = data.author || 'Unknown';
    document.getElementById('novelLang').innerText = data.language || 'EN';
    document.getElementById('viewCount').innerText = (data.viewCount || 0).toLocaleString();
    document.getElementById('likeCount').innerText = (data.likeCount || 0).toLocaleString();
    
    const publishStateEl = document.getElementById('novelStatus');
    const novelPublishState = data.publishStatus || 'published';
    publishStateEl.innerText = novelPublishState;
    publishStateEl.className = `px-2 py-0.5 rounded text-xs font-bold text-white shadow-sm ${getPublishStateColor(novelPublishState)}`;

    const genreContainer = document.getElementById('genreList');
    genreContainer.innerHTML = (data.genres || []).map(g => 
        `<span class="bg-white border border-pastel-purple text-brand-dark px-3 py-1 rounded-full text-xs hover:bg-pastel-purple hover:text-white transition cursor-default">${escapeHtml(g)}</span>`
    ).join('');

    const synopsisContent = document.getElementById('synopsisContent');
    const cleanHtml = DOMPurify.sanitize(data.description || '');
    synopsisContent.innerHTML = cleanHtml;
    
    const toggleBtn = document.getElementById('toggleSynopsisBtn');
    const fade = document.getElementById('synopsisFade');

    if (synopsisContent.scrollHeight > 128) {
        toggleBtn.classList.remove('hidden');
        toggleBtn.addEventListener('click', () => {
            const isExpanded = synopsisContent.classList.contains('max-h-32');
            if (isExpanded) {
                synopsisContent.classList.remove('max-h-32', 'overflow-hidden');
                fade.classList.add('hidden');
                toggleBtn.innerHTML = `แสดงน้อยลง <i class="fas fa-chevron-up ml-1"></i>`;
            } else {
                synopsisContent.classList.add('max-h-32', 'overflow-hidden');
                fade.classList.remove('hidden');
                toggleBtn.innerHTML = `แสดงเพิ่มเติม <i class="fas fa-chevron-down ml-1"></i>`;
                document.getElementById('synopsisContent').scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    } else {
        fade.classList.add('hidden');
    }

    const likeBtn = document.getElementById('likeBtn');
    const newLikeBtn = likeBtn.cloneNode(true);
    likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);
    
    // [ADD] ฟังก์ชันสลับสีปุ่มเมื่อกดถูกใจ
    const toggleLikeUI = (isLiked) => {
        if (isLiked) {
            newLikeBtn.classList.remove('bg-white', 'text-pastel-pink');
            newLikeBtn.classList.add('bg-pastel-pink', 'text-white');
        } else {
            newLikeBtn.classList.remove('bg-pastel-pink', 'text-white');
            newLikeBtn.classList.add('bg-white', 'text-pastel-pink');
        }
    };

    // เซ็ตสีปุ่มครั้งแรกกรณีที่โหลดข้อมูลผู้ใช้มาเสร็จก่อนแล้ว
    toggleLikeUI(userFavorites.includes(currentNovelId));
    
    newLikeBtn.addEventListener('click', async () => {
        if(!currentUser) return Swal.fire('กรุณาเข้าสู่ระบบ', 'เพื่อกดถูกใจนิยายเรื่องนี้', 'warning');
        
        try {
            newLikeBtn.classList.add('scale-110');
            setTimeout(() => newLikeBtn.classList.remove('scale-110'), 200);
            
            const countEl = document.getElementById('likeCount');
            let currentCount = parseInt(countEl.innerText.replace(/,/g, '')) || 0;
            const isLiked = userFavorites.includes(currentNovelId);
            
            if (isLiked) {
                // กรณี "เลิกถูกใจ" (ลบข้อมูล)
                userFavorites = userFavorites.filter(id => id !== currentNovelId);
                countEl.innerText = Math.max(0, currentCount - 1).toLocaleString();
                toggleLikeUI(false); // เปลี่ยนปุ่มเป็นสีขาว
                
                // 1. ลดจำนวนไลก์ใน collection: novels
                await updateDoc(doc(db, "novels", currentNovelId), { likeCount: increment(-1) });
                // 2. ลบ ID นิยายออกจาก favorites ใน collection: users
                await updateDoc(doc(db, "users", currentUser.uid), { favorites: arrayRemove(currentNovelId) });
            } else {
                // กรณี "ถูกใจ" (เพิ่มข้อมูล)
                userFavorites.push(currentNovelId);
                countEl.innerText = (currentCount + 1).toLocaleString();
                toggleLikeUI(true); // เปลี่ยนปุ่มเป็นสีชมพู
                
                // 1. เพิ่มจำนวนไลก์ใน collection: novels
                await updateDoc(doc(db, "novels", currentNovelId), { likeCount: increment(1) });
                // 2. บันทึก ID นิยายเข้า favorites ใน collection: users
                await updateDoc(doc(db, "users", currentUser.uid), { favorites: arrayUnion(currentNovelId) });
            }
        } catch(e) { 
            console.error(e); 
            Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง', 'error');
        }
    });
}

async function loadOtherWorks(authorName) {
    if (!authorName) return;
    const container = document.getElementById('otherWorksList');
    try {
        const q = query(collection(db, "novels"), where("author", "==", authorName), where("isPublished", "==", true));
        const snapshot = await getDocs(q);
        const otherNovels = snapshot.docs.filter(d => d.id !== currentNovelId).map(d => ({id: d.id, ...d.data()}));
        
        if (otherNovels.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-400 text-sm py-4">ไม่มีผลงานอื่น</div>`;
            return;
        }
        
        container.innerHTML = otherNovels.map(n => `
            <a href="novel-detail.html?id=${n.id}" class="flex gap-3 items-center group bg-gray-50 p-2 rounded-xl hover:bg-pastel-bg border border-transparent hover:border-pastel-pink transition">
                <img src="${safeUrl(n.coverUrl)}" class="w-12 h-16 object-cover rounded shadow-sm group-hover:scale-105 transition">
                <div>
                    <h4 class="font-bold text-sm text-gray-700 group-hover:text-brand-dark line-clamp-1">${escapeHtml(n.titleEN)}</h4>
                    <p class="text-xs text-gray-500 line-clamp-1">${escapeHtml(n.titleTH)}</p>
                </div>
            </a>
        `).join('');
    } catch (error) { console.error(error); }
}

// =========================================================
// 🚀 ระบบ Episodes แบบ Search + Pagination
// =========================================================

let allEpisodes = [];
let filteredEpisodes = [];
let currentPage = 1;
const EPISODES_PER_PAGE = 30;
let isSortAscending = true;

async function setupEpisodesSystem() {
    isSortAscending = true;
    allEpisodes = [];
    
    const sortBtn = document.getElementById('sortEpisodesBtn');
    if (sortBtn) {
        updateSortButtonUI();
        const newBtn = sortBtn.cloneNode(true);
        sortBtn.parentNode.replaceChild(newBtn, sortBtn);
        newBtn.addEventListener('click', toggleSortOrder);
    }

    const searchInput = document.getElementById('searchEpisodeInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleSearch(e.target.value);
        });
    }

    const listContainer = document.getElementById('episodeList');
    listContainer.removeEventListener('click', handleEpisodeListClick);
    listContainer.addEventListener('click', handleEpisodeListClick);

    await fetchAllEpisodes();
}

function updateSortButtonUI() {
    const sortIcon = document.getElementById('sortIcon');
    const sortText = document.getElementById('sortText');
    if(sortText && sortIcon) {
        if (isSortAscending) {
            sortText.innerText = "เรียงจากตอนที่หนึ่ง";
            sortIcon.className = "fas fa-sort-numeric-down text-pastel-purple group-hover:text-white";
        } else {
            sortText.innerText = "เรียงจากตอนล่าสุด";
            sortIcon.className = "fas fa-sort-numeric-up-alt text-pastel-purple group-hover:text-white";
        }
    }
}

function toggleSortOrder() {
    isSortAscending = !isSortAscending;
    updateSortButtonUI();
    
    allEpisodes.reverse();
    applyFiltersAndRender();
}

async function fetchAllEpisodes() {
    setInitialLoading(true, 'กำลังโหลดสารบัญ...');
    try {
        const epRef = collection(db, 'novels', currentNovelId, 'episodes');
        const isAdminOrWriter = ['admin', 'writer'].includes(currentUserRole);
        
        let q = isAdminOrWriter
            ? query(epRef, orderBy('episodeNumber', 'asc'))
            : query(epRef, where('isPublished', '==', true), orderBy('episodeNumber', 'asc'));

        const snapshot = await getDocs(q);
        allEpisodes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        
        applyFiltersAndRender();
    } catch (error) {
        console.error("Error fetching episodes:", error);
        document.getElementById('episodeList').innerHTML = `<div class="text-center py-10 text-red-400">เกิดข้อผิดพลาดในการโหลดสารบัญ</div>`;
    } finally {
        setInitialLoading(false);
    }
}

function handleSearch(term) {
    applyFiltersAndRender(term);
}

function applyFiltersAndRender(searchTerm = document.getElementById('searchEpisodeInput')?.value || '') {
    const term = searchTerm.toLowerCase().trim();
    
    if (term) {
        filteredEpisodes = allEpisodes.filter(ep => {
            const title = String(ep.title || '').toLowerCase();
            const epNum = String(ep.episodeNumber || '');
            return title.includes(term) || epNum.includes(term);
        });
    } else {
        filteredEpisodes = [...allEpisodes];
    }
    
    currentPage = 1;
    renderCurrentPage();
}

function renderCurrentPage() {
    const listContainer = document.getElementById('episodeList');
    listContainer.innerHTML = ''; 
    
    if (filteredEpisodes.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-10 text-gray-400">ไม่พบตอนที่ค้นหา</div>`;
        renderPaginationUI(0, 0, 0);
        return;
    }

    const startIndex = (currentPage - 1) * EPISODES_PER_PAGE;
    const endIndex = startIndex + EPISODES_PER_PAGE;
    const episodesToRender = filteredEpisodes.slice(startIndex, endIndex);

    renderEpisodesList(episodesToRender);
    renderPaginationUI(filteredEpisodes.length, startIndex, endIndex);
}

function setInitialLoading(show, message = 'Loading...') {
    const initialLoading = document.getElementById('initialLoading');
    if (!initialLoading) return;
    if (show) {
        initialLoading.classList.remove('hidden');
        initialLoading.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>${message}`;
    } else {
        initialLoading.classList.add('hidden');
    }
}

function renderPaginationUI(total, start, end) {
    const container = document.getElementById('paginationContainer');
    if (!container) return;
    
    if (total === 0 || total <= EPISODES_PER_PAGE) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    const totalPages = Math.ceil(total / EPISODES_PER_PAGE);
    const displayEnd = Math.min(end, total);
    
    let html = `
        <div class="text-sm text-gray-500 font-saraban order-2 sm:order-1 text-center sm:text-left">
            ${start + 1}–${displayEnd} จาก ${total} ตอน
        </div>
        <div class="flex items-center gap-2 order-1 sm:order-2 flex-wrap justify-center">
            <button onclick="changeEpisodePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-full text-sm font-saraban ${currentPage === 1 ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-pastel-purple hover:bg-pastel-purple/10 border border-pastel-purple/30'} transition">&lt; ก่อนหน้า</button>
    `;
    
    let pages = [];
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        if (currentPage <= 3) {
            pages = [1, 2, 3, 4, '...', totalPages];
        } else if (currentPage >= totalPages - 2) {
            pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
        }
    }
    
    pages.forEach(p => {
        if (p === '...') {
            html += `<span class="text-gray-400 px-1">...</span>`;
        } else if (p === currentPage) {
            html += `<button class="w-8 h-8 rounded-full bg-gradient-to-r from-pastel-pink to-pastel-purple text-white font-bold text-sm shadow-sm">${p}</button>`;
        } else {
            html += `<button onclick="changeEpisodePage(${p})" class="w-8 h-8 rounded-full text-gray-600 hover:bg-pastel-purple/10 border border-gray-200 text-sm transition">${p}</button>`;
        }
    });
    
    html += `
            <button onclick="changeEpisodePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-full text-sm font-saraban ${currentPage === totalPages ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-pastel-purple hover:bg-pastel-purple/10 border border-pastel-purple/30'} transition">ถัดไป &gt;</button>
        </div>
    `;
    
    container.innerHTML = html;
}

window.changeEpisodePage = (page) => {
    const totalPages = Math.ceil(filteredEpisodes.length / EPISODES_PER_PAGE);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderCurrentPage();
        
        const searchInput = document.getElementById('searchEpisodeInput');
        if(searchInput) searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

function renderEpisodesList(episodesToRender) {
    const listContainer = document.getElementById('episodeList');
    if (!episodesToRender || episodesToRender.length === 0) return;

    const isAdminOrWriter = ['admin', 'writer'].includes(currentUserRole);
    const unlockedSet = new Set(userUnlockedEpisodes); 
    let html = '';
    episodesToRender.forEach(ep => {
        const price = ep.requiredPoints || 0;
        const isFree = price === 0 || ep.accessType === 'free';
        const showEpisode = ep.isPublished === true;
        const isWaitingPublish = false;

        if (!showEpisode) return;

        // ดึงวันที่จาก publishAt เป็นหลัก หากไม่มีให้ใช้ createdAt แทน
        const timestamp = ep.publishAt || ep.createdAt;
        const publishDate = timestamp?.toDate ? timestamp.toDate() : (timestamp ? new Date(timestamp) : null);
        const dateStr = publishDate instanceof Date && !Number.isNaN(publishDate.getTime())
            ? publishDate.toLocaleDateString('th-TH')
            : '-';

        const episodeKey = `${currentNovelId}_${ep.episodeNumber}`;
        const isUnlocked = unlockedSet.has(episodeKey);
        
        let buttonHtml = '';
        if (isWaitingPublish) {
            buttonHtml = `<span class="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-lg font-bold border border-amber-200">⏳รอเผยแพร่</span>`;
        } else if (isAdminOrWriter) {
            if(isFree) buttonHtml = `<span class="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-lg font-bold">ฟรี (Admin)</span>`;
            else buttonHtml = `<span class="flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-lg font-bold border border-purple-200"><i class="fas fa-coins"></i> ${price}</span>`;
        } else if (isFree) {
            buttonHtml = `<span class="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-lg font-bold">ฟรี</span>`;
        } else if (isUnlocked) {
            buttonHtml = `<span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-lg font-bold"><i class="fas fa-check"></i> Unlocked</span>`;
        } else {
            buttonHtml = `<span class="flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-lg font-bold"><i class="fas fa-coins"></i> ${price}</span>`;
        }

        html += `
        <div class="episode-item flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-pastel-purple hover:bg-pastel-bg/30 transition group cursor-pointer mb-2" 
           data-ep="${ep.episodeNumber}" data-price="${price}" data-free="${isFree}" data-waiting="${isWaitingPublish}">
            <div class="flex items-center gap-3">
                <span class="text-gray-400 text-sm font-mono w-10">#${ep.episodeNumber}</span>
                <div class="flex flex-col">
                    <span class="font-bold text-gray-700 group-hover:text-pastel-purple transition line-clamp-1">${escapeHtml(ep.title)}</span>
                    <span class="text-xs text-gray-400 font-saraban">
                        <i class="far fa-calendar-alt mr-1"></i> ${dateStr}
                        <span class="ml-3"><i class="fas fa-align-left mr-1"></i> ${(ep.wordCount || 0).toLocaleString()} คำ</span>
                    </span>
                </div>
            </div>
            <div class="flex items-center flex-shrink-0" id="btn-area-${ep.episodeNumber}">
                ${buttonHtml}
                <i class="fas fa-chevron-right text-gray-300 ml-3 group-hover:text-pastel-purple text-xs"></i>
            </div>
        </div>`;
    });
    if (!html) {
        if (!listContainer.children.length) {
            listContainer.innerHTML = `<div class="text-center py-10 text-gray-400">No published episodes yet.</div>`;
        }
        return;
    }
    listContainer.insertAdjacentHTML('beforeend', html);
}

function handleEpisodeListClick(e) {
    const item = e.target.closest('.episode-item');
    if (!item) return;
    const epNum = parseInt(item.dataset.ep);
    const price = parseInt(item.dataset.price);
    const isFree = item.dataset.free === 'true';
    const isWaitingPublish = item.dataset.waiting === 'true';
    const isAdminOrWriter = ['admin', 'writer'].includes(currentUserRole);

    if (isWaitingPublish && !isAdminOrWriter) return;

    const btnArea = item.querySelector('.fa-spin');
    if (btnArea) return;
    
    handleUnlockClick(epNum, price, isFree);
}

function handleUnlockClick(epNum, price, isFree) {
    const episodeKey = `${currentNovelId}_${epNum}`;
    const isUnlocked = userUnlockedEpisodes.includes(episodeKey);
    const isAdmin = ['admin', 'writer'].includes(currentUserRole);

    if (FREE_MODE || isFree || isUnlocked || isAdmin) {
        window.location.href = `read-episode.html?id=${currentNovelId}&ep=${epNum}`;
        return;
    }

    if (!currentUser) {
        Swal.fire({
            title: 'กรุณาเข้าสู่ระบบ',
            text: 'คุณต้องเข้าสู่ระบบเพื่อปลดล็อกตอนนี้นะคะ',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'เข้าสู่ระบบ',
            confirmButtonColor: '#D8B4FE',
            cancelButtonText: 'ยกเลิก'
        }).then((res) => { if(res.isConfirmed) showAuthModal('signin'); });
        return;
    }

    checkAndPay(epNum, price);
}

async function checkAndPay(epNum, price) {
    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", currentUser.uid);
            const userDoc = await transaction.get(userRef);
            
            if (!userDoc.exists()) throw "User not found";
            
            const userData = userDoc.data();
            const serverUnlocked = userData.unlockedEpisodes || [];
            const episodeKey = `${currentNovelId}_${epNum}`;

            if (serverUnlocked.includes(episodeKey)) throw "AlreadyPurchased";

            const currentPoints = userData.points || 0;
            if (currentPoints < price) throw "InsufficientPoints";

            transaction.update(userRef, {
                points: currentPoints - price,
                unlockedEpisodes: arrayUnion(episodeKey),
                readingHistory: arrayUnion(currentNovelId)
            });
        });

        showToast('success', 'ปลดล็อกเรียบร้อย');
        userUnlockedEpisodes.push(`${currentNovelId}_${epNum}`);
        
        const btnArea = document.getElementById(`btn-area-${epNum}`);
        if(btnArea) {
            btnArea.innerHTML = `<span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-lg font-bold"><i class="fas fa-check"></i> Unlocked</span> <i class="fas fa-chevron-right text-gray-300 ml-3 group-hover:text-pastel-purple text-xs"></i>`;
        }

        setTimeout(() => {
            window.location.href = `read-episode.html?id=${currentNovelId}&ep=${epNum}`;
        }, 500);

    } catch (e) {
        if (e === "AlreadyPurchased") {
            window.location.href = `read-episode.html?id=${currentNovelId}&ep=${epNum}`;
        } else if (e === "InsufficientPoints") {
            Swal.fire({
                title: 'พอยต์ไม่พอค่ะ 🥺',
                text: `ต้องการ ${price} Points`,
                icon: 'error',
                showCancelButton: true,
                confirmButtonText: 'เติมพอยต์',
                confirmButtonColor: '#A5F3FC'
            }).then((res) => { if(res.isConfirmed) window.location.href = 'topup.html'; });
        } else {
            console.error(e);
            Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + e, 'error');
        }
    }
}

window.triggerDonate = (amount, cupSize) => {
    if (!currentUser) return Swal.fire({ title: 'กรุณาเข้าสู่ระบบ', icon: 'info' });
    Swal.fire({
        title: `<span class="text-yellow-700 font-bold"><i class="fas fa-mug-hot"></i> เลี้ยงกาแฟ (${cupSize})</span>`,
        html: `
            <div class="flex flex-col items-center gap-4">
                <p class="text-gray-600 font-saraban">สแกน QR Code เพื่อสนับสนุน ${amount} บาท</p>
                <div class="bg-white p-2 rounded-xl shadow-inner border border-gray-200">
                    <img src="images/payment_qr.jpg" class="w-48 h-48 object-contain" onerror="this.src='https://via.placeholder.com/200?text=QR+Code'">
                </div>
                <textarea id="donateMsg" class="w-full border rounded-xl p-2 font-saraban focus:ring-2 focus:ring-yellow-300 outline-none" rows="2" placeholder="ฝากข้อความถึงนักเขียน..."></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'ส่งข้อความ',
        confirmButtonColor: '#FBBF24',
        preConfirm: () => document.getElementById('donateMsg').value
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await addDoc(collection(db, "notifications"), {
                    to: 'admin', 
                    type: 'coffee',
                    from: currentUser.displayName || 'Reader',
                    senderId: currentUser.uid, 
                    senderEmail: currentUser.email,
                    title: `ได้รับกาแฟ ${cupSize} (${amount}฿)`,
                    message: result.value || 'ขอเป็นกำลังใจให้นะคะ',
                    amount: amount,
                    isRead: false,
                    createdAt: serverTimestamp()
                });
                Swal.fire('ขอบคุณครับ!', 'ข้อความของคุณถูกส่งแล้ว', 'success');
            } catch(e) {
                console.error(e);
                Swal.fire('Error', 'ส่งข้อมูลไม่สำเร็จ', 'error');
            }
        }
    });
};

function getPublishStateColor(publishState) {
    switch (publishState) {
        case 'Ongoing': return 'bg-blue-400';
        case 'Completed': return 'bg-green-400';
        case 'Hiatus': return 'bg-orange-400';
        case 'Coming Soon': return 'bg-purple-400';
        case 'published': return 'bg-green-400';
        case 'scheduled': return 'bg-orange-400';
        case 'draft': return 'bg-gray-400';
        default: return 'bg-gray-400';
    }
}


