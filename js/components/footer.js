export const renderFooter = () => {
    const footer = document.getElementById('footer-container');
    footer.innerHTML = `
        <div class="bg-gradient-to-r from-purple-900 to-indigo-900 text-white pt-10 pb-6 mt-12 font-saraban">
            <div class="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                    <div class="flex items-center gap-2 mb-4">
                        <div class="w-8 h-8 bg-pastel-pink rounded-lg flex items-center justify-center text-purple-900 font-bold">L</div>
                        <h3 class="text-xl font-bold font-mali">LinguaVerse</h3>
                    </div>
                    <p class="text-gray-300 text-sm leading-relaxed">
                        Explore infinite worlds across languages. Your ultimate destination for web novels from around the globe.
                    </p>
                </div>

                <div>
                    <h4 class="font-bold text-lg mb-4 font-mali">Discover</h4>
                    <ul class="space-y-2 text-gray-300 text-sm">
                        <li><a href="#" class="hover:text-pastel-blue transition">New Arrivals</a></li>
                        <li><a href="#" class="hover:text-pastel-blue transition">Top Rated</a></li>
                        <li><a href="#" class="hover:text-pastel-blue transition">Completed</a></li>
                        <li><a href="#" class="hover:text-pastel-blue transition">Recommendations</a></li>
                    </ul>
                </div>

                <div>
                    <h4 class="font-bold text-lg mb-4 font-mali">Support</h4>
                    <ul class="space-y-2 text-gray-300 text-sm">
                        <li><a href="#" class="hover:text-pastel-blue transition">Help Center</a></li>
                        <li><a href="#" class="hover:text-pastel-blue transition">Writer Guidelines</a></li>
                        <li><a href="#" class="hover:text-pastel-blue transition">Terms of Service</a></li>
                        <li><a href="#" class="hover:text-pastel-blue transition">Privacy Policy</a></li>
                    </ul>
                </div>

                <div>
                    <h4 class="font-bold text-lg mb-4 font-mali">Connect</h4>
                    <div class="flex space-x-4">
                        <a href="https://www.facebook.com/groups/767597542267158?locale=th_TH" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-blue-500 transition duration-300 ease-in-out"><i class="fab fa-facebook-f"></i></a>
			<a href="https://lin.ee/5fdbMQ3" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-green-500 transition duration-300 ease-in-out"><i class="fa-brands fa-line"></i></a>
                        <a href="#" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-pastel-blue transition"><i class="fab fa-twitter"></i></a>
                        <a href="#" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-pink-500 transition duration-300 ease-in-out"><i class="fab fa-instagram"></i></a>
                        <a href="#" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-pastel-yellow transition"><i class="fas fa-envelope"></i></a>
                    </div>
                </div>
            </div>
            
            <div class="text-center text-gray-500 text-xs mt-10 border-t border-white/10 pt-6">
                &copy; 2026 LinguaVerse. All rights reserved.
            </div>
        </div>
    `;
};