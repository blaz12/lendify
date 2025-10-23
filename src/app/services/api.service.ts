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

  // --- Auth Methods ---
  login(studentId: string, password: string) {
    return firstValueFrom(this.http.post<LendifyUser>(`${this.apiBaseUrl}/login`, { studentId, password }));
  }
  register(name: string, studentId: string, email: string, password: string) {
    return firstValueFrom(this.http.post<LendifyUser>(`${this.apiBaseUrl}/register`, { name, studentId, email, password }));
  }


  // --- Item Methods ---
  getItems() {
    return firstValueFrom(this.http.get<EquipmentItem[]>(`${this.apiBaseUrl}/items`));
  }
  createItem(itemData: Omit<EquipmentItem, 'id'>) {
    return firstValueFrom(this.http.post<EquipmentItem>(`${this.apiBaseUrl}/items`, itemData));
  }
  updateItem(itemData: EquipmentItem) { // Expects full item
    return firstValueFrom(this.http.put<EquipmentItem>(`${this.apiBaseUrl}/items/${itemData.id}`, itemData));
  }
  deleteItem(id: number) {
    return firstValueFrom(this.http.delete(`${this.apiBaseUrl}/items/${id}`));
  }


  // --- User Methods (Admin only) ---
  getUsers() { // Gets ACTIVE users
     return firstValueFrom(this.http.get<LendifyUser[]>(`${this.apiBaseUrl}/users`));
  }

  getDeletedUsers() { // Gets DELETED users
     return firstValueFrom(this.http.get<LendifyUser[]>(`${this.apiBaseUrl}/users/deleted`));
  }

  createUser(userData: Omit<LendifyUser, 'id' | 'createdAt' | 'deletedAt'>) { // Make sure deletedAt isn't sent
    return firstValueFrom(this.http.post<LendifyUser>(`${this.apiBaseUrl}/users`, userData));
  }

  updateUser(userData: Omit<LendifyUser, 'createdAt' | 'deletedAt'>) { // Make sure deletedAt isn't sent
    // Backend ensures we only update active users
    return firstValueFrom(this.http.put<LendifyUser>(`${this.apiBaseUrl}/users/${userData.id}`, userData));
  }

  deleteUser(id: number) { // Performs SOFT delete
    return firstValueFrom(this.http.delete(`${this.apiBaseUrl}/users/${id}`));
  }

  recoverUser(id: number) { // Recovers a user
    return firstValueFrom(this.http.put<{ message: string }>(`${this.apiBaseUrl}/users/${id}/recover`, {}));
  }


  // --- Borrow/Return Methods ---
  getBorrowRecords() {
    return firstValueFrom(this.http.get<BorrowRecord[]>(`${this.apiBaseUrl}/borrow_records`));
  }
  borrowItem(userId: number, itemId: number) {
    return firstValueFrom(this.http.post<{ message: string }>(`${this.apiBaseUrl}/borrow`, { userId, itemId }));
  }
  returnItem(recordId: number) {
    return firstValueFrom(this.http.put<{ message: string }>(`${this.apiBaseUrl}/return/${recordId}`, {}));
  }
}

