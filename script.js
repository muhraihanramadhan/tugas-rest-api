const API_TASKS = "/api/tasks";
const API_LOGS = "/api/logs";
const $ = (id) => document.getElementById(id);

let tugas = [];
let riwayat = [];
let filterAktif = "semua";
let idDitunda = null;
let timerPesan;

// ---------- Utilitas ----------
function tampilkanPesan(teks, tipe) {
  clearTimeout(timerPesan);
  $("pesan").textContent = teks;
  $("pesan").className = tipe;
  if (tipe === "sukses") timerPesan = setTimeout(() => ($("pesan").textContent = ""), 4000);
}

function buat(tag, kelas, teks) {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const formatWaktu = (iso) => fmt.format(new Date(iso));

function durasi(ms) {
  const menit = Math.floor(Math.abs(ms) / 60000);
  if (menit === 0) return "kurang dari 1 menit";
  const bagian = [];
  if (Math.floor(menit / 1440)) bagian.push(Math.floor(menit / 1440) + " hari");
  if (Math.floor((menit % 1440) / 60)) bagian.push(Math.floor((menit % 1440) / 60) + " jam");
  if (menit % 60) bagian.push((menit % 60) + " menit");
  return bagian.join(" ");
}

// Nilai untuk input datetime-local (waktu lokal)
function keInputLokal(date) {
  return new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const deadlineDefault = () => keInputLokal(new Date(Date.now() + 3600 * 1000));

function opsiJson(method, body) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// Semua request lewat sini agar penanganan error di satu tempat
async function kirimRequest(url, opsi) {
  let response;
  try {
    response = await fetch(url, opsi);
  } catch (e) {
    throw new Error("Server tidak dapat dihubungi. Pastikan server sudah berjalan.");
  }
  let data = null;
  try { data = await response.json(); } catch (e) { /* respons bukan JSON */ }
  if (!response.ok) throw new Error((data && data.error) || `Permintaan gagal (status ${response.status})`);
  return data;
}

// ---------- Memuat data (GET) ----------
async function muatSemua() {
  try {
    [tugas, riwayat] = await Promise.all([
      kirimRequest(API_TASKS + "?status=aktif"),
      kirimRequest(API_LOGS),
    ]);
    gambarTugas();
    gambarRiwayat();
  } catch (err) {
    tampilkanPesan("Gagal memuat data: " + err.message, "error");
  }
}

// ---------- Aksi ke server ----------
async function jalankan(aksi, pesanSukses, pesanGagal) {
  try {
    await aksi();
    tampilkanPesan(pesanSukses, "sukses");
    muatSemua();
  } catch (err) {
    tampilkanPesan(pesanGagal + ": " + err.message, "error");
  }
}

const tambahTugas = (title, deadline) =>
  jalankan(() => kirimRequest(API_TASKS, opsiJson("POST", { title, deadline })), "Tugas berhasil ditambahkan", "Gagal menambah tugas");
const selesaikan = (id) =>
  jalankan(() => kirimRequest(`${API_TASKS}/${id}`, opsiJson("PUT", { status: "selesai" })), "Tugas ditandai selesai", "Gagal menyelesaikan tugas");
const ubahJudul = (id, title) =>
  jalankan(() => kirimRequest(`${API_TASKS}/${id}`, opsiJson("PUT", { title })), "Judul tugas diperbarui", "Gagal mengubah judul");
const hapusTugas = (id) =>
  jalankan(() => kirimRequest(`${API_TASKS}/${id}`, { method: "DELETE" }), "Tugas berhasil dihapus", "Gagal menghapus tugas");

// ---------- Tampilan tugas ----------
function gambarTugas() {
  const ul = $("daftar-tugas");
  ul.replaceChildren();
  if (tugas.length === 0) {
    ul.append(buat("li", "kosong", "Belum ada tugas aktif. Isi judul dan batas waktu di atas untuk menambah tugas."));
    return;
  }
  tugas.forEach((t) => {
    const li = buat("li", "kartu" + (t.terlambat ? " terlambat" : ""));
    li.append(buat("p", "judul", t.title));
    li.append(buat("p", "info", "Batas waktu " + formatWaktu(t.deadline)));

    const selisih = new Date(t.deadline) - Date.now();
    let sisa = t.terlambat ? "Terlambat " + durasi(selisih) : "Sisa waktu " + durasi(selisih);
    if (t.postponedCount > 0) sisa += ` (sudah ditunda ${t.postponedCount} kali)`;
    li.append(buat("p", "info" + (t.terlambat ? " merah" : ""), sisa));

    const aksi = buat("div", "aksi");
    const b1 = buat("button", "", "Selesai");
    b1.onclick = () => selesaikan(t.id);
    const b2 = buat("button", "sekunder", "Tunda");
    b2.onclick = () => bukaTunda(t);
    const b3 = buat("button", "sekunder", "Ubah judul");
    b3.onclick = () => {
      const baru = prompt("Judul baru:", t.title);
      if (baru !== null) ubahJudul(t.id, baru);
    };
    const b4 = buat("button", "bahaya", "Hapus");
    b4.onclick = () => { if (confirm("Hapus tugas ini?")) hapusTugas(t.id); };
    aksi.append(b1, b2, b3, b4);
    li.append(aksi);
    ul.append(li);
  });
}

// ---------- Dialog tunda ----------
function bukaTunda(t) {
  idDitunda = t.id;
  $("tunda-judul").textContent = t.title;
  $("tunda-error").textContent = "";
  const dasar = Math.max(Date.now(), new Date(t.deadline).getTime());
  $("tunda-waktu").value = keInputLokal(new Date(dasar + 3600 * 1000));
  $("dialog-tunda").showModal();
}

$("tunda-batal").onclick = () => $("dialog-tunda").close();
$("form-tunda").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!$("tunda-waktu").value) {
    $("tunda-error").textContent = "Pilih tanggal dan jam baru";
    return;
  }
  try {
    const deadline = new Date($("tunda-waktu").value).toISOString();
    await kirimRequest(`${API_TASKS}/${idDitunda}`, opsiJson("PUT", { deadline }));
    $("dialog-tunda").close();
    tampilkanPesan("Tugas berhasil ditunda", "sukses");
    muatSemua();
  } catch (err) {
    $("tunda-error").textContent = err.message; // dialog tetap terbuka
  }
});

// ---------- Tampilan riwayat ----------
const NAMA = { selesai: "Selesai", ditunda: "Ditunda", terlambat: "Terlambat" };

function teksDetail(l) {
  if (l.action === "selesai") {
    return l.selisihMs > 0
      ? "Diselesaikan terlambat " + durasi(l.selisihMs)
      : "Diselesaikan tepat waktu, " + durasi(l.selisihMs) + " sebelum batas waktu";
  }
  if (l.action === "ditunda") return `Batas waktu dipindah dari ${formatWaktu(l.deadline)} ke ${formatWaktu(l.newDeadline)}`;
  return `Melewati batas waktu ${formatWaktu(l.deadline)}`;
}

function gambarRiwayat() {
  const filter = $("filter");
  filter.replaceChildren();
  ["semua", "selesai", "ditunda", "terlambat"].forEach((k) => {
    const jumlah = k === "semua" ? riwayat.length : riwayat.filter((l) => l.action === k).length;
    const b = buat("button", "", `${k === "semua" ? "Semua" : NAMA[k]} (${jumlah})`);
    b.setAttribute("aria-pressed", String(filterAktif === k));
    b.onclick = () => { filterAktif = k; gambarRiwayat(); };
    filter.append(b);
  });

  const ul = $("daftar-riwayat");
  ul.replaceChildren();
  const data = filterAktif === "semua" ? riwayat : riwayat.filter((l) => l.action === filterAktif);
  if (data.length === 0) {
    ul.append(buat("li", "kosong", "Belum ada catatan untuk kategori ini."));
    return;
  }
  data.forEach((l) => {
    const li = buat("li", "kartu " + l.action);
    const baris = buat("div", "baris");
    baris.append(buat("span", "lencana", NAMA[l.action]), buat("span", "info", formatWaktu(l.time)));
    li.append(baris, buat("p", "judul", l.title), buat("p", "info", teksDetail(l)));
    ul.append(li);
  });
}

// ---------- Navigasi header ----------
function tampilkanView(nama) {
  $("view-tugas").hidden = nama !== "tugas";
  $("view-riwayat").hidden = nama !== "riwayat";
  document.querySelectorAll("nav button").forEach((b) => {
    if (b.dataset.view === nama) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  if (nama === "riwayat") muatSemua();
}
document.querySelectorAll("nav button").forEach((b) => (b.onclick = () => tampilkanView(b.dataset.view)));

// ---------- Form tambah ----------
$("form-tambah").addEventListener("submit", (e) => {
  e.preventDefault();
  const judul = $("input-judul").value.trim();
  const waktu = $("input-deadline").value;
  if (judul === "") return tampilkanPesan("Judul tugas wajib diisi", "error");
  if (waktu === "") return tampilkanPesan("Batas waktu wajib diisi", "error");
  tambahTugas(judul, new Date(waktu).toISOString());
  $("input-judul").value = "";
  $("input-deadline").value = deadlineDefault();
});

// ---------- Jam & tanggal di header ----------
function perbaruiJam() {
  const n = new Date();
  $("tanggal").textContent = n.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("waktu").textContent = n.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
perbaruiJam();
setInterval(perbaruiJam, 1000);

// ---------- Mulai ----------
$("input-deadline").value = deadlineDefault();
muatSemua();
setInterval(muatSemua, 30000); // segarkan status terlambat tiap 30 detik