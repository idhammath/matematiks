(function (root, factory) {
    var GeoSVG = factory();

    if (typeof module === 'object' && module && module.exports) {
        module.exports = GeoSVG;     // Node (require) dan bundler
    } else if (typeof define === 'function' && define.amd) {
        define([], function () { return GeoSVG; });     // RequireJS (AMD)
    }

    if (root) root.GeoSVG = GeoSVG;     // <script> biasa; juga jembatan untuk GeoSVG.esm.js
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
    const GEOSVG_NS = "http://www.w3.org/2000/svg";
    // Semua nama alias opsi, dicatat di SATU tempat.
    // Bentuknya:  namaBaku: ['alias1', 'alias2']
    // Kalau nama baku tidak diisi, nilainya diambil dari alias pertama yang diisi.
    const GEOSVG_ALIAS = {
        konstruktor: {
            margin: ['padding'],
            background: ['backgroundColor'],
            title: ['judul'],
            description: ['desc', 'deskripsi']
        },
        titik: { labelDistance: ['labelPadding', 'offset'] },
        teks: { fill: ['color'] },
        tandaSamaPanjang: {
            count: ['ticks', 'jumlah'],
            size: ['length', 'panjang'],
            spacing: ['gap', 'jarak'],
            stroke: ['color']
        },
        sudut: { labelColor: ['color'], refleks: ['reflex'] },
        siku: { size: ['radius'], dot: ['showDot'], labelColor: ['color'] },
        polaArsir: { stroke: ['color'] }
    };
    // Opsi gaya tambahan yang boleh dipakai (penulisan camelCase).
    const GEOSVG_GAYA_UMUM = [
        'strokeDashoffset',
        'strokeLinecap',
        'strokeLinejoin',
        'strokeMiterlimit',
        'opacity',
        'fillRule',
        'clipRule',
        'vectorEffect',
        'pointerEvents',
        'visibility',
        'cursor',
        'transform'
    ];

    // strokeLinecap -> stroke-linecap, fillRule -> fill-rule
    const GEOSVG_KEBAB = nama => nama.replace(/[A-Z]/g, huruf => '-' + huruf.toLowerCase());
    // Nama posisi berbahasa Indonesia -> nama baku. Dipakai oleh semua method posisi.
    const GEOSVG_POSISI_ALIAS = {
        'kiri atas': 'top-left',
        'tengah atas': 'top-center',
        'kanan atas': 'top-right',
        'kiri tengah': 'middle-left',
        'tengah': 'middle-center',
        'kanan tengah': 'middle-right',
        'kiri bawah': 'bottom-left',
        'tengah bawah': 'bottom-center',
        'kanan bawah': 'bottom-right'
    };
    class GeoSVG {
        // Membuat elemen SVG sekaligus mengisi atributnya.
        // Contoh: this._el('circle', { cx: 10, cy: 20, r: 5 })
        // Parameter ke-3 (opsional): elemen induk tempat elemen ini langsung dimasukkan.
        _el(tag, atribut = {}, induk = null) {
            const el = document.createElementNS(GEOSVG_NS, tag);
            for (const [nama, nilai] of Object.entries(atribut)) {
                if (nilai !== undefined && nilai !== null) el.setAttribute(nama, nilai);
            }
            if (induk) induk.appendChild(el);
            return el;
        }
        // ===== AKSESIBILITAS =====

        // Membersihkan teks: null/undefined/spasi saja -> '' ; selain itu dijadikan teks.
        _bersihTeks(teks) {
            return (teks === undefined || teks === null) ? '' : String(teks).trim();
        }

        // Mencari anak langsung <svg> berdasarkan nama tag ('title' atau 'desc').
        _cariAnak(tag) {
            return Array.from(this.svg.children).find(c => c.tagName === tag) || null;
        }

        // Menyesuaikan role dan atribut aria dengan keberadaan <title> dan <desc>.
        _perbaruiAria() {
            const judul = this._cariAnak('title');
            const desk = this._cariAnak('desc');

            if (judul || desk) {
                this.svg.setAttribute('role', 'img');
            } else {
                this.svg.removeAttribute('role');
            }

            if (judul) this.svg.setAttribute('aria-labelledby', judul.id);
            else this.svg.removeAttribute('aria-labelledby');

            if (desk) this.svg.setAttribute('aria-describedby', desk.id);
            else this.svg.removeAttribute('aria-describedby');
        }

        // Mengatur, mengganti, atau menghapus judul gambar. Teks kosong/null = hapus.
        setJudul(teks) {
            const bersih = this._bersihTeks(teks);
            let el = this._cariAnak('title');

            if (!bersih) {
                if (el) el.remove();
                el = null;
            } else {
                if (!el) {
                    el = this._el('title', { id: this._id('title') });
                    this.svg.insertBefore(el, this.svg.firstChild);        // <title> harus anak pertama
                }
                el.textContent = bersih;                                   // textContent: aman dari injeksi HTML
            }

            this._perbaruiAria();
            return el;
        }

        // Mengatur, mengganti, atau menghapus deskripsi gambar.
        setDeskripsi(teks) {
            const bersih = this._bersihTeks(teks);
            let el = this._cariAnak('desc');

            if (!bersih) {
                if (el) el.remove();
                el = null;
            } else {
                if (!el) {
                    el = this._el('desc', { id: this._id('desc') });
                    const judul = this._cariAnak('title');
                    // <desc> ditaruh tepat setelah <title> (atau paling awal kalau belum ada judul)
                    this.svg.insertBefore(el, judul ? judul.nextSibling : this.svg.firstChild);
                }
                el.textContent = bersih;
            }

            this._perbaruiAria();
            return el;
        }
        // ===== LAPISAN =====

        // Membuat lapisan baru (<g class="layer-nama">) di atas semua lapisan yang ada.
        _buatLapisan(nama) {
            const g = this._el('g', { class: `layer-${nama}`, transform: this._transformYUp }, this.svg);
            this._layers[nama] = g;
            return g;
        }

        // Mengambil lapisan menurut nama. Kalau belum ada, dibuat otomatis di paling atas.
        _getLapisan(nama = 'shapes') {
            nama = String(nama || 'shapes');
            return this._layers[nama] || this._buatLapisan(nama);
        }

        // Memasukkan elemen ke lapisan. Kalau mode batch aktif, ditampung dulu di kotak sementara.
        _tambah(el, nama = 'shapes') {
            if (this._destroyed) {
                return this._gagal("instance ini sudah di-destroy(); buat instance baru untuk menggambar lagi");
            }
            nama = String(nama || 'shapes');
            if (this._batch) {
                if (!this._batch[nama]) this._batch[nama] = document.createDocumentFragment();
                this._batch[nama].appendChild(el);
            } else {
                this._getLapisan(nama).appendChild(el);
            }
            return el;
        }

        // ===== GAMBAR LATAR (JPG/PNG) =====

        // Membaca File/Blob menjadi data URL (teks base64)
        _bacaSebagaiDataUrl(blob) {
            return new Promise((resolve, reject) => {
                const pembaca = new FileReader();
                pembaca.onload = () => resolve(pembaca.result);
                pembaca.onerror = () => reject(new Error("gagal membaca file gambar"));
                pembaca.readAsDataURL(blob);
            });
        }

        // Memuat gambar untuk mengetahui ukuran aslinya
        _muatGambarUkuran(dataUrl) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error("browser tidak bisa membaca gambar ini. Pastikan file JPG, PNG, WebP, atau GIF yang valid"));
                img.src = dataUrl;
            });
        }

        // Mengubah sumber gambar apa pun menjadi { dataUrl, w, h }
        async _siapkanGambar(sumber, options) {
            const FORMAT = /^data:image\/(png|jpe?g|webp|gif)[;,]/i;
            let dataUrl;

            if (typeof Blob !== 'undefined' && sumber instanceof Blob) {            // File juga Blob
                dataUrl = await this._bacaSebagaiDataUrl(sumber);
            } else if (typeof sumber === 'string' && sumber.trim() !== '') {
                const teks = sumber.trim();
                if (/^data:/i.test(teks)) {
                    dataUrl = teks;
                } else {
                    let respons = null;
                    try { respons = await fetch(teks); } catch (e) { respons = null; }
                    if (!respons || !respons.ok) {
                        throw new Error("gagal mengambil gambar dari alamat itu. Kemungkinan server gambar tidak mengizinkan akses dari halaman ini (CORS). Pakai file dari komputer (input file) atau data URL.");
                    }
                    dataUrl = await this._bacaSebagaiDataUrl(await respons.blob());
                }
            } else {
                throw new Error("sumber harus berupa File/Blob, alamat gambar (URL), atau data URL");
            }

            if (!FORMAT.test(dataUrl)) throw new Error("format gambar tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.");

            const img = await this._muatGambarUkuran(dataUrl);
            let w = img.naturalWidth, h = img.naturalHeight;
            if (!(w > 0 && h > 0)) throw new Error("ukuran gambar tidak terbaca");

            // Opsional: kecilkan gambar supaya file SVG tidak terlalu besar
            const maks = this._ada(options.maksSisi) ? Number(options.maksSisi) : 0;
            if (maks > 0 && Math.max(w, h) > maks) {
                const skala = maks / Math.max(w, h);
                const kanvas = document.createElement('canvas');
                kanvas.width = Math.max(1, Math.round(w * skala));
                kanvas.height = Math.max(1, Math.round(h * skala));
                const ctx = kanvas.getContext('2d');
                if (!ctx) throw new Error("browser tidak bisa mengecilkan gambar");
                ctx.drawImage(img, 0, 0, kanvas.width, kanvas.height);

                const jpeg = /^data:image\/jpe?g/i.test(dataUrl);                  // JPEG tetap JPEG, lainnya jadi PNG
                const kualitas = this._ada(options.kualitas) ? Number(options.kualitas) : 0.85;
                dataUrl = kanvas.toDataURL(jpeg ? 'image/jpeg' : 'image/png', kualitas);
                w = kanvas.width; h = kanvas.height;
            }
            return { dataUrl, w, h };
        }

        // Menerapkan opsi font ke elemen teks. Hanya menulis yang diisi (sisanya mewarisi font bawaan gambar).
        // fontStyle: 'italic' (miring), 'oblique', atau 'normal'. fontWeight: 'bold', 'normal', atau 100 sampai 900.
        _terapkanFont(text, o) {
            if (!o) return;
            if (o.fontSize) text.setAttribute('font-size', o.fontSize);
            if (o.fontFamily) text.setAttribute('font-family', o.fontFamily);
            if (o.fontWeight) text.setAttribute('font-weight', o.fontWeight);
            if (o.fontStyle) text.setAttribute('font-style', o.fontStyle);
        }

        // Memindahkan elemen yang sudah ada ke lapisan lain.
        // Catatan: kalau elemen berada di dalam grup, ia dikeluarkan dari grup itu.
        pindahKeLapisan(element, nama) {
            if (!(element instanceof Node)) return this._gagal("pindahKeLapisan: elemen tidak valid");
            this._getLapisan(nama).appendChild(element);
            return element;
        }

        // ===== BATCH =====

        // Mulai mengumpulkan elemen di memori. Elemen belum tampil sampai selesaiBatch() dipanggil.
        mulaiBatch() {
            this._batchDepth = (this._batchDepth || 0) + 1;   // penghitung: batch di dalam batch aman
            if (this._batchDepth === 1) this._batch = {};
        }

        // Memasukkan semua elemen yang terkumpul ke halaman, satu kali per lapisan.
        selesaiBatch() {
            if (!this._batchDepth) return;
            this._batchDepth--;
            if (this._batchDepth > 0) return;                 // masih ada batch luar yang aktif

            const batch = this._batch;
            this._batch = null;
            for (const [nama, kotak] of Object.entries(batch)) {
                this._getLapisan(nama).appendChild(kotak);
            }
        }

        // Cara paling aman: batch otomatis selesai walaupun ada error di tengah.
        // Contoh: geo.batch(g => { for (...) g.buatLingkaran(...); });
        batch(fn) {
            this.mulaiBatch();
            try {
                return fn(this);
            } finally {
                this.selesaiBatch();
            }
        }

        // true jika lingkungan ini punya DOM (browser). Aman dipanggil di server/Node.
        static didukung() {
            return typeof document !== 'undefined' && typeof document.createElementNS === 'function';
        }

        constructor(containerId, width, height, options = {}) {
            if (!GeoSVG.didukung()) {
                throw new Error(
                    "GeoSVG: library ini butuh browser (objek 'document' tidak ditemukan). " +
                    "Jika memakai SSR (Next.js, Nuxt, dan sejenisnya), buat instance di dalam " +
                    "useEffect/onMounted, bukan saat render di server."
                );
            }
            if (typeof width === 'object' && width !== null) {
                options = width;
                width = options.width;
                height = options.height;
            }

            this.strict = options.strict === true;

            // Boleh berisi id (teks) ATAU elemen HTML langsung
            this.container = (typeof containerId === 'string')
                ? document.getElementById(containerId)
                : containerId;

            if (!(this.container instanceof Element)) {
                throw new Error(
                    `GeoSVG: container '${containerId}' tidak ditemukan. ` +
                    `Pastikan id benar dan script dijalankan SETELAH elemennya ada di halaman.`
                );
            }
            this.svg = this._el('svg');
            // Gaya bawaan: dipasang SEKALI di root, diwarisi semua elemen di bawahnya
            this.svg.setAttribute("fill", "none");
            this.svg.setAttribute("stroke", options.defaultStroke || "black");
            if (this._ada(options.defaultStrokeWidth)) {
                this.svg.setAttribute("stroke-width", options.defaultStrokeWidth);
            }
            // Font bawaan untuk SEMUA teks (diwarisi). Hanya ditulis kalau diisi.
            if (options.fontFamily) this.svg.setAttribute('font-family', options.fontFamily);
            if (options.fontSize) this.svg.setAttribute('font-size', options.fontSize);
            const numWidth = this._ukuranAngka(width);
            const numHeight = this._ukuranAngka(height);

            options = this._normalizeOptions(options, GEOSVG_ALIAS.konstruktor);
            const margin = this._ada(options.margin) ? options.margin : 0;
            this.svg.setAttribute("width", this._ada(width) ? width : "100%");
            this.svg.setAttribute("height", this._ada(height) ? height : "100%");

            if (options.viewBox) {
                if (typeof options.viewBox === 'string') {
                    this.svg.setAttribute("viewBox", options.viewBox);
                } else if (!isNaN(numWidth) && !isNaN(numHeight)) {
                    this.svg.setAttribute("viewBox", `${-margin} ${-margin} ${numWidth + 2 * margin} ${numHeight + 2 * margin}`);
                }
            } else if (margin > 0 && !isNaN(numWidth) && !isNaN(numHeight)) {
                this.svg.setAttribute("viewBox", `${-margin} ${-margin} ${numWidth + 2 * margin} ${numHeight + 2 * margin}`);
            }

            if ((margin > 0 || options.viewBox) && !this.svg.hasAttribute("viewBox")) {
                console.warn(
                    "GeoSVG: margin/viewBox diabaikan karena width/height bukan angka pasti " +
                    "(misalnya '100%'). Gunakan angka, atau isi options.viewBox dengan teks, " +
                    "contoh: viewBox: '0 0 800 600'."
                );
            }
            if (options.preserveAspectRatio) {
                this.svg.setAttribute("preserveAspectRatio", options.preserveAspectRatio);
            }

            // Default overflow diset 'visible' (atau sesuai opsi) agar stroke pada tepi canvas tidak terpotong
            this.svg.style.overflow = options.overflow || 'visible';

            // Latar belakang SVG (default: transparan)
            this.svg.style.backgroundColor = options.background || 'transparent';

            // Nomor unik untuk setiap instance (geo1, geo2, ...)
            GeoSVG._counter = (GeoSVG._counter || 0) + 1;
            this.uid = 'geo' + GeoSVG._counter;

            // Catatan marker yang sudah dibuat: kunci "warna" -> id marker
            this._markers = new Map();

            this.defs = this._el('defs', {}, this.svg);
            // Lapisan, dari bawah ke atas. Elemen baru masuk ke lapisan sesuai jenisnya.
            // Sistem koordinat: yUp = sumbu Y mengarah ke atas (seperti buku matematika)
            this._yUp = false;
            this._transformYUp = null;
            if (options.yUp === true) {
                const area = this._areaTetap();
                if (!area) {
                    this._gagal("yUp butuh viewBox atau width/height berupa angka pasti (bukan '100%'). Opsi yUp diabaikan.");
                } else {
                    this._yUp = true;
                    // Balik arah Y, lalu geser supaya angka yang terlihat sama dengan angka viewBox
                    this._transformYUp = `translate(0 ${2 * area.minY + area.h}) scale(1 -1)`;
                }
            }
            this._layers = {};
            this._batch = null;
            this._batchDepth = 0;
            this._destroyed = false;
            ['grid', 'shapes', 'labels'].forEach(nama => this._buatLapisan(nama));
            // Aksesibilitas: judul, deskripsi, dan tanda gambar hiasan
            if (options.dekoratif === true) {
                this.svg.setAttribute("aria-hidden", "true");      // pembaca layar melewati gambar ini
            } else {
                if (this._bersihTeks(options.description) && !this._bersihTeks(options.title)) {
                    console.warn("GeoSVG: 'description' diisi tetapi 'title' kosong. Isi 'title' juga supaya pembaca layar punya nama untuk gambar ini.");
                }
                this.setJudul(options.title);
                this.setDeskripsi(options.description);
            }

            // Catatan: container -> daftar instance GeoSVG di dalamnya
            GeoSVG._daftar = GeoSVG._daftar || new WeakMap();
            let daftar = GeoSVG._daftar.get(this.container);
            if (!daftar) {
                daftar = new Set();
                GeoSVG._daftar.set(this.container, daftar);
            }

            if (options.clearContainer === true) {
                // Hancurkan instance lama dulu (pakai salinan daftar karena destroy() mengubah daftar)
                [...daftar].forEach(lama => lama.destroy());
                // Lalu kosongkan sisa isi container, apa pun isinya
                while (this.container.firstChild) {
                    this.container.removeChild(this.container.firstChild);
                }
            } else if (daftar.size > 0) {
                console.warn(
                    "GeoSVG: container ini sudah berisi gambar GeoSVG lain, sehingga gambar akan bertumpuk. " +
                    "Gunakan { clearContainer: true } untuk menggantinya, atau panggil destroy() pada instance lama."
                );
            }

            daftar.add(this);
            this.container.appendChild(this.svg);
        }

        // Menangani kesalahan input.
        // Mode biasa : peringatan di Console, lalu mengembalikan null.
        // Mode strict: langsung throw (berhenti dengan error).
        _gagal(pesan) {
            const teks = `GeoSVG: ${pesan}`;
            if (this.strict) throw new Error(teks);
            console.warn(teks);
            return null;
        }

        // true jika SEMUA nilai adalah angka yang sah (bukan NaN, undefined, Infinity)
        _semuaAngka(...nilai) {
            return nilai.every(v =>
                typeof v === 'number'
                    ? Number.isFinite(v)
                    : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
            );
        }

        // Mengubah titik [x, y] atau {x, y} menjadi {x, y}. Mengembalikan null jika tidak valid.
        _pt(p) {
            if (Array.isArray(p) && this._semuaAngka(p[0], p[1])) {
                return { x: Number(p[0]), y: Number(p[1]) };
            }
            if (p && typeof p === 'object' && this._semuaAngka(p.x, p.y)) {
                return { x: Number(p.x), y: Number(p.y) };
            }
            return null;
        }

        // Mengubah ukuran menjadi angka, HANYA jika memang angka murni.
        // 300 -> 300 | "300" -> 300 | "300px" -> 300 | "100%" -> NaN | "50vw" -> NaN
        _ukuranAngka(nilai) {
            if (typeof nilai === 'number') {
                return Number.isFinite(nilai) ? nilai : NaN;
            }
            if (typeof nilai === 'string') {
                const teks = nilai.trim();
                if (/^\d*\.?\d+(px)?$/i.test(teks)) return parseFloat(teks);
            }
            return NaN;
        }
        // Membuat ID yang dijamin unik: "geo1-nama", "geo2-nama", dst.
        _id(name) {
            return `${this.uid}-${name}`;
        }

        // Mengambil marker panah; kalau belum ada, dibuat dulu.
        // color   : warna panah
        // reverse : true untuk panah yang menghadap ke arah sebaliknya (ujung awal garis)
        _getMarker(color = 'black', reverse = false) {
            const key = `${reverse ? 'rev' : 'fwd'}|${color}`;
            if (this._markers.has(key)) return this._markers.get(key);

            const id = this._id(`marker-${this._markers.size}`);
            const marker = this._el('marker', {
                id, markerWidth: 10, markerHeight: 7,
                refX: reverse ? 1 : 9, refY: 3.5, orient: 'auto'
            }, this.defs);
            this._el('polygon', {
                points: reverse ? "10 0, 0 3.5, 10 7" : "0 0, 10 3.5, 0 7",
                fill: color,
                stroke: 'none'
            }, marker);

            this._markers.set(key, id);
            return id;
        }

        // true jika nilai benar-benar diisi (0 dan "" tetap dianggap diisi)
        _ada(nilai) {
            return nilai !== undefined && nilai !== null;
        }


        // Menerjemahkan nama alias ke nama baku. Selalu mengembalikan SALINAN,
        // jadi objek opsi milik pemanggil tidak pernah berubah.
        // Contoh: _normalizeOptions({ ticks: 4 }, { count: ['ticks', 'jumlah'] })
        //         -> { ticks: 4, count: 4 }
        _normalizeOptions(opts, aliasMap = {}) {
            const hasil = (opts && typeof opts === 'object') ? { ...opts } : {};

            for (const [namaBaku, daftarAlias] of Object.entries(aliasMap)) {
                if (this._ada(hasil[namaBaku])) continue;        // nama baku diisi -> dia yang menang

                for (const alias of daftarAlias) {
                    if (this._ada(hasil[alias])) {
                        hasil[namaBaku] = hasil[alias];          // salin dari alias pertama yang diisi
                        break;
                    }
                }
            }
            return hasil;
        }
        // Mengubah opsi `dashed` menjadi nilai stroke-dasharray.
        //   true -> "6 4" | angka 5 -> "5 5" | teks "8 3 2 3" -> dipakai apa adanya | false -> tidak ada
        _nilaiDashed(dashed) {
            if (dashed === true) return "6 4";
            if (typeof dashed === 'number' && dashed > 0) return `${dashed} ${dashed}`;
            if (typeof dashed === 'string' && dashed.trim() !== '') return dashed;
            return null;
        }

        // Menerapkan opsi gaya tambahan: putus-putus, opsi dari daftar, id, class, dan data-*.
        _applyExtras(element, options) {
            if (!options) return;

            // Garis putus-putus. strokeDasharray yang ditulis eksplisit menang atas `dashed`.
            const dash = this._ada(options.strokeDasharray)
                ? options.strokeDasharray
                : this._nilaiDashed(options.dashed);
            if (this._ada(dash)) element.setAttribute("stroke-dasharray", dash);

            // Opsi dari daftar yang diizinkan
            for (const nama of GEOSVG_GAYA_UMUM) {
                if (this._ada(options[nama])) {
                    element.setAttribute(GEOSVG_KEBAB(nama), options[nama]);
                }
            }

            // id (harus unik di seluruh halaman)
            if (options.id) {
                if (document.getElementById(options.id)) {
                    console.warn(`GeoSVG: id '${options.id}' sudah dipakai elemen lain di halaman.`);
                }
                element.setAttribute("id", options.id);
            }

            // class: boleh ditulis className atau class
            const kelas = options.className || options.class;
            if (kelas) element.setAttribute("class", kelas);

            // data-*: { namaBentuk: 'a' } menjadi data-nama-bentuk="a"
            if (options.dataset && typeof options.dataset === 'object') {
                for (const [kunci, nilai] of Object.entries(options.dataset)) {
                    element.setAttribute("data-" + GEOSVG_KEBAB(kunci), nilai);
                }
            }
        }
        // Hanya menulis atribut yang DIISI pengguna. Sisanya diwarisi dari grup/root.
        _applyOptions(element, options) {
            if (!options) return;

            if (options.stroke) element.setAttribute("stroke", options.stroke);
            if (options.fill) element.setAttribute("fill", options.fill);
            if (this._ada(options.strokeWidth)) element.setAttribute("stroke-width", options.strokeWidth);
            if (this._ada(options.fillOpacity)) element.setAttribute("fill-opacity", options.fillOpacity);
            if (this._ada(options.strokeOpacity)) element.setAttribute("stroke-opacity", options.strokeOpacity);
            this._applyExtras(element, options);   // <-- baris ini
        }

        // Mengubah nama posisi (Indonesia atau Inggris) menjadi nama baku
        _normalisasiPosisi(posisi, bawaan) {
            return GEOSVG_POSISI_ALIAS[posisi] || posisi || bawaan;
        }

        // Posisi = di sisi mana label berada TERHADAP titik (x, y).
        // 'top-left' berarti label ada di kiri-atas titik, 'bottom-right' di kanan-bawah, dst.
        // alignX / alignY = bagian kotak yang berada di sebelah KIRI / ATAS titik (0 sampai 1).
        _getAlignmentProps(position) {
            //                     [text-anchor, dominant-baseline, alignX, alignY]
            const tabel = {
                'top-left': ['end', 'alphabetic', 1, 1],
                'top-center': ['middle', 'alphabetic', 0.5, 1],
                'top-right': ['start', 'alphabetic', 0, 1],
                'middle-left': ['end', 'central', 1, 0.5],
                'middle-center': ['middle', 'central', 0.5, 0.5],
                'middle-right': ['start', 'central', 0, 0.5],
                'bottom-left': ['end', 'hanging', 1, 0],
                'bottom-center': ['middle', 'hanging', 0.5, 0],
                'bottom-right': ['start', 'hanging', 0, 0]
            };

            let pos = this._normalisasiPosisi(position, 'bottom-left');
            if (!tabel[pos]) {
                console.warn(`GeoSVG: posisi '${position}' tidak dikenal, dipakai 'bottom-left'.`);
                pos = 'bottom-left';
            }

            const [anchor, baseline, alignX, alignY] = tabel[pos];
            return { anchor, baseline, alignX, alignY, pos };
        }
        // Mode yUp: seluruh lapisan dibalik, jadi teks harus dibalik SEKALI LAGI di titik jangkarnya
        // supaya huruf tegak. Posisi (x, y) teks tidak berubah.
        _tegakkanTeks(text) {
            if (!this._yUp) return;
            const x = Number(text.getAttribute('x'));
            const y = Number(text.getAttribute('y'));
            text.setAttribute('transform', `translate(${x} ${y}) scale(1 -1) translate(${-x} ${-y})`);
        }
        _applyTextAlignment(textElement, position) {
            const props = this._getAlignmentProps(position || 'bottom-left');
            textElement.setAttribute("text-anchor", props.anchor);
            textElement.setAttribute("dominant-baseline", props.baseline);
            return props;
        }

        // Menentukan di mana label titik diletakkan.
        // labelPosition = sisi titik tempat label berada ('top-right' = label di kanan-atas titik).
        // dx/dy = pergeseran jangkar label dari titik; alignPos = cara teks disusun terhadap jangkar.
        _getLabelAlignment(labelPosition, padding) {
            const pos = this._normalisasiPosisi(labelPosition, 'top-right');

            // [arah x, arah y, posisi teks]. Arah dikali padding: -1 = ke kiri/atas, 1 = ke kanan/bawah
            const tabel = {
                'top-left': [-1, -1, 'top-left'],
                'top-center': [0, -1, 'top-center'],
                'top-right': [1, -1, 'top-right'],
                'middle-left': [-1, 0, 'middle-left'],
                'middle-center': [0, 0, 'middle-center'],
                'middle-right': [1, 0, 'middle-right'],
                'bottom-left': [-1, 1, 'bottom-left'],
                'bottom-center': [0, 1, 'bottom-center'],
                'bottom-right': [1, 1, 'bottom-right']
            };

            const [kx, ky, alignPos] = tabel[pos] || [0, 0, 'top-right'];
            return { dx: kx * padding, dy: ky * padding, alignPos };
        }

        // Mengubah selisih sudut (radian) ke rentang (-π, π]. Aman terhadap NaN/Infinity.
        _normalSudut(selisih) {
            if (!Number.isFinite(selisih)) return 0;
            while (selisih <= -Math.PI) selisih += 2 * Math.PI;
            while (selisih > Math.PI) selisih -= 2 * Math.PI;
            return selisih;
        }

        // Menaruh label di garis bagi sudut. Dipakai oleh buatSudut dan buatSiku.
        // a1 = arah garis pertama (radian), diff = besar sudut (radian)
        _tambahLabelSudut(group, vx, vy, a1, diff, radiusDasar, opsi) {
            if (!opsi.label) return null;

            const garisBagi = a1 + diff / 2;
            const jarak = opsi.labelRadius || (radiusDasar + 15);

            const text = this._el('text', {
                x: vx + jarak * Math.cos(garisBagi),
                y: vy + jarak * Math.sin(garisBagi),
                fill: opsi.labelColor || 'black',
                'font-weight': opsi.bold ? 'bold' : (opsi.fontWeight || 'normal'),
                stroke: 'none'
            });
            text.textContent = opsi.label;
            this._terapkanFont(text, opsi);
            this._applyTextAlignment(text, opsi.labelPosition || 'middle-center');
            this._tegakkanTeks(text);
            group.appendChild(text);
            return text;
        }

        // Menghitung titik awal garis sejajar dan arahnya.
        // lewat: angka (jarak geser tegak lurus) ATAU titik [x, y] yang harus dilalui.
        _titikSejajar(refP1, refP2, lewat) {
            const a = this._pt(refP1);
            const b = this._pt(refP2);
            if (!a || !b) return null;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) return null;

            let px, py;
            if (typeof lewat === 'number') {
                px = a.x + (-dy / len) * lewat;   // vektor tegak lurus dikali jarak
                py = a.y + (dx / len) * lewat;
            } else {
                const t = this._pt(lewat);
                if (!t) return null;
                px = t.x;
                py = t.y;
            }
            return { px, py, dx, dy, len };
        }

        // Memotong garis tak hingga (yang melalui titik 1 dan titik 2) agar tepat memenuhi area gambar.
        // pad = jarak tambahan di luar area, supaya ujung garis tidak tampak di dalam gambar.
        // Mengembalikan { x1, y1, x2, y2 }, atau null jika garis tidak melewati area gambar.
        _klipGaris(x1, y1, x2, y2, pad = 5, tMulai = -Infinity) {
            const area = this._getAreaGambar();
            const xMin = area.minX - pad;
            const xMax = area.minX + area.w + pad;
            const yMin = area.minY - pad;
            const yMax = area.minY + area.h + pad;

            const dx = x2 - x1;
            const dy = y2 - y1;

            // Pasangan [p, q] untuk empat sisi area: kiri, kanan, atas, bawah
            const batas = [
                [-dx, x1 - xMin],
                [dx, xMax - x1],
                [-dy, y1 - yMin],
                [dy, yMax - y1]
            ];

            let tAwal = tMulai;    // tempat garis masuk ke area
            let tAkhir = Infinity;    // tempat garis keluar dari area

            for (const [p, q] of batas) {
                if (p === 0) {
                    // Garis sejajar dengan sisi ini. Kalau berada di luar sisi itu, tidak mungkin masuk area.
                    if (q < 0) return null;
                } else {
                    const t = q / p;
                    if (p < 0) tAwal = Math.max(tAwal, t);
                    else tAkhir = Math.min(tAkhir, t);
                }
            }

            // Garis melewati area di luar sudutnya: tidak ada bagian yang terlihat
            if (tAwal > tAkhir) return null;

            return {
                x1: x1 + tAwal * dx, y1: y1 + tAwal * dy,
                x2: x1 + tAkhir * dx, y2: y1 + tAkhir * dy
            };
        }

        // Membulatkan angka ke sejumlah desimal (bawaan 3) supaya teks path tidak panjang.
        // 37.50000000000001 -> 37.5
        _bulat(n, desimal = 3) {
            const faktor = 10 ** desimal;
            return Math.round(n * faktor) / faktor;
        }

        // Titik (Point)
        buatTitik(x, y, options = {}) {
            // Titik boleh berbentuk [x, y] atau {x, y}. Kalau begitu, argumen ke-2 adalah options.
            if (x !== null && typeof x === 'object') {
                const p = this._pt(x);
                if (!p) return this._gagal("buatTitik: titik harus [x, y] atau {x, y} berisi angka");
                options = y || {};
                x = p.x;
                y = p.y;
            }
            if (!this._semuaAngka(x, y)) return this._gagal("buatTitik: x dan y harus angka");

            // Pastikan benar-benar angka (bukan teks seperti "10"), supaya x + size tidak menjadi "104"
            x = Number(x);
            y = Number(y);

            options = this._normalizeOptions(options, GEOSVG_ALIAS.titik);

            const marker = options.marker || 'full-circle';
            const MARKER_VALID = ['full-circle', 'empty-circle', 'diamond', 'plus'];
            if (!MARKER_VALID.includes(marker)) {
                return this._gagal(`buatTitik: marker '${marker}' tidak dikenal. Pilihan: ${MARKER_VALID.join(', ')}`);
            }

            const size = this._ada(options.size) ? options.size : 4;
            const color = options.color || 'black';
            const group = this._el('g');

            if (marker === 'full-circle') {
                this._el('circle', { cx: x, cy: y, r: size, fill: color, stroke: 'none' }, group);
            } else if (marker === 'empty-circle') {
                this._el('circle', { cx: x, cy: y, r: size, fill: 'none', stroke: color, 'stroke-width': 1.5 }, group);
            } else if (marker === 'diamond') {
                this._el('polygon', {
                    points: `${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`,
                    fill: color,
                    stroke: 'none'
                }, group);
            } else if (marker === 'plus') {
                this._el('path', {
                    d: `M ${x - size} ${y} L ${x + size} ${y} M ${x} ${y - size} L ${x} ${y + size}`,
                    stroke: color, 'stroke-width': 1.5
                }, group);
            }

            // Label
            if (options.label) {
                const padding = this._ada(options.labelDistance) ? options.labelDistance : size + 4;
                const labelAlign = this._getLabelAlignment(options.labelPosition, padding);

                const text = this._el('text', {
                    x: x + labelAlign.dx + (options.dx || 0),
                    y: y + (this._yUp ? -labelAlign.dy : labelAlign.dy) + (options.dy || 0),
                    fill: options.labelColor || color,
                    'font-size': options.fontSize || this.svg.getAttribute('font-size') || "12px",
                    'font-family': options.fontFamily || this.svg.getAttribute('font-family') || "sans-serif",
                    'font-weight': options.bold ? 'bold' : (options.fontWeight || 'normal'),
                    stroke: 'none'
                });
                this._terapkanFont(text, options);
                this._applyTextAlignment(text, labelAlign.alignPos);
                text.textContent = options.label;
                this._tegakkanTeks(text);
                group.appendChild(text);
            }

            // Transparansi: berlaku untuk seluruh titik (bentuk dan labelnya)
            if (this._ada(options.opacity)) group.setAttribute('opacity', options.opacity);
            if (this._ada(options.fillOpacity)) group.setAttribute('fill-opacity', options.fillOpacity);
            if (this._ada(options.strokeOpacity)) group.setAttribute('stroke-opacity', options.strokeOpacity);
            this._tambah(group, 'shapes');
            return group;
        }

        hitungTitikTengah(p1, p2) {
            const a = this._pt(p1), b = this._pt(p2);
            if (!a || !b) return this._gagal("hitungTitikTengah: p1 dan p2 harus [x, y] atau {x, y} berisi angka");
            return [(a.x + b.x) / 2, (a.y + b.y) / 2];
        }
        // Titik Tengah
        buatTitikTengah(p1, p2, options = {}) {
            const t = this.hitungTitikTengah(p1, p2);
            if (!t) return null;
            return this.buatTitik(t, options);
        }

        // Menambahkan label pada garis. Dipakai oleh buatSegmen, buatGaris, buatSinar, dan buatVektor.
        // Tanpa opsi label: mengembalikan garis apa adanya.
        // Dengan opsi label: garis dan label dibungkus dalam <g>, dan <g> itulah yang dikembalikan.
        // (x1,y1)-(x2,y2) = bagian garis yang terlihat; label diletakkan relatif terhadapnya.
        _pasangLabelGaris(line, x1, y1, x2, y2, options) {
            if (!options || !this._ada(options.label) || options.label === '') return line;
            if (line.getAttribute('display') === 'none') return line;     // garis tidak terlihat: tanpa label

            const dx = x2 - x1, dy = y2 - y1;
            const panjang = Math.hypot(dx, dy);
            if (panjang === 0) return line;

            // Posisi di sepanjang garis
            const KATA = { awal: 0, tengah: 0.5, akhir: 1 };
            let t = this._ada(options.labelPosisi) ? options.labelPosisi : 0.5;
            if (typeof t === 'string' && Object.prototype.hasOwnProperty.call(KATA, t)) t = KATA[t];
            t = Number(t);
            if (!Number.isFinite(t)) {
                this._gagal("label: labelPosisi harus angka (0 sampai 1) atau 'awal', 'tengah', 'akhir'. Dipakai 'tengah'.");
                t = 0.5;
            }

            // Sisi dan jarak
            let sisi = this._ada(options.labelSisi) ? options.labelSisi : 'kiri';
            if (sisi !== 'kiri' && sisi !== 'kanan') {
                this._gagal(`label: labelSisi '${sisi}' tidak dikenal. Pilihan: kiri, kanan. Dipakai 'kiri'.`);
                sisi = 'kiri';
            }
            let jarak = this._ada(options.labelJarak) ? Number(options.labelJarak) : 6;
            if (!Number.isFinite(jarak)) {
                this._gagal("label: labelJarak harus angka. Dipakai 6.");
                jarak = 6;
            }

            // Arah ke sisi kiri (dilihat di layar): (dy, -dx) di layar biasa, (-dy, dx) di mode yUp
            const s = (this._yUp ? -1 : 1) * (sisi === 'kiri' ? 1 : -1);
            const nx = s * dy / panjang;
            const ny = s * -dx / panjang;

            const ax = x1 + t * dx + nx * jarak;
            const ay = y1 + t * dy + ny * jarak;

            // Perataan teks: teks ditaruh di sisi luar titik jangkar, menjauh dari garis
            const vx = nx;
            const vy = this._yUp ? -ny : ny;                 // arah vertikal seperti terlihat di layar
            const h = vx > 0.5 ? 'right' : (vx < -0.5 ? 'left' : 'center');
            const v = vy < -0.5 ? 'top' : (vy > 0.5 ? 'bottom' : 'middle');

            const teks = this.buatTeks(ax, ay, String(options.label), {
                position: `${v}-${h}`,
                fill: options.labelColor || options.stroke || this.svg.getAttribute('stroke') || 'black',
                fontSize: options.fontSize || this.svg.getAttribute('font-size') || '12px',
                fontFamily: options.fontFamily,
                fontWeight: options.fontWeight || (options.bold === true ? 'bold' : undefined),
                fontStyle: options.fontStyle || (options.italic === true ? 'italic' : undefined)
            });
            if (!teks) return line;

            // Bungkus garis dan label dalam satu grup, menggantikan posisi garis
            const grup = this._el('g');
            if (line.parentNode) line.parentNode.insertBefore(grup, line);
            grup.appendChild(line);
            grup.appendChild(teks);
            return grup;
        }

        // Garis (tak hingga): dipotong tepat di tepi area gambar
        // Dua cara memanggil:
        //   buatGaris(x1, y1, x2, y2, options)
        //   buatGaris(p1, p2, options)      <- p1, p2 berbentuk [x, y] atau {x, y}
        // options.clipPad = jarak tambahan di luar area (bawaan 5)
        // Label diletakkan relatif terhadap BAGIAN YANG TERLIHAT dari garis.
        buatGaris(a, b, c, d, e) {
            const arg = this._duaTitik(a, b, c, d, e);
            if (!arg) return this._gagal("buatGaris: titik harus [x, y] atau {x, y} berisi angka");

            let { x1, y1, x2, y2, options } = arg;
            if (!this._semuaAngka(x1, y1, x2, y2)) return this._gagal("buatGaris: x1, y1, x2, y2 harus angka");

            // Pastikan benar-benar angka (bukan teks seperti "10")
            x1 = Number(x1); y1 = Number(y1); x2 = Number(x2); y2 = Number(y2);

            if (x1 === x2 && y1 === y2) {
                return this._gagal("buatGaris: kedua titik sama, arah garis tidak bisa ditentukan");
            }

            const pad = this._ada(options.clipPad) ? options.clipPad : 5;
            const klip = this._klipGaris(x1, y1, x2, y2, pad);

            // Kalau garis tidak melewati area gambar, tetap buat elemennya tapi disembunyikan,
            // supaya hasil method ini selalu berupa elemen (kode Anda tidak crash karena null).
            const line = this._el('line', klip
                ? { x1: klip.x1, y1: klip.y1, x2: klip.x2, y2: klip.y2 }
                : { x1, y1, x2, y2, display: 'none' });

            this._applyOptions(line, options);
            this._tambah(line, 'shapes');

            const u = klip || { x1, y1, x2, y2 };
            return this._pasangLabelGaris(line, u.x1, u.y1, u.x2, u.y2, options);
        }

        // Sinar (ray): berpangkal di titik pertama, melewati titik kedua, memanjang tak hingga ke arah itu.
        // Dipotong di tepi area gambar. Dua cara memanggil:
        //   buatSinar(x1, y1, x2, y2, options)
        //   buatSinar(pangkal, arah, options)      <- titik berbentuk [x, y] atau {x, y}
        // options.clipPad = jarak tambahan di luar area pada ujung yang jauh (bawaan 5)
        // Label diletakkan relatif terhadap BAGIAN YANG TERLIHAT dari sinar.
        buatSinar(a, b, c, d, e) {
            const arg = this._duaTitik(a, b, c, d, e);
            if (!arg) return this._gagal("buatSinar: titik harus [x, y] atau {x, y} berisi angka");

            let { x1, y1, x2, y2, options } = arg;
            if (!this._semuaAngka(x1, y1, x2, y2)) return this._gagal("buatSinar: x1, y1, x2, y2 harus angka");
            x1 = Number(x1); y1 = Number(y1); x2 = Number(x2); y2 = Number(y2);

            if (x1 === x2 && y1 === y2) {
                return this._gagal("buatSinar: titik pangkal dan titik arah sama, arah sinar tidak bisa ditentukan");
            }

            const pad = this._ada(options.clipPad) ? options.clipPad : 5;
            const klip = this._klipGaris(x1, y1, x2, y2, pad, 0);    // 0 = mulai dari pangkal, bukan dari belakangnya

            // Kalau sinar tidak melewati area gambar, tetap dibuat tapi disembunyikan (hasilnya selalu berupa elemen)
            const line = this._el('line', klip
                ? { x1: klip.x1, y1: klip.y1, x2: klip.x2, y2: klip.y2 }
                : { x1, y1, x2, y2, display: 'none' });

            this._applyOptions(line, options);
            this._tambah(line, 'shapes');

            const u = klip || { x1, y1, x2, y2 };
            return this._pasangLabelGaris(line, u.x1, u.y1, u.x2, u.y2, options);
        }

        // Mengenali dua bentuk pemanggilan:
        //   bentuk lama : (x1, y1, x2, y2, options)
        //   bentuk baru : (p1, p2, options), titik boleh [x, y] atau {x, y}
        // Mengembalikan { x1, y1, x2, y2, options }, atau null jika titiknya tidak valid.
        _duaTitik(a, b, c, d, e) {
            if (typeof a === 'number' || typeof a === 'string') {
                return { x1: a, y1: b, x2: c, y2: d, options: e || {} };
            }
            const p1 = this._pt(a), p2 = this._pt(b);
            if (!p1 || !p2) return null;
            return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, options: c || {} };
        }

        // Segmen garis. Dua cara memanggil:
        //   buatSegmen(x1, y1, x2, y2, options)
        //   buatSegmen(p1, p2, options)      <- p1, p2 berbentuk [x, y] atau {x, y}
        // Opsi label: lihat _pasangLabelGaris        
        buatSegmen(a, b, c, d, e) {
            const arg = this._duaTitik(a, b, c, d, e);
            if (!arg) return this._gagal("buatSegmen: titik harus [x, y] atau {x, y} berisi angka");

            const { x1, y1, x2, y2, options } = arg;
            if (!this._semuaAngka(x1, y1, x2, y2)) return this._gagal("buatSegmen: x1, y1, x2, y2 harus angka");

            const line = this._el('line', { x1, y1, x2, y2 });
            this._applyOptions(line, options);
            this._tambah(line, 'shapes');
            return this._pasangLabelGaris(line, Number(x1), Number(y1), Number(x2), Number(y2), options);
        }

        // Garis Sejajar (Parallel Line)
        // refP1, refP2 adalah titik [x, y] pembentuk garis referensi.
        // passThroughOrDistance bisa berupa titik [px, py] yang dilalui, atau angka (jarak offset)
        buatGarisSejajar(refP1, refP2, passThroughOrDistance, options = {}) {
            const s = this._titikSejajar(refP1, refP2, passThroughOrDistance);
            if (!s) return this._gagal("buatGarisSejajar: titik acuan harus berbeda dan semua titik harus valid");
            return this.buatGaris(s.px, s.py, s.px + s.dx, s.py + s.dy, options);
        }

        // Titik di garis a-b yang paling dekat dengan titik p (kaki garis tinggi). Mengembalikan [x, y].
        hitungKakiTegakLurus(p, a, b) {
            const P = this._pt(p), A = this._pt(a), B = this._pt(b);
            if (!P || !A || !B) return this._gagal("hitungKakiTegakLurus: p, a, b harus [x, y] atau {x, y} berisi angka");
            const dx = B.x - A.x, dy = B.y - A.y;
            const kuadrat = dx * dx + dy * dy;
            if (kuadrat === 0) return this._gagal("hitungKakiTegakLurus: titik a dan b sama, garis tidak punya arah");
            const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / kuadrat;
            return [A.x + t * dx, A.y + t * dy];
        }
        // Garis (tak hingga) yang tegak lurus terhadap garis p1-p2.
        // lewat: 'tengah' (bawaan, jadi garis sumbu) ATAU titik [x, y] yang dilalui.
        buatGarisTegakLurus(p1, p2, lewat = 'tengah', options = {}) {
            const a = this._pt(p1), b = this._pt(p2);
            if (!a || !b) return this._gagal("buatGarisTegakLurus: p1 dan p2 harus [x, y] atau {x, y} berisi angka");
            const dx = b.x - a.x, dy = b.y - a.y;
            if (dx === 0 && dy === 0) return this._gagal("buatGarisTegakLurus: p1 dan p2 sama, garis acuan tidak punya arah");

            let t;
            if (lewat === 'tengah') {
                t = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            } else {
                t = this._pt(lewat);
                if (!t) return this._gagal("buatGarisTegakLurus: 'lewat' harus 'tengah' atau titik [x, y]");
            }
            return this.buatGaris(t.x, t.y, t.x - dy, t.y + dx, options);
        }

        // ===== GARIS BAGI SUDUT =====

        // Mengembalikan { titik: [x, y], arah: [ux, uy] }. arah = vektor satuan garis bagi.
        hitungGarisBagi(p1, vertex, p3) {
            const a = this._pt(p1), v = this._pt(vertex), c = this._pt(p3);
            if (!a || !v || !c) return this._gagal("hitungGarisBagi: p1, vertex, p3 harus [x, y] atau {x, y} berisi angka");

            const l1 = Math.hypot(a.x - v.x, a.y - v.y);
            const l2 = Math.hypot(c.x - v.x, c.y - v.y);
            if (l1 === 0 || l2 === 0) return this._gagal("hitungGarisBagi: titik sudut tidak boleh sama dengan titik lainnya");

            const u1x = (a.x - v.x) / l1, u1y = (a.y - v.y) / l1;
            const u2x = (c.x - v.x) / l2, u2y = (c.y - v.y) / l2;

            let sx = u1x + u2x, sy = u1y + u2y;
            let panjang = Math.hypot(sx, sy);
            if (panjang < 1e-9) { sx = -u1y; sy = u1x; panjang = 1; }   // sudut lurus 180°: garis bagi tegak lurus

            return { titik: [v.x, v.y], arah: [sx / panjang, sy / panjang] };
        }

        // Menggambar garis bagi (sebagai ruas yang mulai dari titik sudut).
        // options.panjang : panjang ruas (bawaan 100)
        // options.sampai  : garis/lingkaran tempat ruas berhenti, contoh: sampai: [B, C]
        buatGarisBagi(p1, vertex, p3, options = {}) {
            const g = this.hitungGarisBagi(p1, vertex, p3);
            if (!g) return null;

            let ujung;
            if (options.sampai) {
                const potong = this.hitungTitikPotong(
                    [g.titik, [g.titik[0] + g.arah[0], g.titik[1] + g.arah[1]]],
                    options.sampai
                );
                if (!potong || potong.length !== 1) {
                    return this._gagal("buatGarisBagi: garis bagi tidak memotong objek 'sampai' di satu titik");
                }
                ujung = potong[0];
            } else {
                const panjang = this._ada(options.panjang) ? Number(options.panjang) : 100;
                if (!(panjang > 0)) return this._gagal("buatGarisBagi: panjang harus angka lebih besar dari 0");
                ujung = [g.titik[0] + g.arah[0] * panjang, g.titik[1] + g.arah[1] * panjang];
            }
            return this.buatSegmen(g.titik[0], g.titik[1], ujung[0], ujung[1], options);
        }

        // ===== TITIK POTONG =====

        // Mengubah garis [p1, p2] atau lingkaran { pusat, r } menjadi bentuk yang seragam. Selain itu: null.
        _objekGeo(o) {
            if (o && !Array.isArray(o) && typeof o === 'object' && this._ada(o.r)) {
                const c = this._ada(o.pusat) ? this._pt(o.pusat) : this._pt([o.cx, o.cy]);
                const r = Number(o.r);
                if (c && Number.isFinite(r) && r > 0) return { tipe: 'lingkaran', c, r };
                return null;
            }
            if (Array.isArray(o) && o.length === 2) {
                const a = this._pt(o[0]), b = this._pt(o[1]);
                if (a && b && !(a.x === b.x && a.y === b.y)) return { tipe: 'garis', a, b };
            }
            return null;
        }

        _potongGarisGaris(A, B) {
            const d1x = A.b.x - A.a.x, d1y = A.b.y - A.a.y;
            const d2x = B.b.x - B.a.x, d2y = B.b.y - B.a.y;
            const det = d1x * d2y - d1y * d2x;
            // det mendekati 0 berarti kedua garis sejajar
            if (Math.abs(det) <= 1e-9 * Math.hypot(d1x, d1y) * Math.hypot(d2x, d2y)) return [];
            const t = ((B.a.x - A.a.x) * d2y - (B.a.y - A.a.y) * d2x) / det;
            return [{ x: A.a.x + t * d1x, y: A.a.y + t * d1y }];
        }

        _potongGarisLingkaran(G, C) {
            const dx = G.b.x - G.a.x, dy = G.b.y - G.a.y;
            const fx = G.a.x - C.c.x, fy = G.a.y - C.c.y;
            const a = dx * dx + dy * dy;
            const b = 2 * (fx * dx + fy * dy);
            const c = fx * fx + fy * fy - C.r * C.r;

            const diskriminan = b * b - 4 * a * c;
            const toleransi = 1e-9 * (b * b + 4 * a * Math.abs(c));
            if (diskriminan < -toleransi) return [];                       // garis tidak mengenai lingkaran

            const titikPada = t => ({ x: G.a.x + t * dx, y: G.a.y + t * dy });
            if (Math.abs(diskriminan) <= toleransi) return [titikPada(-b / (2 * a))];   // garis singgung

            const akar = Math.sqrt(diskriminan);
            return [titikPada((-b - akar) / (2 * a)), titikPada((-b + akar) / (2 * a))];
        }

        _potongLingkaranLingkaran(A, B) {
            const dx = B.c.x - A.c.x, dy = B.c.y - A.c.y;
            const d = Math.hypot(dx, dy);
            if (d === 0) return [];                                        // pusat sama: tidak ada titik potong
            const eps = 1e-9 * Math.max(d, A.r, B.r);
            if (d > A.r + B.r + eps || d < Math.abs(A.r - B.r) - eps) return [];   // terpisah atau satu di dalam yang lain

            const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d);
            const h2 = A.r * A.r - a * a;
            const h = h2 > 0 ? Math.sqrt(h2) : 0;
            const mx = A.c.x + a * dx / d, my = A.c.y + a * dy / d;

            if (h <= 1e-6 * Math.max(A.r, B.r)) return [{ x: mx, y: my }]; // saling menyinggung
            return [
                { x: mx - h * dy / d, y: my + h * dx / d },
                { x: mx + h * dy / d, y: my - h * dx / d }
            ];
        }

        // Apakah titik p berada di dalam ruas garis G (bukan di luar kedua ujungnya)?
        _dalamSegmen(p, G) {
            const dx = G.b.x - G.a.x, dy = G.b.y - G.a.y;
            const t = ((p.x - G.a.x) * dx + (p.y - G.a.y) * dy) / (dx * dx + dy * dy);
            return t >= -1e-9 && t <= 1 + 1e-9;
        }

        // Mengembalikan daftar titik potong [[x, y], ...]: 0, 1, atau 2 titik. null jika input salah.
        // options.segmen = true -> garis dianggap ruas (hanya antara kedua titiknya)
        hitungTitikPotong(objA, objB, options = {}) {
            const A = this._objekGeo(objA), B = this._objekGeo(objB);
            if (!A || !B) {
                return this._gagal("hitungTitikPotong: objek harus garis [p1, p2] atau lingkaran { pusat: [x, y], r }");
            }

            let hasil;
            if (A.tipe === 'garis' && B.tipe === 'garis') hasil = this._potongGarisGaris(A, B);
            else if (A.tipe === 'lingkaran' && B.tipe === 'lingkaran') hasil = this._potongLingkaranLingkaran(A, B);
            else hasil = (A.tipe === 'garis') ? this._potongGarisLingkaran(A, B) : this._potongGarisLingkaran(B, A);

            if (options && options.segmen === true) {
                hasil = hasil.filter(p => [A, B].every(o => o.tipe !== 'garis' || this._dalamSegmen(p, o)));
            }
            return hasil.map(p => [p.x, p.y]);
        }

        // Menggambar satu titik di tiap titik potong. Mengembalikan daftar elemen (bisa kosong).
        // options.label boleh berupa teks, atau daftar teks (satu per titik): label: ['C', 'D']
        buatTitikPotong(objA, objB, options = {}) {
            const titik = this.hitungTitikPotong(objA, objB, options);
            if (!titik) return null;
            return titik.map((p, i) => {
                const opsi = { ...options };
                if (Array.isArray(options.label)) opsi.label = options.label[i];
                return this.buatTitik(p, opsi);
            });
        }
        // Titik Potong Dua Garis (berdasarkan 4 titik)
        buatTitikPotongGaris(l1p1, l1p2, l2p1, l2p2, options = {}) {
            const p1 = this._pt(l1p1), p2 = this._pt(l1p2);
            const p3 = this._pt(l2p1), p4 = this._pt(l2p2);
            if (!p1 || !p2 || !p3 || !p4) return this._gagal("buatTitikPotongGaris: titik tidak valid");

            const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
            if (denom === 0) return null; // sejajar

            const x = ((p1.x * p2.y - p1.y * p2.x) * (p3.x - p4.x) - (p1.x - p2.x) * (p3.x * p4.y - p3.y * p4.x)) / denom;
            const y = ((p1.x * p2.y - p1.y * p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x * p4.y - p3.y * p4.x)) / denom;

            return this.buatTitik(x, y, options);
        }

        // Segmen Sejajar (Parallel Segment)
        // Akan membuat segmen yang panjang dan arahnya sama dengan referensi, 
        // atau panjangnya bisa diubah via options.length
        buatSegmenSejajar(refP1, refP2, passThroughOrDistance, options = {}) {
            const s = this._titikSejajar(refP1, refP2, passThroughOrDistance);
            if (!s) return this._gagal("buatSegmenSejajar: titik acuan harus berbeda dan semua titik harus valid");

            let x2 = s.px + s.dx;
            let y2 = s.py + s.dy;
            if (options.length !== undefined) {
                x2 = s.px + (s.dx / s.len) * options.length;
                y2 = s.py + (s.dy / s.len) * options.length;
            }
            return this.buatSegmen(s.px, s.py, x2, y2, options);
        }

        // Tanda Sama Panjang (Equal Length Tick Marks)
        // p1, p2 dapat berupa titik [x, y] / {x, y} atau angka (x1, y1, x2, y2)
        buatTandaSamaPanjang(p1, p2, p3, p4, options = {}) {
            let pt1, pt2, opts;
            if (typeof p1 === 'number' && typeof p2 === 'number') {
                pt1 = [p1, p2];
                pt2 = [p3, p4];
                opts = options || {};
            } else {
                pt1 = p1;
                pt2 = p2;
                opts = p3 || {};
            }
            opts = this._normalizeOptions(opts, GEOSVG_ALIAS.tandaSamaPanjang);

            const pointA = this._pt(pt1);
            const pointB = this._pt(pt2);
            if (!pointA || !pointB) return this._gagal("buatTandaSamaPanjang: titik harus [x, y] atau {x, y} berisi angka");

            const dx = pointB.x - pointA.x;
            const dy = pointB.y - pointA.y;
            const len = Math.hypot(dx, dy);

            if (len === 0) return null;

            const count = this._ada(opts.count) ? opts.count : 1;
            const size = this._ada(opts.size) ? opts.size : 10;
            const spacing = this._ada(opts.spacing) ? opts.spacing : 4;

            // Midpoint segmen
            const mx = (pointA.x + pointB.x) / 2;
            const my = (pointA.y + pointB.y) / 2;

            // Vektor arah segmen (unit vector)
            const ux = dx / len;
            const uy = dy / len;

            // Vektor tegak lurus segmen (perpendicular unit vector)
            const nx = -uy;
            const ny = ux;

            const halfSize = size / 2;
            const group = this._el('g');

            let d = "";
            for (let i = 0; i < count; i++) {
                const offset = (i - (count - 1) / 2) * spacing;
                const cx = mx + offset * ux;
                const cy = my + offset * uy;

                const x1 = cx - halfSize * nx;
                const y1 = cy - halfSize * ny;
                const x2 = cx + halfSize * nx;
                const y2 = cy + halfSize * ny;

                d += `M ${x1} ${y1} L ${x2} ${y2} `;
            }

            const path = this._el('path', { d: d.trim() });
            this._applyOptions(path, opts);
            group.appendChild(path);

            this._tambah(group, 'shapes');
            return group;
        }

        // Poligon
        buatPoligon(points, options = {}) {
            if (!Array.isArray(points) || points.length === 0 || points.some(p => !this._pt(p))) {
                return this._gagal("buatPoligon: points harus daftar titik [x, y] atau {x, y} berisi angka");
            }
            const ptsString = points.map(p => {
                const t = this._pt(p);
                return `${t.x},${t.y}`;
            }).join(" ");

            const polygon = this._el('polygon', { points: ptsString });
            this._applyOptions(polygon, options);
            this._tambah(polygon, 'shapes');

            if (options.sideLabels && Array.isArray(options.sideLabels)) {
                const group = this.buatGrup([polygon]);
                for (let i = 0; i < points.length; i++) {
                    if (!options.sideLabels[i]) continue;
                    const p1 = this._pt(points[i]);
                    const p2 = this._pt(points[(i + 1) % points.length]);
                    const mx = (p1.x + p2.x) / 2;
                    const my = (p1.y + p2.y) / 2;
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const angle = Math.atan2(dy, dx);

                    // offset label
                    const offset = options.labelOffset || 15;
                    const nx = -Math.sin(angle) * offset;
                    const ny = Math.cos(angle) * offset;

                    const text = this.buatTeks(mx + nx, my + ny, options.sideLabels[i], {
                        position: 'middle-center',
                        fontSize: options.labelFontSize || '12px',
                        fill: options.labelColor || options.stroke || 'black'
                    });
                    group.appendChild(text);
                }
                return group;
            }
            return polygon;
        }

        // ===== LABEL SISI =====

        // Menaruh label di tengah sisi p1-p2. teks kosong/null/'auto' -> tampil panjang sisi.
        // options:
        //   jarak   : jarak label dari sisi (bawaan 14)
        //   sisi    : 'kanan' (bawaan) atau 'kiri', dilihat dari arah p1 menuju p2 di layar
        //   pusat   : titik [x, y]; kalau diisi, label otomatis di sisi yang menjauhi titik ini
        //   skala   : pengali panjang untuk label otomatis (bawaan 1), desimal (bawaan 1), satuan (mis. ' cm')
        // Sisa opsi (fontSize, color, dst) diteruskan ke buatTeks.
        buatLabelSisi(p1, p2, teks, options = {}) {
            const a = this._pt(p1), b = this._pt(p2);
            if (!a || !b) return this._gagal("buatLabelSisi: p1 dan p2 harus [x, y] atau {x, y} berisi angka");

            const dx = b.x - a.x, dy = b.y - a.y;
            const panjang = Math.hypot(dx, dy);
            if (panjang === 0) return this._gagal("buatLabelSisi: p1 dan p2 sama, sisi tidak punya panjang");

            // Pisahkan opsi milik fitur ini dari opsi teks (...opsiTeks = "semua sisanya")
            const { jarak, sisi, pusat, skala, desimal, satuan, ...opsiTeks } = options;

            let isi = teks;
            if (isi === undefined || isi === null || isi === 'auto') {
                const nilai = panjang * (this._ada(skala) ? Number(skala) : 1);
                isi = String(this._bulat(nilai, this._ada(desimal) ? desimal : 1)) + (satuan || '');
            }

            const jr = this._ada(jarak) ? Number(jarak) : 14;

            // (-dy, dx) menunjuk ke sisi "kanan" di layar biasa, dan sisi "kiri" di mode yUp
            const tandaKanan = this._yUp ? -1 : 1;
            const tanda = (sisi === 'kiri') ? -tandaKanan : tandaKanan;
            let nx = tanda * (-dy / panjang), ny = tanda * (dx / panjang);

            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;

            if (this._ada(pusat)) {
                const c = this._pt(pusat);
                if (!c) return this._gagal("buatLabelSisi: pusat harus [x, y] atau {x, y} berisi angka");
                // Kalau arah label menuju pusat, balikkan
                if ((c.x - mx) * nx + (c.y - my) * ny > 0) { nx = -nx; ny = -ny; }
            }

            return this.buatTeks(mx + nx * jr, my + ny * jr, String(isi), { position: 'middle-center', ...opsiTeks });
        }

        // Label semua sisi poligon. daftarTeks[i] untuk sisi titik[i] -> titik[i+1].
        //   teks    -> dipakai apa adanya
        //   null    -> sisi itu dilewati
        //   kosong  -> otomatis panjang sisi (juga kalau daftarTeks tidak diberikan)
        buatLabelSisiPoligon(titik, daftarTeks, options = {}) {
            if (!Array.isArray(titik) || titik.length < 3) {
                return this._gagal("buatLabelSisiPoligon: titik harus berisi minimal 3 titik");
            }
            const p = titik.map(t => this._pt(t));
            if (p.some(t => !t)) return this._gagal("buatLabelSisiPoligon: semua titik harus [x, y] atau {x, y} berisi angka");

            // Pusat = rata-rata semua titik sudut
            const pusat = this._ada(options.pusat) ? options.pusat : [
                p.reduce((jumlah, t) => jumlah + t.x, 0) / p.length,
                p.reduce((jumlah, t) => jumlah + t.y, 0) / p.length
            ];

            const hasil = [];
            for (let i = 0; i < p.length; i++) {
                const teks = Array.isArray(daftarTeks) ? daftarTeks[i] : undefined;
                if (teks === null || teks === false) continue;
                const el = this.buatLabelSisi(p[i], p[(i + 1) % p.length], teks, { ...options, pusat });
                if (el) hasil.push(el);
            }
            return hasil;
        }

        // Polyline
        buatPolyline(points, options = {}) {
            if (!Array.isArray(points) || points.length === 0 || points.some(p => !this._pt(p))) {
                return this._gagal("buatPolyline: points harus daftar titik");
            }
            const ptsString = points.map(p => {
                const t = this._pt(p);
                return `${t.x},${t.y}`;
            }).join(" ");

            const polyline = this._el('polyline', { points: ptsString, fill: 'none' });
            this._applyOptions(polyline, options);
            if (options.panah === true) {
                const warna = options.stroke || this.svg.getAttribute('stroke') || 'black';
                polyline.setAttribute('marker-end', `url(#${this._getMarker(warna)})`);
            }
            this._tambah(polyline, 'shapes');
            return polyline;
        }

        // Mengenali dua bentuk pemanggilan segitiga:
        //   bentuk lama : (x1, y1, x2, y2, x3, y3, options)
        //   bentuk baru : (p1, p2, p3, options), titik boleh [x, y] atau {x, y}
        // Mengembalikan { titik: [t1, t2, t3], options }.
        _tigaTitik(a, b, c, d, e, f, g) {
            if (typeof a === 'number' || typeof a === 'string') {
                return { titik: [[a, b], [c, d], [e, f]], options: g || {} };
            }
            return { titik: [a, b, c], options: d || {} };
        }
        // Segitiga. Dua cara memanggil:
        //   buatSegitiga(x1, y1, x2, y2, x3, y3, options)
        //   buatSegitiga(p1, p2, p3, options)      <- tiap titik berbentuk [x, y] atau {x, y}
        buatSegitiga(a, b, c, d, e, f, g) {
            const { titik, options } = this._tigaTitik(a, b, c, d, e, f, g);

            const p = titik.map(t => this._pt(t));
            if (p.some(t => !t)) {
                return this._gagal("buatSegitiga: titik harus [x, y] atau {x, y} berisi angka");
            }
            return this.buatPoligon(p.map(t => [t.x, t.y]), options);
        }

        // ===== LINGKARAN LUAR DAN DALAM SEGITIGA =====

        // Mengembalikan { pusat: [x, y], r }. null jika ketiga titik segaris.
        hitungLingkaranLuar(p1, p2, p3) {
            const A = this._pt(p1), B = this._pt(p2), C = this._pt(p3);
            if (!A || !B || !C) return this._gagal("hitungLingkaranLuar: p1, p2, p3 harus [x, y] atau {x, y} berisi angka");

            const bx = B.x - A.x, by = B.y - A.y, cx = C.x - A.x, cy = C.y - A.y;
            const d = 2 * (bx * cy - by * cx);
            const skala = Math.hypot(bx, by) * Math.hypot(cx, cy);
            if (skala === 0 || Math.abs(d) <= 2e-9 * skala) {
                return this._gagal("hitungLingkaranLuar: ketiga titik segaris, tidak membentuk segitiga");
            }

            const b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
            const ux = (cy * b2 - by * c2) / d;
            const uy = (bx * c2 - cx * b2) / d;
            return { pusat: [A.x + ux, A.y + uy], r: Math.hypot(ux, uy) };
        }

        // Mengembalikan { pusat: [x, y], r }. null jika ketiga titik segaris.
        hitungLingkaranDalam(p1, p2, p3) {
            const A = this._pt(p1), B = this._pt(p2), C = this._pt(p3);
            if (!A || !B || !C) return this._gagal("hitungLingkaranDalam: p1, p2, p3 harus [x, y] atau {x, y} berisi angka");

            const a = Math.hypot(B.x - C.x, B.y - C.y);   // panjang sisi di depan A
            const b = Math.hypot(C.x - A.x, C.y - A.y);
            const c = Math.hypot(A.x - B.x, A.y - B.y);
            const keliling = a + b + c;
            const luasDua = Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x));   // 2 x luas

            if (keliling === 0 || luasDua <= 1e-9 * Math.max(a, b, c) ** 2) {
                return this._gagal("hitungLingkaranDalam: ketiga titik segaris, tidak membentuk segitiga");
            }
            return {
                pusat: [(a * A.x + b * B.x + c * C.x) / keliling, (a * A.y + b * B.y + c * C.y) / keliling],
                r: luasDua / keliling
            };
        }

        _lingkaranSegitiga(L, options) {
            if (!L) return null;
            const lingkaran = this.buatLingkaran(L.pusat[0], L.pusat[1], L.r, options);
            if (options.titikPusat === true && lingkaran) {
                this.buatTitik(L.pusat, { size: 3, color: options.stroke || 'black', label: options.labelPusat });
            }
            return lingkaran;
        }

        // options.titikPusat = true -> gambar juga titik pusat; options.labelPusat = nama titik pusat (mis. 'O')
        buatLingkaranLuar(p1, p2, p3, options = {}) {
            return this._lingkaranSegitiga(this.hitungLingkaranLuar(p1, p2, p3), options);
        }

        buatLingkaranDalam(p1, p2, p3, options = {}) {
            return this._lingkaranSegitiga(this.hitungLingkaranDalam(p1, p2, p3), options);
        }

        // Persegi panjang. Dua cara memanggil:
        //   buatPersegiPanjang(x, y, width, height, options)
        //   buatPersegiPanjang(titik, width, height, options)      <- titik berbentuk [x, y] atau {x, y}
        // (x, y) adalah sudut kiri atas di layar biasa.
        // Sudut membulat: options.radius (alias jariJari)
        //   angka >= 0  : jari-jari sudut. Nilai di atas setengah sisi terpendek dibatasi ke batas itu.
        //   'penuh'     : jari-jari terbesar (kapsul; pada persegi menjadi lingkaran)
        buatPersegiPanjang(...args) {
            const arg = this._bacaPusat(args, 2);
            if (!arg) return this._gagal("buatPersegiPanjang: titik harus [x, y] atau {x, y} berisi angka");

            let x = arg.cx, y = arg.cy;
            let [width, height] = arg.nilai;
            const options = arg.options;

            if (!this._semuaAngka(x, y, width, height) || Number(width) < 0 || Number(height) < 0) {
                return this._gagal("buatPersegiPanjang: titik, width, height harus angka, dan width/height tidak boleh negatif");
            }
            x = Number(x); y = Number(y); width = Number(width); height = Number(height);

            // Sudut membulat
            let radius = 0;
            const mentah = this._ada(options.radius) ? options.radius : options.jariJari;
            if (this._ada(mentah)) {
                const batas = Math.min(width, height) / 2;      // dua sudut pada satu sisi harus muat
                if (typeof mentah === 'string' && mentah.trim().toLowerCase() === 'penuh') {
                    radius = batas;
                } else if (this._semuaAngka(mentah) && Number(mentah) >= 0) {
                    radius = Math.min(Number(mentah), batas);
                } else {
                    this._gagal(`buatPersegiPanjang: radius harus angka >= 0 atau 'penuh', dapat: ${mentah}. Dipakai 0.`);
                }
            }

            const atribut = { x, y, width, height };
            if (radius > 0) { atribut.rx = radius; atribut.ry = radius; }   // rx = ry: sudut berbentuk busur lingkaran

            const rect = this._el('rect', atribut);
            this._applyOptions(rect, options);
            this._tambah(rect, 'shapes');
            return rect;
        }

        // Persegi. Dua cara memanggil:
        //   buatPersegi(x, y, sisi, options)
        //   buatPersegi(titik, sisi, options)      <- titik berbentuk [x, y] atau {x, y}
        buatPersegi(...args) {
            const arg = this._bacaPusat(args, 1);
            if (!arg) return this._gagal("buatPersegi: titik harus [x, y] atau {x, y} berisi angka");

            const [sisi] = arg.nilai;
            if (!this._semuaAngka(arg.cx, arg.cy, sisi) || Number(sisi) < 0) {
                return this._gagal("buatPersegi: titik dan sisi harus angka, dan sisi tidak boleh negatif");
            }
            return this.buatPersegiPanjang(arg.cx, arg.cy, sisi, sisi, arg.options);
        }

        // Lingkaran. Dua cara memanggil:
        //   buatLingkaran(cx, cy, r, options)
        //   buatLingkaran(pusat, r, options)      <- pusat berbentuk [x, y] atau {x, y}
        buatLingkaran(a, b, c, d) {
            let cx, cy, r, options;

            if (typeof a === 'number' || typeof a === 'string') {
                // Bentuk lama
                cx = a; cy = b; r = c; options = d || {};
            } else {
                // Bentuk baru
                const p = this._pt(a);
                if (!p) return this._gagal("buatLingkaran: pusat harus [x, y] atau {x, y} berisi angka");
                cx = p.x; cy = p.y; r = b; options = c || {};
            }

            if (!this._semuaAngka(cx, cy, r) || Number(r) < 0) {
                return this._gagal("buatLingkaran: pusat dan r harus angka, dan r tidak boleh negatif");
            }
            cx = Number(cx); cy = Number(cy); r = Number(r);

            const circle = this._el('circle', { cx, cy, r });
            this._applyOptions(circle, options);
            this._tambah(circle, 'shapes');
            return circle;
        }

        // Membaca pusat + nilai-nilai lain + options. Dua bentuk:
        //   lama : (cx, cy, v1, v2, ..., options)
        //   baru : (pusat, v1, v2, ..., options)     pusat = [x, y] atau {x, y}
        // jumlah = banyaknya nilai setelah pusat (mis. 3 untuk busur: r, startAngle, endAngle).
        // Mengembalikan { cx, cy, nilai: [...], options }, atau null jika pusatnya tidak valid.
        _bacaPusat(args, jumlah) {
            const a = args[0];
            if (typeof a === 'number' || typeof a === 'string') {
                return { cx: a, cy: args[1], nilai: args.slice(2, 2 + jumlah), options: args[2 + jumlah] || {} };
            }
            const p = this._pt(a);
            if (!p) return null;
            return { cx: p.x, cy: p.y, nilai: args.slice(1, 1 + jumlah), options: args[1 + jumlah] || {} };
        }
        // Elips. Dua cara memanggil:
        //   buatElips(cx, cy, rx, ry, options)
        //   buatElips(pusat, rx, ry, options)      <- pusat berbentuk [x, y] atau {x, y}
        buatElips(...args) {
            const arg = this._bacaPusat(args, 2);
            if (!arg) return this._gagal("buatElips: pusat harus [x, y] atau {x, y} berisi angka");

            let cx = arg.cx, cy = arg.cy;
            let [rx, ry] = arg.nilai;
            const options = arg.options;

            if (!this._semuaAngka(cx, cy, rx, ry) || Number(rx) < 0 || Number(ry) < 0) {
                return this._gagal("buatElips: pusat, rx, ry harus angka, dan rx/ry tidak boleh negatif");
            }
            cx = Number(cx); cy = Number(cy); rx = Number(rx); ry = Number(ry);

            const ellipse = this._el('ellipse', { cx, cy, rx, ry });
            this._applyOptions(ellipse, options);
            this._tambah(ellipse, 'shapes');
            return ellipse;
        }

        // Helper for polar to cartesian coordinates
        _polarToCartesian(centerX, centerY, radius, angleInDegrees) {
            const angleInRadians = angleInDegrees * Math.PI / 180.0;
            return {
                x: centerX + (radius * Math.cos(angleInRadians)),
                y: centerY + (radius * Math.sin(angleInRadians))
            };
        }

        // Busur Lingkaran. Sudut dalam DERAJAT. Dua cara memanggil:
        //   buatBusur(cx, cy, r, startAngle, endAngle, options)
        //   buatBusur(pusat, r, startAngle, endAngle, options)      <- pusat berbentuk [x, y] atau {x, y}
        // options.sweep: 1 (bawaan) = searah jarum jam, 0 = berlawanan jarum jam
        buatBusur(...args) {
            const arg = this._bacaPusat(args, 3);
            if (!arg) return this._gagal("buatBusur: pusat harus [x, y] atau {x, y} berisi angka");

            let cx = arg.cx, cy = arg.cy;
            let [r, startAngle, endAngle] = arg.nilai;
            const options = { ...arg.options };     // salin dulu: objek milik pemanggil tidak berubah

            if (!this._semuaAngka(cx, cy, r, startAngle, endAngle) || Number(r) <= 0) {
                return this._gagal("buatBusur: pusat, r, startAngle, endAngle harus angka, dan r harus lebih dari 0");
            }
            cx = Number(cx); cy = Number(cy); r = Number(r);
            startAngle = Number(startAngle); endAngle = Number(endAngle);

            const k = this._komponenBusur(cx, cy, r, startAngle, endAngle, options.sweep);
            const s = k.start;
            const dPath = k.penuh
                // 360° atau lebih: lingkaran penuh, dipecah jadi dua busur setengah lingkaran
                ? ["M", s.x, s.y, "A", r, r, 0, 0, k.sweep, k.tengah.x, k.tengah.y,
                    "A", r, r, 0, 0, k.sweep, s.x, s.y].join(" ")
                : ["M", s.x, s.y, "A", r, r, 0, k.besar, k.sweep, k.end.x, k.end.y].join(" ");

            const path = this._el('path', { d: dPath, fill: 'none' });
            this._applyOptions(path, options);
            this._tambah(path, 'shapes');
            return path;
        }

        // ===== JURING DAN TEMBERENG =====

        // Menghitung titik awal/akhir dan tanda busur. Sudut dalam derajat; sweep 1 = searah jarum jam (layar biasa).
        _komponenBusur(cx, cy, r, startAngle, endAngle, sweep = 1) {
            sweep = (sweep === 0 || sweep === false || sweep === 'ccw') ? 0 : 1;
            const selisih = (sweep === 1) ? (endAngle - startAngle) : (startAngle - endAngle);
            const start = this._polarToCartesian(cx, cy, r, startAngle);

            if (Math.abs(selisih) >= 360) {
                const tengah = this._polarToCartesian(cx, cy, r, startAngle + 180);
                return { penuh: true, sweep, start, tengah, besar: 0 };
            }
            const span = ((selisih % 360) + 360) % 360;
            const end = this._polarToCartesian(cx, cy, r, endAngle);
            return { penuh: false, sweep, start, end, span, besar: span > 180 ? 1 : 0 };
        }

        _bentukBusur(nama, jenis, cx, cy, r, startAngle, endAngle, options = {}) {
            if (!this._semuaAngka(cx, cy, r, startAngle, endAngle) || Number(r) <= 0) {
                return this._gagal(`${nama}: cx, cy, r, startAngle, endAngle harus angka, dan r harus lebih dari 0`);
            }
            cx = Number(cx); cy = Number(cy); r = Number(r);
            startAngle = Number(startAngle); endAngle = Number(endAngle);

            const k = this._komponenBusur(cx, cy, r, startAngle, endAngle, options.sweep);
            if (!k.penuh && k.span === 0) {
                return this._gagal(`${nama}: sudut awal dan akhir sama, tidak ada yang bisa digambar`);
            }

            const s = k.start;
            let d;
            if (k.penuh) {
                // 360° atau lebih: lingkaran penuh (dua setengah busur)
                d = ["M", s.x, s.y, "A", r, r, 0, 0, k.sweep, k.tengah.x, k.tengah.y,
                    "A", r, r, 0, 0, k.sweep, s.x, s.y, "Z"].join(" ");
            } else if (jenis === 'juring') {
                d = ["M", cx, cy, "L", s.x, s.y, "A", r, r, 0, k.besar, k.sweep, k.end.x, k.end.y, "Z"].join(" ");
            } else {
                d = ["M", s.x, s.y, "A", r, r, 0, k.besar, k.sweep, k.end.x, k.end.y, "Z"].join(" ");
            }

            const path = this._el('path', { d, fill: 'none' });
            this._applyOptions(path, options);
            this._tambah(path, 'shapes');
            return path;
        }

        // Juring (potongan kue). Dua cara memanggil:
        //   buatJuring(cx, cy, r, startAngle, endAngle, options)
        //   buatJuring(pusat, r, startAngle, endAngle, options)      <- pusat berbentuk [x, y] atau {x, y}
        buatJuring(...args) {
            const arg = this._bacaPusat(args, 3);
            if (!arg) return this._gagal("buatJuring: pusat harus [x, y] atau {x, y} berisi angka");
            const [r, startAngle, endAngle] = arg.nilai;
            return this._bentukBusur('buatJuring', 'juring', arg.cx, arg.cy, r, startAngle, endAngle, arg.options);
        }

        // Tembereng (daerah antara busur dan tali busur). Bentuk pemanggilan sama dengan buatJuring.
        buatTembereng(...args) {
            const arg = this._bacaPusat(args, 3);
            if (!arg) return this._gagal("buatTembereng: pusat harus [x, y] atau {x, y} berisi angka");
            const [r, startAngle, endAngle] = arg.nilai;
            return this._bentukBusur('buatTembereng', 'tembereng', arg.cx, arg.cy, r, startAngle, endAngle, arg.options);
        }

        // Setengah lingkaran dengan diameter = garis antara dua titik ujung.
        // Dua cara memanggil:
        //   buatSetengahLingkaran(x1, y1, x2, y2, options)
        //   buatSetengahLingkaran(p1, p2, options)     <- p1, p2 berbentuk [x, y] atau {x, y}
        // options:
        //   tutup : true (bawaan) = garis diameter ikut digambar; false = hanya busur
        //   sisi  : 'kiri' (bawaan) atau 'kanan' = sisi tempat busur menggembung,
        //           dilihat dari arah p1 menuju p2 di layar
        // Opsi gaya lain (stroke, fill, strokeWidth, opacity, dashed, dst) berlaku seperti bentuk lain.
        buatSetengahLingkaran(a, b, c, d, e) {
            const arg = this._duaTitik(a, b, c, d, e);
            if (!arg) return this._gagal("buatSetengahLingkaran: titik harus [x, y] atau {x, y} berisi angka");

            let { x1, y1, x2, y2, options } = arg;
            if (!this._semuaAngka(x1, y1, x2, y2)) {
                return this._gagal("buatSetengahLingkaran: x1, y1, x2, y2 harus angka");
            }
            x1 = Number(x1); y1 = Number(y1); x2 = Number(x2); y2 = Number(y2);

            const diameter = Math.hypot(x2 - x1, y2 - y1);
            if (diameter === 0) {
                return this._gagal("buatSetengahLingkaran: kedua titik ujung sama, diameter tidak boleh 0");
            }

            const sisi = this._ada(options.sisi) ? options.sisi : 'kiri';
            if (sisi !== 'kiri' && sisi !== 'kanan') {
                return this._gagal(`buatSetengahLingkaran: sisi '${sisi}' tidak dikenal. Pilihan: kiri, kanan`);
            }

            // Di layar biasa, busur searah jarum jam (sweep 1) menggembung ke kiri arah p1 -> p2.
            // Di mode yUp seluruh lapisan dibalik, jadi nilainya ikut dibalik.
            const sweepKiri = this._yUp ? 0 : 1;
            const sweep = (sisi === 'kiri') ? sweepKiri : 1 - sweepKiri;

            const r = diameter / 2;
            const tutup = options.tutup !== false;     // hanya false yang membuat busur terbuka
            const dPath = `M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}` + (tutup ? ' Z' : '');

            const path = this._el('path', { d: dPath, fill: 'none' });
            this._applyOptions(path, options);
            this._tambah(path, 'shapes');
            return path;
        }

        // Besar sudut dalam derajat (0 sampai 180; atau 180 sampai 360 dengan refleks: true).
        // options.desimal: jumlah angka di belakang koma (bawaan 2)
        hitungSudut(p1, vertex, p3, options = {}) {
            const a = this._pt(p1), v = this._pt(vertex), c = this._pt(p3);
            if (!a || !v || !c) return this._gagal("hitungSudut: p1, vertex, p3 harus [x, y] atau {x, y} berisi angka");
            if ((a.x === v.x && a.y === v.y) || (c.x === v.x && c.y === v.y)) {
                return this._gagal("hitungSudut: titik sudut tidak boleh sama dengan titik lainnya");
            }

            const a1 = Math.atan2(a.y - v.y, a.x - v.x);
            const a2 = Math.atan2(c.y - v.y, c.x - v.x);
            const selisih = Math.abs(this._normalSudut(a2 - a1));

            let derajat = selisih * 180 / Math.PI;
            if (options.refleks === true && selisih > 1e-9) derajat = 360 - derajat;
            return this._bulat(derajat, this._ada(options.desimal) ? options.desimal : 2);
        }
        // Sudut (Angle) dari 3 titik. p2 adalah titik sudut (vertex)
        buatSudut(p1, p2, p3, options = {}) {
            options = this._normalizeOptions(options, GEOSVG_ALIAS.sudut);
            const a = this._pt(p1);
            const v = this._pt(p2);   // titik sudut (vertex)
            const c = this._pt(p3);
            if (!a || !v || !c) return this._gagal("buatSudut: p1, p2, p3 harus [x, y] atau {x, y} berisi angka");
            if ((a.x === v.x && a.y === v.y) || (c.x === v.x && c.y === v.y)) {
                return this._gagal("buatSudut: titik sudut (p2) tidak boleh sama dengan p1 atau p3");
            }

            const r = options.radius || 30;   // ukuran wilayah lengkungan

            const a1 = Math.atan2(a.y - v.y, a.x - v.x);
            const a2 = Math.atan2(c.y - v.y, c.x - v.x);

            let diff = this._normalSudut(a2 - a1);
            // Sudut refleks: ambil "jalan memutar" yang panjang (kecuali kalau kedua lengan berimpit)
            if (options.refleks === true && Math.abs(diff) > 1e-9) {
                diff = diff > 0 ? diff - 2 * Math.PI : diff + 2 * Math.PI;
            }
            const sweepFlag = diff > 0 ? 1 : 0;
            const besarFlag = Math.abs(diff) > Math.PI ? 1 : 0;   // 1 = busur lebih dari 180°

            const xA = v.x + r * Math.cos(a1);
            const yA = v.y + r * Math.sin(a1);
            const xB = v.x + r * Math.cos(a2);
            const yB = v.y + r * Math.sin(a2);

            const group = this._el('g');
            const d = ["M", v.x, v.y, "L", xA, yA, "A", r, r, 0, besarFlag, sweepFlag, xB, yB, "Z"].join(" ");
            const path = this._el('path', { d }, group);

            const pathOptions = { ...options };
            if (typeof pathOptions.fill === 'undefined') pathOptions.fill = "rgba(0, 0, 0, 0.1)";   // semi-transparan
            this._applyOptions(path, pathOptions);

            this._tambahLabelSudut(group, v.x, v.y, a1, diff, r, options);

            this._tambah(group, 'shapes');
            return group;
        }

        // Indikator Sudut Siku-Siku. p2 adalah titik sudut (vertex).
        // Bisa dipanggil: buatSiku(p1, p2, p3, opsi) atau buatSiku(x1, y1, x2, y2, x3, y3, opsi)
        buatSiku(p1, p2, p3, options = {}) {
            let pt1, pt2, pt3, opts;
            if (typeof p1 === 'number' && typeof p2 === 'number') {
                pt1 = [p1, p2];
                pt2 = [arguments[2], arguments[3]];
                pt3 = [arguments[4], arguments[5]];
                opts = arguments[6] || {};
            } else {
                pt1 = p1;
                pt2 = p2;
                pt3 = p3;
                opts = options || {};
            }
            opts = this._normalizeOptions(opts, GEOSVG_ALIAS.siku);

            const pA = this._pt(pt1);
            const pV = this._pt(pt2); // Vertex (titik sudut)
            const pB = this._pt(pt3);
            if (!pA || !pV || !pB) return this._gagal("buatSiku: titik harus [x, y] atau {x, y} berisi angka");

            const dx1 = pA.x - pV.x, dy1 = pA.y - pV.y;
            const dx2 = pB.x - pV.x, dy2 = pB.y - pV.y;
            const len1 = Math.hypot(dx1, dy1);
            const len2 = Math.hypot(dx2, dy2);
            if (len1 === 0 || len2 === 0) {
                return this._gagal("buatSiku: titik sudut tidak boleh sama dengan titik lainnya");
            }

            const size = opts.size || 15;

            // Vektor satuan dari vertex ke pA dan pB
            const u1x = dx1 / len1, u1y = dy1 / len1;
            const u2x = dx2 / len2, u2y = dy2 / len2;

            // Titik-titik pembentuk simbol siku-siku (persegi pada sudut)
            const xA = pV.x + size * u1x, yA = pV.y + size * u1y;
            const xC = pV.x + size * u2x, yC = pV.y + size * u2y;
            const xB = xA + size * u2x, yB = yA + size * u2y;

            const group = this._el('g');

            const d = (opts.fill && opts.fill !== 'none')
                ? `M ${pV.x} ${pV.y} L ${xA} ${yA} L ${xB} ${yB} L ${xC} ${yC} Z`
                : `M ${xA} ${yA} L ${xB} ${yB} L ${xC} ${yC}`;
            const path = this._el('path', { d }, group);

            const pathOptions = { ...opts };
            if (typeof pathOptions.fill === 'undefined') pathOptions.fill = "none";
            this._applyOptions(path, pathOptions);

            // Titik kecil di tengah siku-siku (opsional)
            if (opts.dot) {
                this._el('circle', {
                    cx: pV.x + (size / 2) * (u1x + u2x),
                    cy: pV.y + (size / 2) * (u1y + u2y),
                    r: opts.dotRadius || 1.5,
                    fill: pathOptions.stroke || "black",
                    stroke: 'none'
                }, group);
            }

            // Label (opsional)
            const a1 = Math.atan2(dy1, dx1);
            const a2 = Math.atan2(dy2, dx2);
            this._tambahLabelSudut(group, pV.x, pV.y, a1, this._normalSudut(a2 - a1), size, opts);

            this._tambah(group, 'shapes');
            return group;
        }

        // Teks (Text)
        buatTeks(x, y, textContent, options = {}) {
            if (Array.isArray(x)) {
                options = textContent || {};
                textContent = y;
                y = x[1];
                x = x[0];
            }
            if (!this._semuaAngka(x, y)) return this._gagal("buatTeks: x dan y harus angka");
            if (textContent === undefined || textContent === null) return this._gagal("buatTeks: teks tidak boleh kosong");

            options = this._normalizeOptions(options, GEOSVG_ALIAS.teks);   // color -> fill

            const text = this._el('text', { x, y, fill: options.fill || 'black' });
            text.textContent = textContent;

            this._terapkanFont(text, options);
            this._applyTextAlignment(text, options.position);

            // Teks tidak punya garis tepi, kecuali diminta
            this._applyOptions(text, { ...options, stroke: options.stroke || 'none' });
            this._tegakkanTeks(text);
            this._tambah(text, 'labels');
            return text;
        }

        // LaTeX (KaTeX atau MathJax)
        // Hasilnya punya properti .ready (Promise) yang selesai setelah rumus dirender dan diposisikan.
        buatLatex(x, y, latexString, options = {}) {
            if (Array.isArray(x)) {
                options = latexString || {};
                latexString = y;
                y = x[1];
                x = x[0];
            }
            if (!this._semuaAngka(x, y)) return this._gagal("buatLatex: x dan y harus angka");
            if (latexString === undefined || latexString === null || String(latexString).trim() === '') {
                return this._gagal("buatLatex: teks LaTeX tidak boleh kosong");
            }
            latexString = String(latexString);

            const foreignObject = this._el("foreignObject", { x: x, y: y, width: options.width || 500, height: options.height || 200 });
            foreignObject.style.overflow = "visible";

            const div = document.createElement("div");
            div.style.display = "inline-block";
            div.style.whiteSpace = "nowrap";      // rumus panjang tidak terlipat
            div.style.color = options.color || "black";
            if (this._ada(options.opacity)) div.style.opacity = options.opacity;
            if (options.fontSize) div.style.fontSize = options.fontSize;

            const isDisplay = options.displayMode || false;
            div.textContent = isDisplay ? `\\[ ${latexString} \\]` : `\\( ${latexString} \\)`;

            foreignObject.appendChild(div);
            this._tambah(foreignObject, 'labels');

            const props = this._getAlignmentProps(options.position || 'top-right');

            const adjustPosition = () => {
                const w = div.scrollWidth + 2;
                const h = div.scrollHeight + 2;
                foreignObject.setAttribute("width", w);
                foreignObject.setAttribute("height", h);
                foreignObject.setAttribute("x", x - (w * props.alignX));

                if (this._yUp) {
                    // Kotak ditaruh sehingga, setelah lapisan dibalik, muncul di sisi yang diminta.
                    // Lalu isinya dibalik sekali lagi terhadap garis tengah kotaknya sendiri.
                    const fy = y - h * (1 - props.alignY);
                    foreignObject.setAttribute("y", fy);
                    foreignObject.setAttribute("transform", `translate(0 ${2 * fy + h}) scale(1 -1)`);
                } else {
                    foreignObject.setAttribute("y", y - (h * props.alignY));
                }
            };

            // Tahap 1: render rumus. Selalu mengembalikan Promise.
            const render = () => {
                if (window.katex) {
                    katex.render(latexString, div, { displayMode: isDisplay, throwOnError: false });
                    return Promise.resolve();
                }
                if (window.MathJax && MathJax.typesetPromise) {
                    return MathJax.typesetPromise([div]);
                }
                if (window.MathJax && window.MathJax.Hub) {
                    return new Promise(selesai => window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, div], selesai));
                }
                console.warn("GeoSVG: KaTeX atau MathJax tidak ditemukan. Muat salah satunya di halaman HTML Anda.");
                return Promise.resolve();
            };

            // Tahap 2: tunggu font selesai dimuat, baru ukur dan posisikan
            foreignObject.ready = Promise.resolve()
                .then(render)
                .then(() => (document.fonts && document.fonts.ready) ? document.fonts.ready : null)
                .then(adjustPosition)
                .catch(err => {
                    console.warn("GeoSVG: gagal merender LaTeX:", err);
                    adjustPosition();
                });

            return foreignObject;
        }

        // Buat Pola Arsir (Fill Pattern)
        buatPolaArsir(id, tipe = 'miring', options = {}) {
            const TIPE_VALID = ['miring', 'vertikal', 'horizontal', 'silang'];
            if (!TIPE_VALID.includes(tipe)) {
                return this._gagal(`buatPolaArsir: tipe '${tipe}' tidak dikenal. Pilihan: ${TIPE_VALID.join(', ')}`);
            }
            options = this._normalizeOptions(options, GEOSVG_ALIAS.polaArsir);

            // Hapus pola lama yang ber-ID sama di instance ini
            const lama = Array.from(this.defs.children).find(el => el.id === id);
            if (lama) lama.remove();

            const size = options.size || 10;
            const stroke = options.stroke || "black";
            const strokeWidth = this._ada(options.strokeWidth) ? options.strokeWidth : 1;

            // Bentuk garis arsir untuk tiap tipe
            const bentuk = {
                miring: `M 0,${size} l ${size},-${size} M -${size / 4},${size / 4} l ${size / 2},-${size / 2} M ${size * 3 / 4},${size * 5 / 4} l ${size / 2},-${size / 2}`,
                vertikal: `M ${size / 2},0 l 0,${size}`,
                horizontal: `M 0,${size / 2} l ${size},0`,
                silang: `M 0,0 l ${size},${size} M 0,${size} l ${size},-${size}`
            };

            const pattern = this._el('pattern', {
                id,
                patternUnits: 'userSpaceOnUse',
                width: size,
                height: size,
                patternTransform: this._yUp ? `matrix(1 0 0 -1 0 ${size})` : undefined
            }, this.defs);

            this._el('path', {
                d: bentuk[tipe],
                stroke,
                'stroke-width': strokeWidth,
                fill: 'none'
            }, pattern);

            return pattern;
        }

        // Panah. Dua cara memanggil: buatVektor(x1, y1, x2, y2, options) atau buatVektor(p1, p2, options)
        buatVektor(a, b, c, d, e) {
            const arg = this._duaTitik(a, b, c, d, e);
            if (!arg) return this._gagal("buatVektor: titik harus [x, y] atau {x, y} berisi angka");

            const { x1, y1, x2, y2, options } = arg;

            // Label ditambahkan SETELAH panah terpasang, jadi dikeluarkan dari opsi untuk buatSegmen
            const opsiGaris = { ...options };
            delete opsiGaris.label;
            const line = this.buatSegmen(x1, y1, x2, y2, opsiGaris);
            if (!line) return null;

            const color = options.stroke || this.svg.getAttribute('stroke') || 'black';
            line.setAttribute("marker-end", `url(#${this._getMarker(color)})`);
            return this._pasangLabelGaris(line, Number(x1), Number(y1), Number(x2), Number(y2), options);
        }

        // ===== GRAFIK FUNGSI =====

        // Menggambar y = f(x) untuk x dari xMin sampai xMax.
        // options:
        //   langkah       : jumlah potongan (bawaan 200)
        //   skala         : pengali satuan -> piksel untuk x dan y (bawaan 1); skalaX / skalaY untuk salah satu saja
        //   maksLompatan  : selisih y layar terbesar antar dua titik berurutan sebelum garis diputus (bawaan: tinggi gambar)
        buatFungsi(f, xMin, xMax, options = {}) {
            if (typeof f !== 'function') return this._gagal("buatFungsi: f harus berupa fungsi, contoh: x => x * x");
            if (!this._semuaAngka(xMin, xMax) || Number(xMin) >= Number(xMax)) {
                return this._gagal("buatFungsi: xMin dan xMax harus angka, dan xMin harus lebih kecil dari xMax");
            }
            xMin = Number(xMin); xMax = Number(xMax);

            const langkah = this._ada(options.langkah) ? Math.floor(Number(options.langkah)) : 200;
            if (!Number.isFinite(langkah) || langkah < 1) return this._gagal("buatFungsi: langkah harus bilangan bulat >= 1");
            this._cekJumlah(langkah, 'titik fungsi');

            const dasar = this._ada(options.skala) ? Number(options.skala) : 1;
            const sx = this._ada(options.skalaX) ? Number(options.skalaX) : dasar;
            const sy = this._ada(options.skalaY) ? Number(options.skalaY) : dasar;
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx === 0 || sy === 0) {
                return this._gagal("buatFungsi: skala harus angka dan tidak boleh 0");
            }

            const area = this._getAreaGambar();
            const batasBawah = area.minY - area.h;          // satu tinggi gambar di luar area terlihat
            const batasAtas = area.minY + 2 * area.h;
            const maksLompatan = this._ada(options.maksLompatan) ? Number(options.maksLompatan) : area.h;
            const arah = this._yUp ? 1 : -1;                // layar biasa: y dibalik agar positif = atas

            let d = '';
            let sebelumnya = null;                          // y layar titik sebelumnya (null = garis sedang terputus)

            for (let i = 0; i <= langkah; i++) {
                const x = xMin + i * (xMax - xMin) / langkah;     // berindeks: tidak ada akumulasi galat desimal
                let y;
                try { y = f(x); } catch (e) { y = NaN; }

                const ys = arah * y * sy;
                const sah = typeof y === 'number' && Number.isFinite(ys) && ys >= batasBawah && ys <= batasAtas;
                if (!sah) { sebelumnya = null; continue; }

                const putus = sebelumnya === null || Math.abs(ys - sebelumnya) > maksLompatan;
                d += `${putus ? 'M' : 'L'}${this._bulat(x * sx)} ${this._bulat(ys)}`;
                sebelumnya = ys;
            }

            if (d === '') return this._gagal("buatFungsi: tidak ada titik yang bisa digambar. Periksa fungsi dan rentang x.");

            const path = this._el('path', { d, fill: 'none' });
            this._applyOptions(path, options);
            this._tambah(path, 'shapes');
            return path;
        }

        // Poligon Beraturan. Dua cara memanggil:
        //   buatPoligonBeraturan(cx, cy, radius, sides, options)
        //   buatPoligonBeraturan(pusat, radius, sides, options)      <- pusat berbentuk [x, y] atau {x, y}
        // options.startAngle dalam DERAJAT. Bawaan: titik sudut pertama di atas (-90 di mode biasa, 90 di mode yUp).
        buatPoligonBeraturan(...args) {
            const arg = this._bacaPusat(args, 2);
            if (!arg) return this._gagal("buatPoligonBeraturan: pusat harus [x, y] atau {x, y} berisi angka");

            let cx = arg.cx, cy = arg.cy;
            let [radius, sides] = arg.nilai;
            const options = arg.options;

            if (!this._semuaAngka(cx, cy, radius) || Number(radius) <= 0) {
                return this._gagal("buatPoligonBeraturan: pusat dan radius harus angka, dan radius harus lebih dari 0");
            }
            cx = Number(cx); cy = Number(cy); radius = Number(radius);

            // Poligon minimal punya 3 sisi
            sides = Math.floor(Number(sides));
            if (!Number.isFinite(sides) || sides < 3) {
                return this._gagal(`buatPoligonBeraturan: sides harus bilangan bulat >= 3, dapat: ${sides}`);
            }

            const bawaan = this._yUp ? 90 : -90;
            const mulaiDerajat = (options.startAngle !== undefined) ? options.startAngle : bawaan;
            const offset = mulaiDerajat * Math.PI / 180;   // derajat -> radian

            const points = [];
            for (let i = 0; i < sides; i++) {
                const angle = offset + (i * 2 * Math.PI / sides);
                points.push({
                    x: cx + radius * Math.cos(angle),
                    y: cy + radius * Math.sin(angle)
                });
            }
            return this.buatPoligon(points, options);
        }

        // Kurva Bezier
        buatKurvaBezier(points, options = {}) {
            options = { ...options };   // salin dulu (perbaikan nomor 8)
            if (!Array.isArray(points) || points.length < 2) {
                return this._gagal("buatKurvaBezier: butuh minimal 2 titik");
            }
            const p = points.map(t => this._pt(t));
            if (p.some(t => !t)) {
                return this._gagal("buatKurvaBezier: semua titik harus [x, y] atau {x, y} berisi angka");
            }

            let d = `M ${p[0].x},${p[0].y} `;
            if (p.length === 3) {
                d += `Q ${p[1].x},${p[1].y} ${p[2].x},${p[2].y}`;                          // kuadratik
            } else if (p.length >= 4) {
                d += `C ${p[1].x},${p[1].y} ${p[2].x},${p[2].y} ${p[3].x},${p[3].y}`;      // kubik
            } else {
                d += `L ${p[1].x},${p[1].y}`;                                              // 2 titik: garis
            }

            const path = this._el('path', { d });
            if (!options.fill) options.fill = 'none';
            this._applyOptions(path, options);
            this._tambah(path, 'shapes');
            return path;
        }

        // Kurva Halus (Smooth Curve / Spline) melewati banyak titik seperti Excel
        buatKurvaHalus(points, options = {}) {
            options = { ...options };
            if (!Array.isArray(points) || points.length < 2) {
                return this._gagal("buatKurvaHalus: butuh minimal 2 titik");
            }
            const p = points.map(t => this._pt(t));
            if (p.some(t => !t)) {
                return this._gagal("buatKurvaHalus: semua titik harus [x, y] atau {x, y} berisi angka");
            }

            // Jika hanya 2 titik, buat garis lurus
            if (p.length === 2) {
                return this.buatSegmen(p[0].x, p[0].y, p[1].x, p[1].y, options);
            }

            // tension: mengatur seberapa "melengkung" garisnya (0 = kaku seperti garis lurus, 0.2 hingga 0.3 = halus seperti Excel)
            const tension = this._ada(options.tension) ? options.tension : 0.2;
            let d = `M ${p[0].x},${p[0].y} `;

            for (let i = 0; i < p.length - 1; i++) {
                const p0 = i === 0 ? p[0] : p[i - 1]; // Titik sebelumnya (atau diri sendiri jika awal)
                const p1 = p[i];                      // Titik saat ini
                const p2 = p[i + 1];                  // Titik berikutnya
                const p3 = i + 2 < p.length ? p[i + 2] : p2; // Titik setelah berikutnya

                // Menghitung Titik Kontrol (Control Points) Bezier
                const cp1x = p1.x + (p2.x - p0.x) * tension;
                const cp1y = p1.y + (p2.y - p0.y) * tension;

                const cp2x = p2.x - (p3.x - p1.x) * tension;
                const cp2y = p2.y - (p3.y - p1.y) * tension;

                // Tambahkan perintah kurva Bezier Kubik (C) yang menyambung
                d += `C ${this._bulat(cp1x)},${this._bulat(cp1y)} ${this._bulat(cp2x)},${this._bulat(cp2y)} ${p2.x},${p2.y} `;
            }

            const path = this._el('path', { d: d.trim() });
            if (typeof options.fill === 'undefined') options.fill = 'none';
            this._applyOptions(path, options);
            this._tambah(path, 'shapes');
            return path;
        }

        // ===== GARIS SINGGUNG LINGKARAN =====

        // Titik singgung dari sebuah titik ke lingkaran. Mengembalikan [[x, y], ...]:
        //   titik di luar lingkaran   -> 2 titik, urutan [kiri, kanan] (dilihat di layar dari pusat menuju titik)
        //   titik tepat di lingkaran  -> 1 titik (titik itu sendiri)
        //   titik di dalam lingkaran  -> [] (tidak ada garis singgung)
        // null jika input salah.
        hitungTitikSinggung(lingkaran, titik) {
            const L = this._objekGeo(lingkaran);
            if (!L || L.tipe !== 'lingkaran') {
                return this._gagal("hitungTitikSinggung: lingkaran harus { pusat: [x, y], r } atau { cx, cy, r }");
            }
            const P = this._pt(titik);
            if (!P) return this._gagal("hitungTitikSinggung: titik harus [x, y] atau {x, y} berisi angka");

            const dx = P.x - L.c.x, dy = P.y - L.c.y;
            const d = Math.hypot(dx, dy);
            const eps = 1e-9 * Math.max(1, L.r, d);

            if (d < L.r - eps) return [];                      // titik di dalam lingkaran
            if (d <= L.r + eps) return [[P.x, P.y]];           // titik tepat di lingkaran

            // Titik singgung ada di "garis kutub": a dari pusat ke arah titik, lalu h ke samping
            const a = L.r * L.r / d;
            const h = L.r * Math.sqrt(d * d - L.r * L.r) / d;
            const mx = L.c.x + a * dx / d, my = L.c.y + a * dy / d;

            // Arah ke KIRI (dilihat di layar) dari pusat menuju titik
            const s = this._yUp ? -1 : 1;
            const kx = s * dy / d, ky = s * -dx / d;

            return [[mx + h * kx, my + h * ky], [mx - h * kx, my - h * ky]];
        }

        // ===== GARIS SINGGUNG PERSEKUTUAN DUA LINGKARAN =====

        // Menghitung garis singgung persekutuan. Mengembalikan daftar { jenis, t1, t2, arah, satu, lado }:
        //   t1 / t2 = titik singgung di lingkaran 1 / 2,  arah = vektor satuan sepanjang garis,
        //   satu = true kalau kedua titik singgung berimpit (lingkaran saling bersinggung).
        // L1 dan L2 berasal dari _objekGeo. jenis: 'luar' | 'dalam' | 'semua'.
        _singgungPersekutuan(L1, L2, jenis) {
            const dx = L2.c.x - L1.c.x, dy = L2.c.y - L1.c.y;
            const d = Math.hypot(dx, dy);
            if (d === 0) return [];                               // sepusat: tidak ada garis singgung persekutuan

            const ux = dx / d, uy = dy / d;                       // arah dari pusat 1 ke pusat 2
            const wx = -uy, wy = ux;                              // tegak lurus u

            // Arah ke KIRI (dilihat di layar) dari pusat 1 menuju pusat 2
            const s = this._yUp ? -1 : 1;
            const kiri = [s * dy / d, s * -dx / d];

            const hasil = [];
            for (const jns of (jenis === 'semua' ? ['luar', 'dalam'] : [jenis])) {
                // Normal garis n memenuhi: n . (pusat2 - pusat1) = s2*r2 - r1
                // (s2 = +1 untuk garis luar, -1 untuk garis dalam)
                const s2 = jns === 'luar' ? 1 : -1;
                const cosT = (s2 * L2.r - L1.r) / d;
                if (Math.abs(cosT) > 1 + 1e-9) continue;          // jenis ini tidak ada untuk kedua lingkaran

                const c = Math.max(-1, Math.min(1, cosT));
                const sin2 = 1 - c * c;
                const sin = sin2 > 1e-12 ? Math.sqrt(sin2) : 0;   // 0 = lingkaran bersinggung: hanya satu garis
                const tanda = sin === 0 ? [1] : [1, -1];

                const grup = tanda.map(sg => {
                    const nx = c * ux + sg * sin * wx, ny = c * uy + sg * sin * wy;
                    const t1 = [L1.c.x - L1.r * nx, L1.c.y - L1.r * ny];
                    const t2 = [L2.c.x - s2 * L2.r * nx, L2.c.y - s2 * L2.r * ny];
                    return {
                        jenis: jns, t1, t2,
                        arah: [-ny, nx],
                        satu: sin === 0,
                        lado: (t1[0] - L1.c.x) * kiri[0] + (t1[1] - L1.c.y) * kiri[1]
                    };
                });
                grup.sort((p, q) => q.lado - p.lado);             // kiri dulu, lalu kanan
                hasil.push(...grup);
            }
            return hasil;
        }

        // Menggambar garis singgung dari sebuah titik ke lingkaran. Mengembalikan DAFTAR elemen (0, 1, atau 2).
        // Semua opsi buatGaris berlaku (stroke, strokeWidth, dashed, label, clipPad, dst). Opsi tambahan:
        //   bentuk        : 'garis' (bawaan, tak hingga) | 'segmen' (titik -> titik singgung) | 'sinar'
        //   pilih         : 'semua' (bawaan) | 'kiri' | 'kanan'  (dilihat di layar dari pusat lingkaran menghadap titik)
        //   titikSinggung : true = gambar juga titik di titik singgung (hanya untuk garis yang tampil)
        //   labelTitik    : daftar label titik singgung, mis. ['A', 'B']  (indeks 0 = kiri, 1 = kanan)
        // options.label boleh teks (dipakai untuk semua garis yang tampil) atau daftar (indeks 0 = kiri, 1 = kanan).
        buatGarisSinggung(lingkaran, titik, options = {}) {
            options = options || {};
            const T = this.hitungTitikSinggung(lingkaran, titik);
            if (!T) return null;
            if (T.length === 0) {
                console.warn("GeoSVG: titik berada di dalam lingkaran, jadi tidak ada garis singgung.");
                return [];
            }

            const P = this._pt(titik);
            const L = this._objekGeo(lingkaran);

            const BENTUK = ['garis', 'segmen', 'sinar'];
            let bentuk = this._ada(options.bentuk) ? options.bentuk : 'garis';
            if (!BENTUK.includes(bentuk)) {
                this._gagal(`buatGarisSinggung: bentuk '${bentuk}' tidak dikenal. Pilihan: ${BENTUK.join(', ')}. Dipakai 'garis'.`);
                bentuk = 'garis';
            }

            let pilih = this._ada(options.pilih) ? String(options.pilih).trim().toLowerCase() : 'semua';
            if (!['semua', 'kiri', 'kanan'].includes(pilih)) {
                this._gagal(`buatGarisSinggung: pilih '${options.pilih}' tidak dikenal. Pilihan: semua, kiri, kanan. Dipakai 'semua'.`);
                pilih = 'semua';
            }
            // Nomor urut: 0 = kiri, 1 = kanan. Kalau hanya ada satu garis singgung, selalu ditampilkan.
            const tampil = i => T.length === 1 || pilih === 'semua' || (pilih === 'kiri' ? i === 0 : i === 1);

            const hasil = [];
            T.forEach((t, i) => {
                if (!tampil(i)) return;
                const opsi = { ...options };
                if (Array.isArray(options.label)) opsi.label = options.label[i];

                let el;
                if (T.length === 1) {
                    // Titik tepat di lingkaran: garis singgung tegak lurus jari-jari, memanjang ke dua arah
                    if (bentuk !== 'garis') {
                        this._gagal(`buatGarisSinggung: titik tepat di lingkaran, jadi bentuk '${bentuk}' tidak bisa dipakai (garis singgung memanjang ke dua arah). Dipakai 'garis'.`);
                    }
                    const dx = P.x - L.c.x, dy = P.y - L.c.y;
                    el = this.buatGaris(P.x, P.y, P.x - dy, P.y + dx, opsi);
                } else {
                    const metode = bentuk === 'segmen' ? 'buatSegmen' : (bentuk === 'sinar' ? 'buatSinar' : 'buatGaris');
                    el = this[metode](P.x, P.y, t[0], t[1], opsi);
                }
                if (el) hasil.push(el);
            });

            if (options.titikSinggung === true) {
                const warna = options.stroke || this.svg.getAttribute('stroke') || 'black';
                T.forEach((t, i) => {
                    if (!tampil(i)) return;
                    this.buatTitik(t, {
                        size: 3,
                        color: warna,
                        label: Array.isArray(options.labelTitik) ? options.labelTitik[i] : undefined
                    });
                });
            }
            return hasil;
        }

        // Titik singgung garis singgung persekutuan. Mengembalikan daftar pasangan
        // [[x1, y1] (di lingkaran 1), [x2, y2] (di lingkaran 2)]. Daftar kosong = tidak ada garis.
        // jenis: 'luar' (bawaan), 'dalam', atau 'semua'. null jika input salah.
        hitungSinggungPersekutuan(lingkaran1, lingkaran2, jenis = 'luar') {
            const L1 = this._objekGeo(lingkaran1), L2 = this._objekGeo(lingkaran2);
            if (!L1 || L1.tipe !== 'lingkaran' || !L2 || L2.tipe !== 'lingkaran') {
                return this._gagal("hitungSinggungPersekutuan: lingkaran harus { pusat: [x, y], r } atau { cx, cy, r }");
            }
            if (!['luar', 'dalam', 'semua'].includes(jenis)) {
                return this._gagal(`hitungSinggungPersekutuan: jenis '${jenis}' tidak dikenal. Pilihan: luar, dalam, semua`);
            }
            return this._singgungPersekutuan(L1, L2, jenis).map(g => [g.t1, g.t2]);
        }

        // Menggambar garis singgung persekutuan dua lingkaran. Mengembalikan DAFTAR elemen.
        // Semua opsi buatGaris berlaku (stroke, strokeWidth, dashed, label, clipPad, dst). Opsi tambahan:
        //   jenis         : 'luar' (bawaan) | 'dalam' | 'semua' (keempat garis, satu gaya)
        //   pilih         : 'semua' (bawaan) | 'kiri' | 'kanan'  -- hanya untuk jenis 'luar' atau 'dalam'.
        //                   Dilihat di layar dari pusat lingkaran 1 menghadap pusat lingkaran 2 (mengikuti titik
        //                   singgung di lingkaran 1). Untuk memilih dari kedua jenis: panggil dua kali.
        //   bentuk        : 'garis' (bawaan, tak hingga) | 'segmen' (antara dua titik singgung) | 'sinar'
        //   pangkal       : untuk 'sinar': 1 (bawaan) = berpangkal di titik singgung lingkaran 1, 2 = lingkaran 2
        //   titikSinggung : true = gambar juga titik di titik singgung (hanya untuk garis yang tampil)
        //   labelTitik    : daftar PASANGAN label titik, satu per garis, mis. [['A', 'B'], ['C', 'D']]
        // options.label boleh teks (dipakai untuk semua garis yang tampil) atau daftar, satu per slot garis.
        buatGarisSinggungPersekutuan(lingkaran1, lingkaran2, options = {}) {
            options = options || {};
            const L1 = this._objekGeo(lingkaran1), L2 = this._objekGeo(lingkaran2);
            if (!L1 || L1.tipe !== 'lingkaran' || !L2 || L2.tipe !== 'lingkaran') {
                return this._gagal("buatGarisSinggungPersekutuan: lingkaran harus { pusat: [x, y], r } atau { cx, cy, r }");
            }

            let jenis = this._ada(options.jenis) ? options.jenis : 'luar';
            if (!['luar', 'dalam', 'semua'].includes(jenis)) {
                this._gagal(`buatGarisSinggungPersekutuan: jenis '${jenis}' tidak dikenal. Pilihan: luar, dalam, semua. Dipakai 'luar'.`);
                jenis = 'luar';
            }
            let bentuk = this._ada(options.bentuk) ? options.bentuk : 'garis';
            if (!['garis', 'segmen', 'sinar'].includes(bentuk)) {
                this._gagal(`buatGarisSinggungPersekutuan: bentuk '${bentuk}' tidak dikenal. Pilihan: garis, segmen, sinar. Dipakai 'garis'.`);
                bentuk = 'garis';
            }

            let pilih = this._ada(options.pilih) ? String(options.pilih).trim().toLowerCase() : 'semua';
            if (!['semua', 'kiri', 'kanan'].includes(pilih)) {
                this._gagal(`buatGarisSinggungPersekutuan: pilih '${options.pilih}' tidak dikenal. Pilihan: semua, kiri, kanan. Dipakai 'semua'.`);
                pilih = 'semua';
            }
            if (jenis === 'semua' && pilih !== 'semua') {
                this._gagal("buatGarisSinggungPersekutuan: pilih hanya bisa dipakai bersama jenis 'luar' atau 'dalam'. " +
                    "Untuk memilih sebagian garis dari kedua jenis, panggil method ini dua kali. 'pilih' diabaikan.");
                pilih = 'semua';
            }

            const daftar = this._singgungPersekutuan(L1, L2, jenis);
            if (daftar.length === 0) {
                console.warn(`GeoSVG: tidak ada garis singgung persekutuan '${jenis}' untuk kedua lingkaran ini ` +
                    `(satu lingkaran berada di dalam yang lain, atau kedua lingkaran berpotongan untuk jenis 'dalam').`);
                return [];
            }
            // Nomor urut dalam satu jenis: 0 = kiri, 1 = kanan. Garis tunggal (lingkaran bersinggung) selalu ditampilkan.
            const tampil = i => daftar.length === 1 || pilih === 'semua' || (pilih === 'kiri' ? i === 0 : i === 1);

            const dariLingkaran2 = options.pangkal === 2;
            const hasil = [];
            daftar.forEach((g, i) => {
                if (!tampil(i)) return;
                const opsi = { ...options };
                if (Array.isArray(options.label)) opsi.label = options.label[i];

                let el;
                if (g.satu) {
                    // Kedua lingkaran bersinggung: satu garis lewat titik sentuh, tegak lurus garis hubung pusat
                    if (bentuk !== 'garis') {
                        this._gagal(`buatGarisSinggungPersekutuan: kedua lingkaran bersinggung di satu titik, jadi bentuk '${bentuk}' tidak bisa dipakai. Dipakai 'garis'.`);
                    }
                    el = this.buatGaris(g.t1[0], g.t1[1], g.t1[0] + g.arah[0], g.t1[1] + g.arah[1], opsi);
                } else if (bentuk === 'segmen') {
                    el = this.buatSegmen(g.t1, g.t2, opsi);
                } else if (bentuk === 'sinar') {
                    el = dariLingkaran2 ? this.buatSinar(g.t2, g.t1, opsi) : this.buatSinar(g.t1, g.t2, opsi);
                } else {
                    el = this.buatGaris(g.t1, g.t2, opsi);
                }
                if (el) hasil.push(el);
            });

            if (options.titikSinggung === true) {
                const warna = options.stroke || this.svg.getAttribute('stroke') || 'black';
                daftar.forEach((g, i) => {
                    if (!tampil(i)) return;
                    const lab = (Array.isArray(options.labelTitik) && Array.isArray(options.labelTitik[i])) ? options.labelTitik[i] : [];
                    this.buatTitik(g.t1, { size: 3, color: warna, label: lab[0] });
                    if (!g.satu) this.buatTitik(g.t2, { size: 3, color: warna, label: lab[1] });
                });
            }
            return hasil;
        }

        // ===== REFLEKSI (PENCERMINAN) =====

        // Membaca "terhadap": titik pusat -> { jenis: 'titik', p }, garis cermin -> { jenis: 'garis', a, b }.
        // null jika bukan keduanya (atau garis dengan dua titik yang sama).
        _bacaCermin(terhadap) {
            const pusat = this._pt(terhadap);
            if (pusat) return { jenis: 'titik', p: pusat };
            const L = this._objekGeo(terhadap);
            if (L && L.tipe === 'garis') return { jenis: 'garis', a: L.a, b: L.b };
            return null;
        }

        // Memantulkan satu titik {x, y} terhadap cermin dari _bacaCermin
        _pantulkan(p, cermin) {
            if (cermin.jenis === 'titik') {
                return { x: 2 * cermin.p.x - p.x, y: 2 * cermin.p.y - p.y };         // P' = 2M - P
            }
            const dx = cermin.b.x - cermin.a.x, dy = cermin.b.y - cermin.a.y;
            const t = ((p.x - cermin.a.x) * dx + (p.y - cermin.a.y) * dy) / (dx * dx + dy * dy);
            const fx = cermin.a.x + t * dx, fy = cermin.a.y + t * dy;               // kaki tegak lurus F
            return { x: 2 * fx - p.x, y: 2 * fy - p.y };                            // P' = 2F - P
        }

        // Menghitung bayangan.
        //   objek    : satu titik, atau daftar titik (dua titik = garis, tiga atau lebih = poligon)
        //   terhadap : titik (refleksi titik) atau garis cermin [p1, p2]
        // Mengembalikan [x, y] untuk satu titik, atau daftar [[x, y], ...]. null jika input salah.
        hitungRefleksi(objek, terhadap) {
            const cermin = this._bacaCermin(terhadap);
            if (!cermin) {
                return this._gagal("hitungRefleksi: 'terhadap' harus titik [x, y] / {x, y} atau garis [p1, p2] dengan dua titik yang berbeda");
            }

            const satu = this._pt(objek);
            if (satu) {
                const q = this._pantulkan(satu, cermin);
                return [q.x, q.y];
            }
            if (Array.isArray(objek) && objek.length > 0) {
                const daftar = objek.map(t => this._pt(t));
                if (daftar.every(Boolean)) {
                    return daftar.map(t => { const q = this._pantulkan(t, cermin); return [q.x, q.y]; });
                }
            }
            return this._gagal("hitungRefleksi: objek harus titik [x, y] / {x, y} atau daftar titik");
        }

        // Menggambar bayangan hasil refleksi. Mengembalikan elemen bayangannya (titik, garis, atau poligon).
        //   objek / terhadap : seperti hitungRefleksi
        //   options          : opsi gaya untuk bentuk yang digambar (stroke, fill, dashed, label, dst) plus:
        //     bentuk         : 2 titik -> 'garis' (bawaan) | 'segmen' | 'sinar';  3+ titik -> 'poligon' (bawaan) | 'polyline'
        //     titik          : true = gambar juga titik di tiap titik bayangan
        //     labelTitik     : daftar label titik bayangan, mis. ["A'", "B'", "C'"]
        //     penghubung     : true = garis putus-putus dari tiap titik asal ke bayangannya
        //     gayaPenghubung : gaya garis penghubung, mis. { stroke: 'orange' }
        buatRefleksi(objek, terhadap, options = {}) {
            options = options || {};
            const hasil = this.hitungRefleksi(objek, terhadap);
            if (!hasil) return null;

            const tunggal = this._pt(objek) !== null;
            const asal = tunggal ? [this._pt(objek)] : objek.map(t => this._pt(t));
            const bayangan = tunggal ? [hasil] : hasil;                  // daftar [x, y]

            // Garis penghubung (titik yang berada tepat di cermin tidak diberi penghubung)
            if (options.penghubung === true) {
                const gaya = { stroke: '#888', strokeWidth: 1, dashed: true, ...(options.gayaPenghubung || {}) };
                asal.forEach((t, i) => {
                    if (Math.hypot(bayangan[i][0] - t.x, bayangan[i][1] - t.y) > 1e-9) {
                        this.buatSegmen([t.x, t.y], bayangan[i], gaya);
                    }
                });
            }

            // Satu titik (juga daftar berisi satu titik)
            if (bayangan.length === 1) return this.buatTitik(bayangan[0], options);

            const SAH = bayangan.length === 2 ? ['garis', 'segmen', 'sinar'] : ['poligon', 'polyline'];
            let bentuk = this._ada(options.bentuk) ? options.bentuk : SAH[0];
            if (!SAH.includes(bentuk)) {
                this._gagal(`buatRefleksi: bentuk '${bentuk}' tidak cocok untuk ${bayangan.length} titik. Pilihan: ${SAH.join(', ')}. Dipakai '${SAH[0]}'.`);
                bentuk = SAH[0];
            }

            let el;
            if (bentuk === 'garis') el = this.buatGaris(bayangan[0], bayangan[1], options);
            else if (bentuk === 'segmen') el = this.buatSegmen(bayangan[0], bayangan[1], options);
            else if (bentuk === 'sinar') el = this.buatSinar(bayangan[0], bayangan[1], options);
            else if (bentuk === 'poligon') el = this.buatPoligon(bayangan, options);
            else el = this.buatPolyline(bayangan, options);

            if (options.titik === true) {
                const warna = options.stroke || this.svg.getAttribute('stroke') || 'black';
                bayangan.forEach((q, i) => {
                    this.buatTitik(q, {
                        size: 3,
                        color: warna,
                        label: Array.isArray(options.labelTitik) ? options.labelTitik[i] : undefined
                    });
                });
            }
            return el;
        }

        // Memastikan step adalah angka yang lebih besar dari 0
        _validasiStep(step, nama = 'step') {
            const n = Number(step);
            if (!Number.isFinite(n) || n <= 0) {
                throw new RangeError(`${nama} harus angka lebih besar dari 0, tetapi dapat: ${step}`);
            }
            return n;
        }

        // Mencegah pembuatan terlalu banyak elemen sekaligus
        _cekJumlah(jumlah, nama = 'elemen') {
            const MAKS = 5000;
            if (jumlah > MAKS) {
                throw new RangeError(`Terlalu banyak ${nama} (${jumlah}). Maksimal ${MAKS}. Perbesar nilai step.`);
            }
        }
        // Area gambar yang PASTI (tanpa mengukur layar). Mengembalikan null kalau tidak bisa dipastikan.
        _areaTetap() {
            const vb = this.svg.getAttribute("viewBox");
            if (vb) {
                const p = vb.trim().split(/[\s,]+/).map(Number);
                if (p.length === 4 && p.every(Number.isFinite) && p[2] > 0 && p[3] > 0) {
                    return { minX: p[0], minY: p[1], w: p[2], h: p[3] };
                }
                return null;
            }
            const w = this._ukuranAngka(this.svg.getAttribute("width"));
            const h = this._ukuranAngka(this.svg.getAttribute("height"));
            if (w > 0 && h > 0) return { minX: 0, minY: 0, w, h };
            return null;
        }
        _getAreaGambar() {
            // 1. Dari viewBox (paling akurat)
            const vb = this.svg.viewBox && this.svg.viewBox.baseVal;
            if (vb && vb.width > 0 && vb.height > 0) {
                return { minX: vb.x, minY: vb.y, w: vb.width, h: vb.height };
            }

            // 2. Dari atribut width/height jika berupa angka pasti
            let w = this._ukuranAngka(this.svg.getAttribute("width"));
            let h = this._ukuranAngka(this.svg.getAttribute("height"));

            // 3. Jika masih bukan angka (mis. "100%"), ukur dari layar
            if (isNaN(w) || isNaN(h)) {
                const rect = this.svg.getBoundingClientRect();
                if (isNaN(w)) w = rect.width;
                if (isNaN(h)) h = rect.height;
            }

            // 4. Cadangan terakhir
            if (!(w > 0)) w = 800;
            if (!(h > 0)) h = 600;

            return { minX: 0, minY: 0, w, h };
        }
        // Jaring-jaring (Grid): seluruh garis digabung menjadi SATU elemen <path>.
        // Mengembalikan elemen <path>-nya (bukan <g> seperti versi lama).
        buatGrid(stepX, stepY, options = {}) {
            if (!stepY) stepY = stepX;
            stepX = this._validasiStep(stepX, 'stepX');
            stepY = this._validasiStep(stepY, 'stepY');

            const { minX, minY, w, h } = this._getAreaGambar();

            // Hitung banyaknya garis vertikal (X) dan horizontal (Y)
            const awalX = Math.floor(minX / stepX) * stepX;
            const jumlahX = Math.floor((minX + w - awalX) / stepX + 1e-9) + 1;
            this._cekJumlah(jumlahX, 'garis vertikal');

            const awalY = Math.floor(minY / stepY) * stepY;
            const jumlahY = Math.floor((minY + h - awalY) / stepY + 1e-9) + 1;
            this._cekJumlah(jumlahY, 'garis horizontal');

            // Kumpulkan perintah gambar. Garis vertikal dulu, lalu horizontal.
            const bagian = [];
            for (let i = 0; i < jumlahX; i++) {
                const x = this._bulat(awalX + i * stepX);
                bagian.push(`M${x} ${this._bulat(minY)}v${this._bulat(h)}`);
            }
            for (let i = 0; i < jumlahY; i++) {
                const y = this._bulat(awalY + i * stepY);
                bagian.push(`M${this._bulat(minX)} ${y}h${this._bulat(w)}`);
            }

            // Gaya bawaan grid, tanpa mengubah objek opsi milik pemanggil
            const gridOptions = { ...options };
            if (!gridOptions.stroke) gridOptions.stroke = '#ddd';
            if (!this._ada(gridOptions.strokeWidth)) gridOptions.strokeWidth = 1;

            const path = this._el('path', { d: bagian.join(''), fill: 'none' });
            this._applyOptions(path, gridOptions);

            this._tambah(path, 'grid');   // taruh di lapisan paling bawah
            return path;
        }

        // Sumbu Koordinat.
        // Mode biasa: koordinat layar. Panah sumbu Y menuju yMin, dan angka sumbu Y dibalik tandanya (perilaku lama).
        // Mode yUp  : koordinat matematika. Panah sumbu Y menuju yMax (atas), angka ditulis apa adanya.
        buatSumbuKoordinat(xMin, xMax, yMin, yMax, step = 10, options = {}) {
            if (!this._semuaAngka(xMin, xMax, yMin, yMax)) {
                return this._gagal("buatSumbuKoordinat: xMin, xMax, yMin, yMax harus angka");
            }
            step = this._validasiStep(step, 'step');

            const naik = this._yUp;            // true = sumbu Y mengarah ke atas
            const arahY = naik ? -1 : 1;       // label sumbu X berada di bawah sumbu: y layar positif, atau y negatif di yUp
            const group = this._el('g');

            // Sumbu X
            const xAxis = this.buatVektor(xMin, 0, xMax, 0, { stroke: 'black', strokeWidth: 1.5, ...options });
            group.appendChild(xAxis);

            // Sumbu Y
            const yAxis = naik
                ? this.buatVektor(0, yMin, 0, yMax, { stroke: 'black', strokeWidth: 1.5, ...options })
                : this.buatVektor(0, yMax, 0, yMin, { stroke: 'black', strokeWidth: 1.5, ...options });
            group.appendChild(yAxis);

            const tickSize = options.tickSize || 4;
            const skipZero = options.skipZero !== false;

            const drawTicks = (start, end, axis) => {
                const jumlah = Math.floor((end - start) / step + 1e-9) + 1;
                if (jumlah <= 0) return;
                this._cekJumlah(jumlah, 'tick sumbu ' + axis);

                for (let i = 0; i < jumlah; i++) {
                    const val = start + i * step;
                    const bersih = parseFloat(val.toPrecision(12));   // hindari 0.30000000000000004

                    if (Math.abs(val) < 0.0001) {
                        if (!skipZero) {
                            group.appendChild(this.buatTeks(4, arahY * 12, "0", { fontSize: '10px', ...options }));
                        }
                        continue;
                    }

                    if (axis === 'x') {
                        const tick = this._el('line', { x1: val, y1: -tickSize, x2: val, y2: tickSize, stroke: 'black', 'stroke-width': 1 });
                        const txt = this.buatTeks(val, arahY * (tickSize + 12), bersih.toString(),
                            { position: 'top-center', fontSize: '10px', ...options });
                        group.appendChild(txt);
                        group.appendChild(tick);
                    } else {
                        const tick = this._el('line', { x1: -tickSize, y1: val, x2: tickSize, y2: val, stroke: 'black', 'stroke-width': 1 });
                        const txt = naik
                            ? this.buatTeks(-tickSize - 4, val, bersih.toString(), { position: 'middle-left', fontSize: '10px', ...options })
                            : this.buatTeks(-tickSize - 4, val, (-bersih).toString(), { position: 'middle-right', fontSize: '10px', ...options });
                        group.appendChild(txt);
                        group.appendChild(tick);
                    }
                }
            };

            drawTicks(Math.ceil(xMin / step) * step, Math.floor(xMax / step) * step, 'x');
            drawTicks(Math.ceil(yMin / step) * step, Math.floor(yMax / step) * step, 'y');

            this._tambah(group, 'shapes');
            return group;
        }

        // Garis Dimensi (Dimension Line)
        // options: stroke, strokeWidth, dst (untuk garis), plus untuk label:
        //   fontSize, fontFamily, fontWeight, fontStyle  (bawaan: mengikuti font bawaan gambar)
        //   labelJarak : jarak label dari garis dimensi (bawaan 10)
        buatDimensi(p1, p2, offset, label, options = {}) {
            const pt1 = this._pt(p1);
            const pt2 = this._pt(p2);
            if (!pt1 || !pt2) return this._gagal("buatDimensi: p1 dan p2 harus [x, y] atau {x, y} berisi angka");
            if (!this._semuaAngka(offset)) return this._gagal("buatDimensi: offset harus angka");
            offset = Number(offset);

            const dx = pt2.x - pt1.x;
            const dy = pt2.y - pt1.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) return this._gagal("buatDimensi: p1 dan p2 sama, garis dimensi tidak punya panjang");

            const nx = -dy / len;
            const ny = dx / len;

            const op1x = pt1.x + nx * offset;
            const op1y = pt1.y + ny * offset;
            const op2x = pt2.x + nx * offset;
            const op2y = pt2.y + ny * offset;

            const group = this.buatGrup();
            const masuk = el => { if (el) group.appendChild(el); return el; };   // elemen kosong dilewati

            // Garis penghubung ujung
            const strokeOpt = { stroke: options.stroke || '#888', strokeWidth: 1, ...options };
            masuk(this.buatSegmen(pt1.x, pt1.y, op1x, op1y, strokeOpt));
            masuk(this.buatSegmen(pt2.x, pt2.y, op2x, op2y, strokeOpt));

            // Garis dimensi (panah dua arah)
            const dimLine = masuk(this.buatSegmen(op1x, op1y, op2x, op2y, strokeOpt));
            if (dimLine) {
                dimLine.setAttribute("marker-start", `url(#${this._getMarker(strokeOpt.stroke, true)})`);
                dimLine.setAttribute("marker-end", `url(#${this._getMarker(strokeOpt.stroke)})`);
            }

            // Label
            if (this._ada(label) && label !== '') {
                const arah = offset < 0 ? -1 : 1;      // label selalu di sisi luar garis dimensi
                const jarak = this._ada(options.labelJarak) ? Number(options.labelJarak) : 10;
                const lx = (op1x + op2x) / 2 + nx * jarak * arah;
                const ly = (op1y + op2y) / 2 + ny * jarak * arah;

                masuk(this.buatTeks(lx, ly, label, {
                    position: 'middle-center',
                    fill: strokeOpt.stroke,
                    fontSize: options.fontSize || this.svg.getAttribute('font-size') || '12px',
                    fontFamily: options.fontFamily,       // kalau kosong: mewarisi font bawaan gambar
                    fontWeight: options.fontWeight,
                    fontStyle: options.fontStyle
                }));
            }

            return group;
        }

        // Memasang gambar latar. Mengembalikan Promise yang berisi elemen <image> (atau null jika gagal).
        // Gambar disimpan sebagai data URL, jadi IKUT TERSIMPAN di dalam file SVG saat diunduh.
        // Memanggilnya lagi akan MENGGANTI gambar latar yang lama.
        async setGambarLatar(sumber, options = {}) {
            if (this._destroyed) return this._gagal("setGambarLatar: instance ini sudah di-destroy()");
            options = options || {};

            const FIT = { contain: 'xMidYMid meet', cover: 'xMidYMid slice', stretch: 'none' };
            const fit = this._ada(options.fit) ? options.fit : 'contain';
            if (!FIT[fit]) return this._gagal(`setGambarLatar: fit '${fit}' tidak dikenal. Pilihan: contain, cover, stretch`);

            let gambar;
            try {
                gambar = await this._siapkanGambar(sumber, options);
            } catch (err) {
                return this._gagal(`setGambarLatar: ${err.message}`);
            }
            if (this._destroyed) return null;

            // Posisi dan ukuran (bawaan: memenuhi seluruh area gambar)
            const area = this._areaTetap() || this._getAreaGambar();
            const x = this._ada(options.x) ? Number(options.x) : area.minX;
            const y = this._ada(options.y) ? Number(options.y) : area.minY;
            let lebar = this._ada(options.lebar) ? Number(options.lebar) : null;
            let tinggi = this._ada(options.tinggi) ? Number(options.tinggi) : null;

            if (lebar === null && tinggi === null) { lebar = area.w; tinggi = area.h; }
            else if (tinggi === null) tinggi = lebar * gambar.h / gambar.w;
            else if (lebar === null) lebar = tinggi * gambar.w / gambar.h;

            if (![x, y, lebar, tinggi].every(Number.isFinite) || lebar <= 0 || tinggi <= 0) {
                return this._gagal("setGambarLatar: x, y, lebar, tinggi harus angka, dan lebar/tinggi harus lebih dari 0");
            }
            const transparan = this._ada(options.opacity) ? Number(options.opacity) : null;

            const gambarEl = this._el('image', {
                x, y, width: lebar, height: tinggi,
                preserveAspectRatio: FIT[fit],
                opacity: transparan,
                // Mode yUp: lapisan dibalik, jadi gambar dibalik lagi terhadap garis tengahnya supaya tegak
                transform: this._yUp ? `translate(0 ${2 * y + tinggi}) scale(1 -1)` : null
            });
            gambarEl.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", gambar.dataUrl);
            // Deklarasikan xlink di <svg> supaya file hasil unduhan memakai awalan "xlink:" yang biasa
            this.svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");

            // Lapisan latar ditaruh PALING BAWAH (di bawah grid)
            let lapisan = this._layers.latar;
            if (!lapisan) {
                lapisan = this._buatLapisan('latar');
                if (this._layers.grid) this.svg.insertBefore(lapisan, this._layers.grid);
            }
            lapisan.textContent = '';
            lapisan.appendChild(gambarEl);

            const mb = gambar.dataUrl.length / 1048576;
            if (mb > 3) {
                console.warn(`GeoSVG: gambar latar berukuran ${mb.toFixed(1)} MB di dalam file SVG. Pertimbangkan opsi { maksSisi: 1600 } agar file tidak terlalu besar.`);
            }
            return gambarEl;
        }

        // Menghapus gambar latar.
        hapusGambarLatar() {
            if (this._layers.latar) this._layers.latar.textContent = '';
        }

        // Manajemen DOM & Grup
        hapus(element) {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }

        // Memindahkan elemen ke paling atas/bawah DI DALAM induknya (lapisan atau grup tempat ia berada).
        // Untuk pindah antar-lapisan, pakai pindahKeLapisan().
        pindahKeAtas(element) {
            if (element && element.parentNode) {
                element.parentNode.appendChild(element);
            }
        }
        pindahKeBawah(element) {
            if (element && element.parentNode) {
                element.parentNode.insertBefore(element, element.parentNode.firstChild);
            }
        }

        buatGrup(elements = [], options = {}) {
            const group = this._el("g");
            this._applyOptions(group, options);

            // Terima satu elemen saja maupun array
            const daftar = Array.isArray(elements) ? elements : [elements];

            // Hanya ambil yang benar-benar elemen DOM (buang null, undefined, dsb.)
            const valid = daftar.filter(el => el instanceof Node);

            const dilewati = daftar.length - valid.length;
            if (dilewati > 0) {
                console.warn(`GeoSVG: ${dilewati} elemen kosong dilewati saat membuat grup.`);
            }

            // appendChild otomatis memindahkan elemen dari tempat lamanya
            valid.forEach(el => group.appendChild(el));

            this._tambah(group, 'shapes');
            return group;
        }

        // Mengubah SVG menjadi teks (string) lengkap dengan deklarasi XML.
        // XMLSerializer otomatis menambahkan xmlns pada elemen <svg>, jadi tidak perlu ditambah manual.
        keStringSVG() {
            const isi = new XMLSerializer().serializeToString(this.svg);
            return '<?xml version="1.0" standalone="no"?>\r\n' + isi;
        }

        // Mengunduh sebuah Blob sebagai file.
        _unduh(blob, namaFile) {
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = namaFile;
            document.body.appendChild(a);   // sebagian browser lama butuh tautan ada di halaman
            a.click();
            document.body.removeChild(a);

            // Lepaskan alamat sementara. Ditunda 1 detik karena sebagian browser
            // membatalkan unduhan kalau alamatnya dilepas terlalu cepat.
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        // Mengunduh SVG sebagai file. Mengembalikan Blob-nya (berguna untuk pengujian).
        downloadSVG(filename = 'geometri.svg') {
            // Nama file kosong atau bukan teks -> pakai nama bawaan; tambahkan .svg jika belum ada
            filename = (typeof filename === 'string' && filename.trim()) ? filename.trim() : 'geometri.svg';
            if (!/\.svg$/i.test(filename)) filename += '.svg';

            const blob = new Blob([this.keStringSVG()], { type: 'image/svg+xml;charset=utf-8' });
            this._unduh(blob, filename);
            return blob;
        }

        // Menentukan ukuran gambar untuk diekspor (dalam piksel layar).
        _ukuranEkspor() {
            // 1. Ukuran yang tampil di layar saat ini
            const rect = this.svg.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) return { w: rect.width, h: rect.height };

            // 2. Atribut width/height jika berupa angka pasti (misalnya wadah sedang disembunyikan)
            const w = this._ukuranAngka(this.svg.getAttribute("width"));
            const h = this._ukuranAngka(this.svg.getAttribute("height"));
            if (w > 0 && h > 0) return { w, h };

            // 3. Dari viewBox
            const vb = this.svg.viewBox && this.svg.viewBox.baseVal;
            if (vb && vb.width > 0 && vb.height > 0) return { w: vb.width, h: vb.height };

            // 4. Cadangan terakhir
            return { w: 800, h: 600 };
        }
        // Membuat PNG dan mengembalikannya sebagai Promise<Blob>. Tidak mengunduh apa pun.
        // options.scale      : pembesaran (bawaan 2). Contoh: ukuran 300x150 + scale 2 = 600x300 piksel
        // options.background : warna latar. Bawaan: ikut latar SVG. 'transparent' = tanpa latar
        // options.tanpaLatex : true = rumus LaTeX tidak disertakan (berguna kalau PNG gagal dibuat)
        toPNGBlob(options = {}) {
            options = options || {};

            return new Promise((resolve, reject) => {
                // --- 1. Periksa opsi ---
                const skala = this._ada(options.scale) ? Number(options.scale) : 2;
                if (!Number.isFinite(skala) || skala <= 0) {
                    return reject(new RangeError(`scale harus angka lebih besar dari 0, tetapi dapat: ${options.scale}`));
                }

                // --- 2. Tentukan ukuran ---
                const { w, h } = this._ukuranEkspor();
                const lebarPx = Math.max(1, Math.round(w * skala));
                const tinggiPx = Math.max(1, Math.round(h * skala));
                const MAKS_SISI = 16384;   // batas umum canvas di browser desktop
                if (lebarPx > MAKS_SISI || tinggiPx > MAKS_SISI) {
                    return reject(new RangeError(
                        `Ukuran PNG ${lebarPx}x${tinggiPx} terlalu besar (maksimal ${MAKS_SISI} piksel per sisi). Turunkan scale.`
                    ));
                }

                // --- 3. Latar: digambar SEKALI di canvas, bukan di SVG ---
                let latar = (options.background !== undefined) ? options.background : this.svg.style.backgroundColor;
                if (latar && latar !== 'transparent' && window.CSS && CSS.supports && !CSS.supports('color', latar)) {
                    console.warn(`GeoSVG: warna latar '${latar}' tidak dikenali, diabaikan.`);
                    latar = null;
                }

                // --- 4. Buat klon dengan ukuran tetap (SVG asli tidak berubah) ---
                const klon = this.svg.cloneNode(true);
                klon.setAttribute("width", w);
                klon.setAttribute("height", h);
                klon.style.backgroundColor = '';

                // --- 5. Rumus LaTeX ---
                const adaLatex = klon.querySelector('foreignObject') !== null;
                if (adaLatex && options.tanpaLatex) {
                    klon.querySelectorAll('foreignObject').forEach(el => el.remove());
                } else if (adaLatex) {
                    console.warn(
                        "GeoSVG: gambar berisi rumus LaTeX. Di PNG, gaya rumus (font KaTeX/MathJax) bisa hilang, " +
                        "dan sebagian browser (terutama Safari) menolak membuat PNG. " +
                        "Gunakan opsi { tanpaLatex: true } atau downloadSVG() jika bermasalah."
                    );
                }

                // --- 6. SVG -> teks -> gambar ---
                const teks = new XMLSerializer().serializeToString(klon);
                const url = URL.createObjectURL(new Blob([teks], { type: "image/svg+xml;charset=utf-8" }));

                const gagal = (err) => {
                    URL.revokeObjectURL(url);
                    const pesan = (err && err.name === 'SecurityError')
                        ? "Browser menolak membuat PNG karena gambar memuat elemen yang dianggap tidak aman " +
                        "(biasanya rumus LaTeX). Coba { tanpaLatex: true } atau gunakan downloadSVG()."
                        : (err && err.message) || "kesalahan tidak dikenal";
                    reject(new Error(pesan));
                };

                const img = new Image();
                img.onerror = () => gagal(new Error(
                    "Browser gagal membaca SVG sebagai gambar." +
                    (adaLatex ? " Kemungkinan penyebabnya rumus LaTeX; coba { tanpaLatex: true }." : "")
                ));

                img.onload = () => {
                    try {
                        const canvas = document.createElement("canvas");
                        canvas.width = lebarPx;
                        canvas.height = tinggiPx;
                        const ctx = canvas.getContext("2d");
                        if (!ctx) throw new Error("Browser tidak bisa membuat canvas (ukuran terlalu besar?).");

                        if (latar && latar !== 'transparent') {
                            ctx.fillStyle = latar;
                            ctx.fillRect(0, 0, lebarPx, tinggiPx);
                        }
                        ctx.drawImage(img, 0, 0, lebarPx, tinggiPx);
                        URL.revokeObjectURL(url);

                        canvas.toBlob(blob => {
                            if (blob) resolve(blob);
                            else reject(new Error("Browser gagal membuat file PNG (ukuran terlalu besar?)."));
                        }, "image/png");
                    } catch (err) {
                        gagal(err);
                    }
                };

                img.src = url;
            });
        }

        // Mengunduh PNG. Mengembalikan Promise (boleh di-await, boleh diabaikan).
        // Cara pakai: downloadPNG('nama.png', 3)  atau  downloadPNG('nama.png', { scale: 3, background: 'white' })
        async downloadPNG(filename = 'geometri.png', skalaAtauOpsi = 2) {
            filename = (typeof filename === 'string' && filename.trim()) ? filename.trim() : 'geometri.png';
            if (!/\.png$/i.test(filename)) filename += '.png';

            const opsi = (skalaAtauOpsi && typeof skalaAtauOpsi === 'object')
                ? skalaAtauOpsi
                : { scale: skalaAtauOpsi };

            try {
                const blob = await this.toPNGBlob(opsi);
                this._unduh(blob, filename);
                return blob;
            } catch (err) {
                return this._gagal(`downloadPNG gagal: ${err.message}`);
            }
        }

        // Melepas gambar dari halaman dan membuang isinya. Aman dipanggil berulang kali.
        // Setelah destroy(), instance ini tidak bisa dipakai menggambar lagi; buat instance baru.
        destroy() {
            if (this._destroyed) return;
            this._destroyed = true;

            // Batalkan batch yang sedang berjalan (jika ada)
            this._batch = null;
            this._batchDepth = 0;

            // Lepas SVG dari halaman
            if (this.svg && this.svg.parentNode) {
                this.svg.parentNode.removeChild(this.svg);
            }

            // Hapus dari catatan container
            const daftar = GeoSVG._daftar && GeoSVG._daftar.get(this.container);
            if (daftar) daftar.delete(this);

            // Kosongkan isinya supaya memori bisa dibebaskan walaupun variabel `geo` masih Anda simpan
            this._markers.clear();
            this.svg.textContent = '';
        }

        // Clear the SVG canvas
        clear() {
            // Batalkan batch yang sedang berjalan (jika ada)
            this._batch = null;
            this._batchDepth = 0;

            [...this.svg.children].forEach(child => {
                // Pertahankan defs, judul, deskripsi, dan gambar latar
                if (child === this.defs || child.tagName === 'title' || child.tagName === 'desc'
                    || child === this._layers.latar) return;

                if (Object.values(this._layers).includes(child)) {
                    child.textContent = '';              // lapisan dikosongkan, bukan dihapus
                } else {
                    child.remove();                      // elemen liar yang ditambah manual
                }
            });
        }
    }

    return GeoSVG;
});
