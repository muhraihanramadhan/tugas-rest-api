# 📝 Agenda Tugas - RESTful API & Task Management Web App

Aplikasi manajemen agenda dan tugas harian berbasis web dengan arsitektur *decoupled*. Aplikasi ini memisahkan secara tegas antara penyedia data (*RESTful API Back-End* menggunakan Node.js dan Express.js) dan penyaji antarmuka (*Front-End* menggunakan HTML5, CSS3, dan Vanilla JavaScript dengan Fetch API).

---

## 🚀 Fitur Utama

- **Pengelolaan Tugas (CRUD):**
  - **Create:** Menambahkan tugas baru beserta batas waktu (*deadline*).
  - **Read:** Menampilkan daftar tugas aktif yang terurut berdasarkan batas waktu terdekat.
  - **Update:** Memperbarui judul tugas, menandai tugas selesai, atau menunda (*reschedule*) batas waktu tugas.
  - **Delete:** Menghapus tugas dari daftar aktif tanpa menghapus riwayat aktivitasnya.
- **Deteksi Keterlambatan Otomatis:** Middleware server secara otomatis mengeksekusi pengecekan keterlambatan tugas (*overdue*) pada setiap permintaan API.
- **Pencatatan Riwayat Aktivitas (*Activity Logs*):** Mencatat setiap aksi penting (tugas diselesaikan, ditunda, atau terlambat) beserta durasi dan kalkulasi selisih waktu secara otomatis.
- **Antarmuka Asinkron Dinamis:** Pembaruan tampilan antarmuka secara parsial tanpa muat ulang halaman (*no full page reload*) menggunakan *Fetch API*.
- **Penyaringan Riwayat (*Filter Logs*):** Menampilkan dan mengelompokkan riwayat berdasarkan kategori (*Semua*, *Selesai*, *Ditunda*, *Terlambat*).
- **Penyelarasan Otomatis (*Auto-Sync*):** Sinkronisasi otomatis status keterlambatan tugas setiap 30 detik.

---

## 🛠️ Teknologi yang Digunakan

### Back-End
- **Runtime:** [Node.js](https://nodejs.org/)
- **Framework:** [Express.js](https://expressjs.com/) (`v5.2.1`)
- **Penyimpanan Data:** *In-Memory Array* (`tasks[]` & `logs[]`)

### Front-End
- **Antarmuka:** HTML5 & CSS3 (Elemen Semantik & Layout Responsif)
- **Skrip:** Vanilla JavaScript (ES6+)
- **Komunikasi Data:** Asynchronous Fetch API & DOM Manipulation

---

## 🏗️ Arsitektur Sistem

Sistem ini menerapkan pola komunikasi dua arah antara *Client* (Browser) dan *Server* (Node.js/Express) melalui protokol HTTP dengan format pertukaran data JSON.

```mermaid
flowchart TD
    subgraph Client ["Client (Browser)"]
        direction LR
        UI["Index.html (UI)"] <--> JS["Script.js (Fetch API / DOM)"]
    end

    subgraph Server ["Server (Node.js / Express)"]
        direction TB
        EX["Express 5.2.1"] <--> MW["Middleware (periksaTerlambat)"]
        EX <--> MEM[("In-Memory Storage<br/>tasks[] & logs[]")]
    end

    JS <===>|"HTTP JSON Request / Response"| EX