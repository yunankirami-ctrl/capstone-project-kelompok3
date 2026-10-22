// [TIM] DAFTAR MATA PELAJARAN (kategori) se-apply.
// Dipakai di beranda murid (grid mapel) dan panel guru (dropdown pas bikin kuis).
// Id di bawah ini yang disimpan ke kolom category_id di tabel quizzes & questions.
// Mau nambah mapel baru? Tinggal tambah objek di sini. Inget: id harus unik & tanpa spasi.

export const CATEGORIES = [
  { id: 'math', name: 'Matematika', icon: '🔢', color: '#4F46E5' },
  { id: 'science', name: 'IPA (Sains)', icon: '🔬', color: '#10B981' },
  { id: 'indo', name: 'Bahasa Indonesia', icon: '📖', color: '#F59E0B' },
  { id: 'english', name: 'Bahasa Inggris', icon: '🔤', color: '#EC4899' }
]
