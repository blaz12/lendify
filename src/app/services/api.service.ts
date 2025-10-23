import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LendifyUser, EquipmentItem, BorrowRecord } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:3000/api';

  // --- Auth Methods (from previous steps) ---
  // login(...) { ... }
  // register(...) { ... }

  // --- Item Methods (from previous steps) ---
  getItems() {
    return firstValueFrom(this.http.get<EquipmentItem[]>(`${this.apiBaseUrl}/items`));
  }
  createItem(itemData: Omit<EquipmentItem, 'id'>) {
    return firstValueFrom(this.http.post<EquipmentItem>(`${this.apiBaseUrl}/items`, itemData));
  }
  updateItem(itemData: EquipmentItem) { // Corrected: Expects full item
    return firstValueFrom(this.http.put<EquipmentItem>(`${this.apiBaseUrl}/items/${itemData.id}`, itemData));
  }
  deleteItem(id: number) {
    return firstValueFrom(this.http.delete(`${this.apiBaseUrl}/items/${id}`));
  }

  // --- User Methods (Admin only - from previous steps) ---
  getUsers() {
     return firstValueFrom(this.http.get<LendifyUser[]>(`${this.apiBaseUrl}/users`));
  }
  createUser(userData: Omit<LendifyUser, 'id' | 'createdAt'> & { password?: string }) { // Added password for admin creation
    return firstValueFrom(this.http.post<LendifyUser>(`${this.apiBaseUrl}/users`, userData));
  }
  updateUser(userData: Omit<LendifyUser, 'createdAt'>) {
    return firstValueFrom(this.http.put<LendifyUser>(`${this.apiBaseUrl}/users/${userData.id}`, userData));
  }
  deleteUser(id: number) {
    return firstValueFrom(this.http.delete(`${this.apiBaseUrl}/users/${id}`));
  }

  // --- Borrow/Return Methods ---
  getBorrowRecords() {
    // This fetches ALL records; we'll filter them in the component
    return firstValueFrom(this.http.get<BorrowRecord[]>(`${this.apiBaseUrl}/borrow_records`));
  }

  borrowItem(userId: number, itemId: number) {
    return firstValueFrom(this.http.post<{ message: string }>(`${this.apiBaseUrl}/borrow`, { userId, itemId }));
  }

  returnItem(recordId: number) {
    return firstValueFrom(this.http.put<{ message: string }>(`${this.apiBaseUrl}/return/${recordId}`, {}));
  }
}

