Lendify – Aplikasi Peminjaman Inventaris Kampus

Dokumentasi ini merupakan README untuk proyek aplikasi Lendify, sesuai dengan Task 6.1. Lendify adalah aplikasi web prototipe untuk manajemen peminjaman inventaris kampus dengan arsitektur terpisah antara frontend dan backend.

1. Deskripsi Sistem

Lendify adalah aplikasi berbasis web yang terdiri dari:

Frontend: Angular

Backend: Node.js (REST API)

Database: MySQL (menggunakan XAMPP)

Peran dalam Aplikasi

New User

Membuat akun baru.

Student (Mahasiswa)

Melihat dan mencari item.

Meminjam item (batch, lengkap dengan lokasi dan occasion).

Mengembalikan item (batch atau individu).

Admin

Semua kemampuan Student.

Mengelola item (CRUD).

Mengelola user (CRUD, soft delete, recover).

Melihat Borrow Log lengkap.

Mengakses statistik tambahan pada Dashboard.

2. Arsitektur Komponen (MVC)
Model

Struktur database MySQL (file database_restore.sql).

Backend Node.js (server.js) yang menangani logika bisnis.

Angular services:

auth.service.ts (autentikasi)

api.service.ts (komunikasi API)

View

File HTML dari setiap komponen Angular.

Controller

File TypeScript pada setiap komponen Angular.

3. Struktur Folder Proyek
src/app/
├── auth/                 
├── borrow-log/           
├── borrow-return/        
├── dashboard/            
├── item-list/            
├── services/
│   ├── api.service.ts
│   └── auth.service.ts
├── user-list/            
├── app.component.html
├── app.component.ts
├── app.config.ts
├── app.routes.ts
├── models.ts
└── ...

4. Cara Menjalankan Aplikasi
Prasyarat

Install Angular CLI:

npm install -g @angular/cli

Langkah 1: Setup Database (MySQL)

Jalankan Apache dan MySQL melalui XAMPP.

Buka phpMyAdmin melalui http://localhost/phpmyadmin.

Buat database dengan nama lendify_db.

Buka tab SQL di dalam database.

Paste isi file database_restore.sql, lalu jalankan.

Langkah 2: Menjalankan Backend (Node.js)

Masuk ke folder backend:

cd path/to/project/server


Install dependencies:

npm install express mysql2 cors


Jalankan server backend:

node server.js


Backend berjalan pada:

http://localhost:3000

Langkah 3: Menjalankan Frontend (Angular)

Masuk ke folder frontend:

cd path/to/project/LENDIFY


Install dependencies:

npm install


Install zone.js (karena project dibuat dengan flag minimal):

npm install zone.js


Jalankan frontend:

ng serve


Akses aplikasi melalui:

http://localhost:4200
