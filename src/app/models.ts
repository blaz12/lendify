export interface LendifyUser {
    id: number;
    name: string;
    studentId: string;
    email: string;
    role: 'admin' | 'student';
    createdAt?: string; // Optional property from the database
    deletedAt?: string | null; // <-- ADD THIS LINE (optional, can be string or null)
}

export interface EquipmentItem {
    id: number;
    name: string;
    category: string;
    stock: number;
    location: string;
    status: 'Available' | 'Out of Stock';
}

export interface BorrowRecord {
    id: number;
    userId: number;
    userName: string;
    itemId: number;
    itemName: string;
    studentId: string;
    borrowedDate: string;
    returnedDate: string | null;
    status: 'Borrowed' | 'Returned';
}

// You might also want this type if you use it in app.component.ts
export type Page = 'dashboard' | 'items' | 'borrow-return' | 'users';

