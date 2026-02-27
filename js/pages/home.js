import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db } from '../services/firebase.js';
import { collection, getDocs, query, where, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ฟังก์ชันหลักที่จะทำงานเมื่อโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Render UI ส่วนกลาง (Navbar/Footer)
        renderNavbar();
        renderFooter();
        setupScrollToTop();

        // 2. ดึงข้อมูลนิยาย
        await fetchNovels();

	//3. Fetch Latest Updates
        await loadLatestUpdates();

    } catch (error) {
        console.error("Critical Error:", error);
        // กรณีพังทั้งหมด ให้แสดงข้อความเตือน
        document.getElementById('novel-list').innerHTML = `
            <div class="col-span-full text-center py-10 text-red-400">
                <i class="fas fa-exclamation-triangle text-4xl mb-2"></i><br>
                เกิดข้อผิดพลาดในการโหลดเว็บไซต์<br>
                <span class="text-xs text-gray-500">${error.message}</span>
            </div>
        `;
    }
});

// ฟังก์ชันดึงข้อมูลนิยายจาก Firestore
async function fetchNovels() {
    const novelContainer = document.getElementById('novel-list');
    
    try {
        // สร้าง Query: เลือก Collection 'novels' ที่ isPublished เป็น true
        // เรียงตาม updateAt ล่าสุด (ถ้ายังไม่ได้ทำ index อาจจะต้องเอา orderBy ออกก่อน หรือคลิกลิงก์ใน Console เพื่อสร้าง Index)
        const novelsRef = collection(db, "novels");
        const q = query(
            novelsRef, 
            where("isPublished", "==", true),
	    orderBy("createdAt", "desc"), 
            limit(8) 
            // orderBy("updateAt", "desc") // **เปิดใช้บรรทัดนี้เมื่อสร้าง Index ใน Firebase แล้ว**
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            novelContainer.innerHTML = `
                <div class="col-span-full text-center py-20">
                    <p class="text-xl text-gray-400 font-mali">ยังไม่มีนิยายในขณะนี้</p>
                </div>
            `;
            return;
        }

        // เคลียร์ Loading... ออก
        novelContainer.innerHTML = '';

        // วนลูปสร้าง Card
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            novelContainer.innerHTML += createNovelCard(doc.id, data);
        });

    } catch (error) {
        console.error("Error fetching novels:", error);
        novelContainer.innerHTML = `
            <div class="col-span-full text-center py-10 text-gray-500">
                ไม่สามารถโหลดข้อมูลนิยายได้ <br> (${error.message})
            </div>
        `;
    }
}

// [INSERT] Function to load Latest Updates based on latestUpdatedAt
async function loadLatestUpdates() {
    const container = document.getElementById('latest-updates-list');
    if (!container) return;

    try {
        const novelsRef = collection(db, "novels");
        const q = query(
            novelsRef,
            where("isPublished", "==", true),
            orderBy("latestUpdatedAt", "desc"),
            limit(8)
        );
        
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            container.innerHTML = `
                <div class="col-span-full text-center py-10 text-gray-400 font-mali">
                    ยังไม่มีการอัพเดทนิยายในขณะนี้
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Reuse existing createNovelCard function
            container.innerHTML += createNovelCard(doc.id, data);
        });

    } catch (error) {
        console.error("Error fetching latest updates:", error);
        container.innerHTML = `
            <div class="col-span-full text-center py-10 text-red-400">
                ไม่สามารถโหลดข้อมูลอัพเดทล่าสุดได้ <br> (${error.message})<br>
                <span class="text-xs">กรุณาตรวจสอบ Console (F12) เพื่อสร้าง Index ใน Firebase หากเพิ่งใช้งาน query นี้ครั้งแรก</span>
            </div>
        `;
    }
}

// ฟังก์ชันสร้าง HTML ของการ์ดนิยาย
function createNovelCard(id, data) {
    // ตรวจสอบรูปภาพ ถ้าไม่มีให้ใช้ Placeholder
    const coverImage = data.coverUrl || 'https://via.placeholder.com/300x450/D8B4FE/ffffff?text=No+Cover';
    
    return `
    <div class="bg-white rounded-2xl shadow-md hover:shadow-xl transition duration-300 overflow-hidden group border border-gray-100 cursor-pointer h-full flex flex-col" onclick="window.location.href='novel-detail.html?page=NovelDetail&id=${id}'">
        <div class="relative overflow-hidden aspect-[2/3] w-full">
            <img src="${coverImage}" alt="${data.titleEN}" class="w-full h-full object-cover transition duration-500 group-hover:scale-110">
            
            <div class="absolute top-2 right-2 bg-pastel-purple/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm">
                ${data.status || 'Unknown'}
            </div>

            ${data.isAdult ? '<div class="absolute top-2 left-2 bg-red-400/90 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm">18+</div>' : ''}
        </div>
        
        <div class="p-4 flex flex-col flex-grow">
            <h3 class="font-bold text-lg text-gray-800 line-clamp-1 mb-1 group-hover:text-pastel-purple transition font-mali">
                ${data.titleTH || data.titleEN || 'No Title'}
            </h3>
            
            <p class="text-sm text-gray-500 mb-3 line-clamp-1 font-saraban">
                ${data.titleEN || '-'}
            </p>
            
            <div class="mt-auto flex justify-between items-center text-xs text-gray-500 border-t border-gray-100 pt-3">
                <div class="flex gap-3">
                    <span class="flex items-center" title="ยอดวิว"><i class="fas fa-eye mr-1 text-pastel-blue"></i> ${data.viewCount || 0}</span>
                    <span class="flex items-center" title="จำนวนตอน"><i class="fas fa-list mr-1 text-pastel-purple"></i> ${data.totalEpisodes || 0}</span>
                </div>
                <span class="flex items-center text-yellow-400 font-bold" title="คะแนน"><i class="fas fa-star mr-1"></i> ${data.rating || 0}</span>
            </div>
        </div>
    </div>
    `;
}

// Setup Scroll To Top
function setupScrollToTop() {
    const scrollBtn = document.getElementById('scrollToTopBtn');
    if(!scrollBtn) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollBtn.classList.remove('hidden', 'opacity-0', 'translate-y-10');
        } else {
            scrollBtn.classList.add('opacity-0', 'translate-y-10');
            setTimeout(() => scrollBtn.classList.add('hidden'), 300);
        }
    });
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}