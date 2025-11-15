# Lendify – Aplikasi Peminjaman Inventaris Kampus

Lendify adalah aplikasi web prototipe yang membantu kampus mengelola peminjaman inventaris seperti kamera, tripod, laptop, dan perlengkapan multimedia lainnya.  
Aplikasi ini memiliki fitur login, register, manajemen inventaris, peminjaman, riwayat, serta autentikasi JWT.

---

##Daftar Isi
- Fitur Utama
- Teknologi yang Digunakan
- Struktur Project
- Instalasi & Menjalankan Aplikasi
- Endpoint Backend
- Screenshots
- License

---

##Fitur Utama
- Login & Register (dengan JWT + bcrypt)
- Daftar inventaris kampus
- Sistem peminjaman
- Riwayat peminjaman
- REST API Express.js
- Frontend Angular
- MySQL database

---

##Teknologi yang Digunakan

**Frontend**
- Angular 16  
- TypeScript  
- Bootstrap  

**Backend**
- Node.js  
- Express.js  
- JWT  
- MySQL (mysql2)

**Tools**
- XAMPP  
- Postman (opsional)

---

##Struktur Project
```
lendify/
│
├── server/                 # Backend (Node.js)
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   └── config/
│
└── LENDIFY/                # Frontend (Angular)
    ├── src/
    ├── angular.json
    └── package.json
```

---

##Instalasi & Menjalankan Aplikasi

### 1. Clone Repository
```bash
git clone https://github.com/blaz12/lendify.git
```

Masuk ke folder project:
```bash
cd lendify
```

---

### 2. Setup Database

1. Jalankan Apache + MySQL melalui XAMPP  
2. Buka phpMyAdmin  
3. Buat database baru bernama **lendify_db**  
4. Import file SQL bila tersedia  

---

### 3. Menjalankan Backend

Masuk folder backend:
```bash
cd server
```

Install dependencies:
```bash
npm install express mysql2 cors jsonwebtoken bcryptjs
```

Jalankan server:
`````bash
node server.js
```

Backend berjalan di:
```
http://localhost:3000
```

---

### 4. Menjalankan Frontend

Masuk folder Angular:
```bash
cd ../LENDIFY
```

Install dependencies:
```bash
npm install
```

Install Angular CLI jika belum ada:
```bash
npm install -g @angular/cli
```

Jalankan aplikasi:
```bash
ng serve
```

Frontend berjalan di:
```
http://localhost:4200
```

---

##Endpoint Backend

| Method | Endpoint        | Deskripsi |
|--------|------------------|-----------|
| POST   | /register        | Registrasi user |
| POST   | /login           | Login + JWT |
| GET    | /inventory       | Daftar inventaris |
| POST   | /borrow          | Peminjaman |
| GET    | /history/:userId | Riwayat peminjaman |

---
