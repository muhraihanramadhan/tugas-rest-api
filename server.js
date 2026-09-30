const express = require("express");
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));

let tasks = [];
let logs = [];
let nextTaskId = 1;
let nextLogId = 1;

// Catat satu kejadian ke riwayat (selesai / ditunda / terlambat)
function addLog(task, action, extra, time) {
  logs.push({
    id: nextLogId++,
    taskId: task.id,
    title: task.title,
    action,
    time: time || new Date().toISOString(),
    ...extra,
  });
}

// Tugas aktif yang melewati batas waktu dicatat sekali sebagai "terlambat"
function periksaTerlambat() {
  const now = Date.now();
  tasks.forEach((t) => {
    if (t.status === "aktif" && !t.lateLogged && new Date(t.deadline) < now) {
      t.lateLogged = true;
      addLog(t, "terlambat", { deadline: t.deadline }, t.deadline);
    }
  });
}

function tampilkan(task) {
  const { lateLogged, ...data } = task;
  data.terlambat = task.status === "aktif" && new Date(task.deadline) < Date.now();
  return data;
}

const tanggalValid = (v) => typeof v === "string" && !isNaN(new Date(v).getTime());

// Setiap request ke /api memeriksa keterlambatan lebih dulu
app.use("/api", (req, res, next) => {
  periksaTerlambat();
  next();
});

// Data contoh
tasks.push({
  id: nextTaskId++,
  title: "Belajar REST API",
  deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  status: "aktif",
  createdAt: new Date().toISOString(),
  completedAt: null,
  postponedCount: 0,
  lateLogged: false,
});

// GET - daftar tugas (opsional: ?status=aktif atau ?status=selesai)
app.get("/api/tasks", (req, res) => {
  let hasil = [...tasks];
  if (req.query.status) hasil = hasil.filter((t) => t.status === req.query.status);
  hasil.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  res.status(200).json(hasil.map(tampilkan));
});

// POST - tambah tugas
app.post("/api/tasks", (req, res) => {
  const { title, deadline } = req.body;
  if (typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ error: "Judul wajib diisi" });
  }
  if (!tanggalValid(deadline)) {
    return res.status(400).json({ error: "Batas waktu wajib diisi dengan tanggal dan jam yang valid" });
  }
  const task = {
    id: nextTaskId++,
    title: title.trim(),
    deadline: new Date(deadline).toISOString(),
    status: "aktif",
    createdAt: new Date().toISOString(),
    completedAt: null,
    postponedCount: 0,
    lateLogged: false,
  };
  tasks.push(task);
  res.status(201).json(tampilkan(task));
});

// PUT - ubah judul, tandai selesai (status), atau tunda (deadline baru)
app.put("/api/tasks/:id", (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan" });
  if (task.status === "selesai") {
    return res.status(409).json({ error: "Tugas yang sudah selesai tidak dapat diubah" });
  }

  const { title, deadline, status } = req.body;
  if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
    return res.status(400).json({ error: "Judul tidak boleh kosong" });
  }
  if (status !== undefined && status !== "selesai") {
    return res.status(400).json({ error: "Status hanya dapat diubah menjadi 'selesai'" });
  }
  let deadlineBaru = null;
  if (deadline !== undefined) {
    if (!tanggalValid(deadline)) {
      return res.status(400).json({ error: "Format batas waktu tidak valid" });
    }
    deadlineBaru = new Date(deadline);
    if (deadlineBaru <= new Date(task.deadline)) {
      return res.status(400).json({ error: "Batas waktu baru harus lebih lambat dari batas waktu saat ini" });
    }
    if (deadlineBaru <= new Date()) {
      return res.status(400).json({ error: "Batas waktu baru harus di masa depan" });
    }
  }

  if (title !== undefined) task.title = title.trim();
  if (deadlineBaru) {
    addLog(task, "ditunda", { deadline: task.deadline, newDeadline: deadlineBaru.toISOString() });
    task.deadline = deadlineBaru.toISOString();
    task.postponedCount++;
    task.lateLogged = false;
  }
  if (status === "selesai") {
    const now = new Date();
    task.status = "selesai";
    task.completedAt = now.toISOString();
    addLog(task, "selesai", { deadline: task.deadline, selisihMs: now - new Date(task.deadline) });
  }
  res.status(200).json(tampilkan(task));
});

// DELETE - hapus tugas (catatan riwayat tetap tersimpan)
app.delete("/api/tasks/:id", (req, res) => {
  const index = tasks.findIndex((t) => t.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Tugas tidak ditemukan" });
  tasks.splice(index, 1);
  res.status(200).json({ message: "Tugas berhasil dihapus" });
});

// GET - riwayat (opsional: ?action=selesai | ditunda | terlambat)
app.get("/api/logs", (req, res) => {
  let hasil = [...logs];
  if (req.query.action) hasil = hasil.filter((l) => l.action === req.query.action);
  hasil.sort((a, b) => new Date(b.time) - new Date(a.time));
  res.status(200).json(hasil);
});

// Penangan error untuk JSON yang rusak
app.use((err, req, res, next) => {
  res.status(400).json({ error: "Format JSON tidak valid" });
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});