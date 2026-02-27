import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db } from '../services/firebase.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global Variables สำหรับ Client-side Filter & Pagination
let allNovels = [];
let filteredNovels = [];
let currentPage = 1;
const itemsPerPage = 24;

document.addEventListener('DOMContentLoaded', async () => {
    renderNavbar();
    renderFooter();
    setupScrollToTop();

    // 1. Initial Load: ดึงข้อมูลทั้งหมดที่ isPublished = true
    await loadAllNovels();

    // 2. Setup Event Listeners สำหรับ Filter/Search
    setupFilterEvents();
});

async function loadAllNovels() {
    const grid = document.getElementById('library-grid');
    try {
        // ดึงข้อมูลครั้งเดียวแล้วมา Filter ใน JS เพื่อความ Modern และรวดเร็ว (รองรับการค้นหาหลายฟิลด์)
        const q = query(collection(db, "novels"), where("isPublished", "==", true), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        allNovels = [];
        querySnapshot.forEach(doc => {
            allNovels.push({ id: doc.id, ...doc.data() });
        });

        // เริ่มต้นแสดงผลทั้งหมด
        filteredNovels = [...allNovels];
        renderPage(1);

    } catch (error) {
        console.error("Error loading library:", error);
        grid.innerHTML = `<div class="col-span-full text-center text-red-400 py-10">เกิดข้อผิดพลาดในการโหลดข้อมูล (${error.message})</div>`;
    }
}

function setupFilterEvents() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const genreFilter = document.getElementById('genreFilter');
    const langFilter = document.getElementById('langFilter');
    const resetBtn = document.getElementById('resetFiltersBtn');

    const applyFilters = () => {
        const searchText = searchInput.value.toLowerCase().trim();
        const status = statusFilter.value;
        const genre = genreFilter.value;
        const lang = langFilter.value;

        filteredNovels = allNovels.filter(novel => {
            // 1. Search Text (ค้นหาใน EN, TH, Original Title)
            const matchText = !searchText || 
                (novel.titleEN && novel.titleEN.toLowerCase().includes(searchText)) ||
                (novel.titleTH && novel.titleTH.toLowerCase().includes(searchText)) ||
                (novel.originalTitle && novel.originalTitle.toLowerCase().includes(searchText));

            // 2. Status
            const matchStatus = !status || novel.status === status;

            // 3. Genre (Array check)
            const matchGenre = !genre || (novel.genres && novel.genres.includes(genre));

            // 4. Language
            const matchLang = !lang || novel.language === lang;

            return matchText && matchStatus && matchGenre && matchLang;
        });

        renderPage(1); // กลับไปหน้า 1 ทุกครั้งที่ Filter
    };

    // Events
    searchInput.addEventListener('input', applyFilters); // Real-time search
    statusFilter.addEventListener('change', applyFilters);
    genreFilter.addEventListener('change', applyFilters);
    langFilter.addEventListener('change', applyFilters);

    resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        statusFilter.value = '';
        genreFilter.value = '';
        langFilter.value = '';
        applyFilters();
    });
}

function renderPage(page) {
    currentPage = page;
    const grid = document.getElementById('library-grid');
    const pagination = document.getElementById('pagination');

    if (filteredNovels.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-400 py-20 font-mali text-lg">ไม่พบนิยายที่คุณค้นหา...ลองเปลี่ยนคำค้นหาดูนะ</div>`;
        pagination.classList.add('hidden');
        return;
    }

    // Pagination Slice
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const itemsToShow = filteredNovels.slice(start, end);

    // Render Grid
    grid.innerHTML = itemsToShow.map(novel => createLibraryCard(novel)).join('');

    // Render Pagination Buttons
    renderPaginationButtons(Math.ceil(filteredNovels.length / itemsPerPage));
}

function createLibraryCard(data) {
    const coverImage = data.coverUrl || 'https://via.placeholder.com/300x450/D8B4FE/ffffff?text=No+Cover';
    
    // Logic Badges
    const isNew = isDateWithinDays(data.createdAt, 7); // ใหม่ภายใน 7 วัน
    const isUp = isDateWithinDays(data.latestUpdatedAt, 3); // อัพเดทภายใน 3 วัน
    const isLicensed = data.hasLicense === true;

    return `
    <div class="bg-white rounded-2xl shadow-md hover:shadow-xl transition duration-300 overflow-hidden group border border-gray-100 cursor-pointer relative h-full flex flex-col" onclick="window.location.href='novel-detail.html?page=NovelDetail&id=${data.id}'">
        
        <div class="relative overflow-hidden aspect-[2/3] w-full">
            <img src="${coverImage}" alt="${data.titleEN}" class="w-full h-full object-cover transition duration-500 group-hover:scale-110">
            
            <div class="absolute top-2 right-2 bg-white/90 text-brand-dark text-xs font-bold px-2 py-1 rounded shadow border border-pastel-purple">
                ${data.language || 'EN'}
            </div>

            <div class="absolute top-2 left-2 flex flex-col gap-1 items-start">
                ${data.isAdult ? '<span class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">18+</span>' : ''}
                ${isNew ? '<span class="bg-pastel-green text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow animate-pulse">NEW</span>' : ''}
                ${isUp ? '<span class="bg-pastel-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">UP</span>' : ''}
            </div>

            ${isLicensed ? `
            <div class="absolute bottom-2 right-2 pointer-events-none">
                <span class="text-white text-xs font-bold drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] tracking-wide">
                    © Copyrighted
                </span>
            </div>` : ''}
        </div>
        
        <div class="p-3 flex flex-col flex-grow">
            <h3 class="font-bold text-base text-gray-800 line-clamp-1 group-hover:text-pastel-purple transition font-mali">
                <!${data.titleEN || 'No Title'}-->
		${data.titleTH || '-'}
            </h3>
            
            <p class="text-xs text-gray-500 mb-2 line-clamp-1 font-saraban">
                <!--${data.titleTH || '-'}-->
		${data.titleEN || 'No Title'}
            </p>
            
            <div class="mt-auto flex justify-between items-center text-xs text-gray-400 border-t border-gray-100 pt-2">
                <span class="${getStatusColor(data.status)} px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">${data.status}</span>
                <span class="flex items-center text-yellow-400 font-bold"><i class="fas fa-star mr-1"></i> ${data.rating || 0}</span>
            </div>
        </div>
    </div>
    `;
}

function renderPaginationButtons(totalPages) {
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
        pagination.classList.add('hidden');
        return;
    }
    pagination.classList.remove('hidden');

    let html = '';
    
    // Prev Button
    html += `<button onclick="window.changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled class="opacity-50 cursor-not-allowed px-3 py-1"' : 'class="px-3 py-1 hover:text-pastel-purple"'}><<</button>`;

    // Numbers (Simplified logic for demo)
    for (let i = 1; i <= totalPages; i++) {
        const activeClass = i === currentPage ? 'bg-pastel-purple text-white shadow-md transform scale-110' : 'bg-white text-gray-600 hover:bg-gray-100';
        html += `<button onclick="window.changePage(${i})" class="${activeClass} px-3 py-1 rounded-lg transition font-bold mx-0.5 w-8 h-8 flex items-center justify-center">${i}</button>`;
    }

    // Next Button
    html += `<button onclick="window.changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled class="opacity-50 cursor-not-allowed px-3 py-1"' : 'class="px-3 py-1 hover:text-pastel-purple"'}> >></button>`;

    pagination.innerHTML = html;
}

// Helper Functions
function isDateWithinDays(timestamp, days) {
    if (!timestamp) return false;
    const now = new Date();
    const date = timestamp.toDate(); // Firebase Timestamp to Date
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days;
}

function setupScrollToTop() {
    const scrollBtn = document.getElementById('scrollToTopBtn');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) scrollBtn.classList.remove('hidden', 'opacity-0', 'translate-y-10');
        else {
            scrollBtn.classList.add('opacity-0', 'translate-y-10');
            setTimeout(() => scrollBtn.classList.add('hidden'), 300);
        }
    });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// Expose function to window for pagination buttons
window.changePage = (page) => {
    renderPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Helper: เลือกสีตามสถานะ
function getStatusColor(status) {
    switch (status) {
        case 'Ongoing': return 'bg-blue-400 text-white';      // กำลังแปล - สีฟ้า
        case 'Completed': return 'bg-green-400 text-white';   // จบแล้ว - สีเขียว
        case 'Hiatus': return 'bg-orange-400 text-white';     // พักการแปล - สีส้ม
        case 'Coming Soon': return 'bg-purple-400 text-white';// เร็วๆ นี้ - สีม่วง
        default: return 'bg-gray-200 text-gray-600';          // อื่นๆ - สีเทา
    }
}