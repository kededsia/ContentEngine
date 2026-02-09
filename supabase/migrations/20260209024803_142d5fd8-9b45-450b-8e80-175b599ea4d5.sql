-- Tabel istilah slang komunitas motor
CREATE TABLE public.motor_slang (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term TEXT NOT NULL UNIQUE,
  meaning TEXT NOT NULL,
  example_usage TEXT,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabel tema kreatif (sejarah, tips, fakta unik)
CREATE TABLE public.creative_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  theme_type TEXT NOT NULL, -- 'sejarah', 'tips', 'fakta_unik', 'trivia'
  keywords TEXT[], -- untuk matching dengan produk
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert istilah slang komunitas motor
INSERT INTO public.motor_slang (term, meaning, example_usage, category) VALUES
('sarteng', 'Sarung tangan, aksesoris wajib rider', 'Beli sarteng dulu baru gas touring', 'aksesoris'),
('sarfull', 'Sarung full-body / jaket touring lengkap', 'Pakek sarfull biar aman kalo sliding', 'aksesoris'),
('leheran', 'Bagian leher knalpot yang connect ke mesin', 'Leheran Kenshi ini SS304 beneran', 'knalpot'),
('moncong', 'Ujung/tip knalpot bagian belakang', 'Moncong item sleek banget cuy', 'knalpot'),
('gacor', 'Suara knalpot yang enak/ngebass', 'Baru pasang langsung gacor parah', 'suara'),
('zonk', 'Barang/produk yang mengecewakan', 'Beli online zonk mulu, mending Kenshi', 'ekspresi'),
('sunmori', 'Sunday Morning Ride, riding bareng Minggu pagi', 'Sunmori besok gas yuk!', 'aktivitas'),
('kopdar', 'Kopi Darat, kumpul komunitas motor', 'Kopdar club PCX weekend ini', 'aktivitas'),
('turing', 'Touring, perjalanan jauh dengan motor', 'Turing ke Bromo pake Vario gue', 'aktivitas'),
('kopling', 'Clutch pada motor manual', 'Motor matic enak ga perlu kopling', 'teknis'),
('cc', 'Kapasitas mesin (cubic centimeter)', 'Stylo 160cc tenaganya galak', 'teknis'),
('bore up', 'Memperbesar kapasitas silinder mesin', 'Udah bore up tapi knalpot masih std', 'modifikasi'),
('harian', 'Motor untuk pemakaian sehari-hari', 'Knalpot ini cocok buat harian, adem', 'penggunaan'),
('cornering', 'Teknik menikung dengan sudut miring', 'Cornering enak, footstep ga nyenggol', 'teknik'),
('wheelie', 'Mengangkat roda depan saat riding', 'Jangan wheelie di jalan raya bro', 'teknik'),
('matic', 'Motor matik/automatic transmission', 'Matic sekarang CC gede semua', 'jenis'),
('bebek', 'Motor bebek/underbone', 'Dulu bebek sekarang upgrade matic', 'jenis'),
('ngebul', 'Knalpot mengeluarkan asap berlebih', 'Knalpot std ngebul, ganti Kenshi bersih', 'masalah'),
('brebet', 'Suara mesin yang tidak halus/tersedak', 'Abis pasang malah brebet, salah setting', 'masalah'),
('PNP', 'Plug and Play, langsung pasang tanpa modif', 'Kenshi PNP tinggal colok langsung jalan', 'fitur'),
('tilang', 'Ditilang polisi karena melanggar', 'Knalpot racing kena tilang mulu', 'hukum'),
('razia', 'Operasi penertiban kendaraan oleh polisi', 'Siap-siap razia akhir bulan', 'hukum'),
('std', 'Standar/bawaan pabrik', 'Suara std boring banget sih', 'kondisi'),
('cungkring', 'Knalpot yang kecil/tipis penampilannya', 'Knalpot cungkring malu-maluin', 'penampilan'),
('gahar', 'Tampilan yang sangar/agresif', 'Desain Kenshi gahar abis', 'penampilan'),
('nampol', 'Sangat bagus/memuaskan (slang)', 'Suaranya nampol banget anjir', 'ekspresi'),
('gas pol', 'Full throttle / kencang maksimal', 'Gas pol di tol suaranya mantep', 'aksi'),
('moge', 'Motor gede (big bike)', 'Suara Kenshi kaya moge padahal matic', 'jenis');

-- Insert tema kreatif
INSERT INTO public.creative_themes (title, content, theme_type, keywords) VALUES
-- Sejarah
('Asal Mula Istilah Sarteng', 'Tau ga sih kenapa disebut sarteng? Dulu rider jadul bilangnya sarung tangan, lama-lama disingkat jadi sarteng. Sama kayak knalpot Kenshi yang namanya dari pedang samurai - tajam, presisi, dan berkelas.', 'sejarah', ARRAY['sarteng', 'rider', 'sejarah']),
('Sejarah Knalpot Racing di Indonesia', 'Era 90an, knalpot racing cuma buat balap. Sekarang? Bisa daily tanpa takut tilang. Kenshi jadi pioneer knalpot ngebass tapi tetep 80dB legal.', 'sejarah', ARRAY['racing', 'knalpot', 'legal']),
('Kenapa Motor Matic Jadi Raja Jalanan', 'Dulu motor matic dianggap motor emak-emak. Sekarang? PCX, NMAX, Aerox jadi primadona. Knalpot aftermarket kayak Kenshi bikin matic makin gahar.', 'sejarah', ARRAY['matic', 'PCX', 'NMAX']),
('Evolusi Desain Knalpot dari Bulat ke Oval', 'Knalpot jaman dulu bulat semua. Kenshi pake desain oval/lonjong bukan cuma estetik - secara aerodinamis lebih efisien dan suara lebih fokus.', 'sejarah', ARRAY['desain', 'oval', 'aerodinamis']),

-- Tips Unik
('Cara Bedain Stainless Steel Asli vs Palsu', 'Tips: Tempelkan magnet. SS304 asli kayak Kenshi ga nempel magnet. Kalo nempel = palsu, campuran besi biasa yang gampang karatan.', 'tips', ARRAY['stainless', 'SS304', 'magnet']),
('Rahasia Knalpot Awet 10 Tahun', 'Secret: Jangan cuci pake air keras, lap pake kain microfiber abis hujan. Kenshi SS304 anti karat tapi tetep perlu sayang.', 'tips', ARRAY['perawatan', 'awet', 'SS304']),
('Setting Optimal Knalpot Biar Ga Brebet', 'Pro tip: Setelah pasang knalpot baru, biarkan mesin idle 5-10 menit. ECU butuh waktu adaptasi sama backpressure baru.', 'tips', ARRAY['setting', 'brebet', 'ECU']),
('Kapan Waktu Terbaik Ganti Knalpot', 'Jangan ganti knalpot pas motor masih baru. Tunggu minimal 5000km biar mesin udah settle. Baru upgrade ke Kenshi, rasain bedanya.', 'tips', ARRAY['ganti', 'waktu', 'kilometer']),

-- Fakta Unik
('80 Desibel = Suara Blender di Rumah', 'Fun fact: 80dB itu setara suara blender atau vacuum cleaner. Makanya Kenshi mode daily aman, ga ganggu tetangga tapi tetep ada karakter.', 'fakta_unik', ARRAY['desibel', '80dB', 'daily']),
('Laser Cutting vs Las Manual: Beda Presisi 0.1mm', 'Logo Kenshi pake laser cutting dengan presisi 0.1mm. Las manual? Bisa meleset 2-3mm. Detail kecil yang bedain produk premium.', 'fakta_unik', ARRAY['laser', 'presisi', 'premium']),
('Kenapa Knalpot Hitam Lebih Keren', 'Psikologi warna: Hitam = elegan, misterius, powerful. Makanya cover Kenshi full hitam, bukan chrome norak kayak knalpot std.', 'fakta_unik', ARRAY['hitam', 'warna', 'cover']),
('Suara Ngebass dari Diameter Outlet', 'Science: Outlet 38mm Kenshi bikin suara ngebass karena gelombang suara punya ruang resonansi lebih luas. 26mm = cempreng.', 'fakta_unik', ARRAY['outlet', 'ngebass', 'diameter']),
('12.000 Unit Terjual = Keliling Indonesia 200x', 'Kalau 12rb unit Kenshi dipasang dan jalan bareng, itu setara keliling Indonesia 200x. Komunitas makin gede!', 'fakta_unik', ARRAY['terjual', 'komunitas', 'unit']),

-- Trivia
('Nama Kenshi dari Bahasa Jepang', 'Kenshi (剣士) artinya pendekar pedang. Filosofinya: tajam dalam kualitas, presisi dalam pembuatan, dan powerful dalam performa.', 'trivia', ARRAY['nama', 'Jepang', 'filosofi']),
('Hanzo = Ninja Legendaris Jepang', 'Seri HANZO diambil dari Hattori Hanzo, ninja legendaris era Sengoku. Knalpot ini emang se-legendaris itu performanya.', 'trivia', ARRAY['Hanzo', 'ninja', 'legendaris']),
('Faizz Prolevoo: YouTuber Jadi Produsen', 'Tau Faizz Prolevoo? YouTuber otomotif yang frustrated sama kualitas knalpot lokal, akhirnya bikin sendiri. Lahirlah Kenshi.', 'trivia', ARRAY['Faizz', 'YouTuber', 'founder']),
('Rating 4.9 dari 6000+ Review = Hampir Sempurna', 'Secara statistik, rating 4.9 dari 6347 review itu anomali. Artinya produknya beneran bagus, bukan fake review.', 'trivia', ARRAY['rating', 'review', 'statistik']);

-- RLS disabled karena data publik read-only
ALTER TABLE public.motor_slang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for motor_slang" ON public.motor_slang FOR SELECT USING (true);
CREATE POLICY "Public read access for creative_themes" ON public.creative_themes FOR SELECT USING (true);