export interface LendifyUser {
    id: number;
    name: string;
    studentId: string;
    email: string;
    role: 'admin' | 'student';
    createdAt?: string;
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
    borrowedDate: string;
    returnedDate: string | null;
    status: 'Borrowed' | 'Returned';
}

export type Page = 'dashboard' | 'items' | 'borrow' | 'return' | 'users';
