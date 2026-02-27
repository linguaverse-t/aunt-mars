import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/src/sweetalert2.js';

export const showToast = (icon, title) => {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    })
      
    Toast.fire({
        icon: icon,
        title: title
    })
};

export const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ฟังก์ชันจำลองการส่งลิงค์ไปยัง Placeholder
export const linkTo = (pageName) => {
    window.location.href = `placeholder.html?page=${encodeURIComponent(pageName)}`;
};

// ใน js/utils.js หรือ script ท้ายหน้า
export function setupScrollToTop() {
    const scrollBtn = document.getElementById('scrollToTopBtn');
    if (!scrollBtn) return;
    
    // เปลี่ยน logic การตรวจสอบ scroll เล็กน้อยเพื่อให้แม่นยำขึ้น
    window.addEventListener('scroll', () => {
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            scrollBtn.classList.remove('hidden', 'opacity-0', 'translate-y-10');
        } else {
            scrollBtn.classList.add('opacity-0', 'translate-y-10');
            // รอ Animation จบแล้วค่อยซ่อน
            setTimeout(() => {
                if(document.body.scrollTop <= 300 && document.documentElement.scrollTop <= 300) {
                    scrollBtn.classList.add('hidden');
                }
            }, 300);
        }
    });
    
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}