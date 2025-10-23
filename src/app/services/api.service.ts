import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http'; // Removed HttpErrorResponse if not used elsewhere
import { firstValueFrom } from 'rxjs';
import { LendifyUser, EquipmentItem, BorrowRecord } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:3000/api';

  // --- Auth Methods Removed ---
  // login(...) and register(...) methods are now handled by AuthService


  // --- Item Methods ---
  getItems() {
    console.log('ApiService: Fetching items...');
    return firstValueFrom(this.http.get<EquipmentItem[]>(`${this.apiBaseUrl}/items`));
  }

  createItem(itemData: Omit<EquipmentItem, 'id' | 'status'>) { // Backend sets status
    console.log('ApiService: Creating item...', itemData);
    return firstValueFrom(this.http.post<EquipmentItem>(`${this.apiBaseUrl}/items`, itemData));
  }

  updateItem(itemData: EquipmentItem) { // Expects full item, backend recalculates status
     console.log('ApiService: Updating item...', itemData);
    return firstValueFrom(this.http.put<EquipmentItem>(`${this.apiBaseUrl}/items/${itemData.id}`, itemData));
  }

  deleteItem(id: number) { // This is a hard delete for items currently
     console.log(`ApiService: Deleting item ID: ${id}`);
    return firstValueFrom(this.http.delete(`${this.apiBaseUrl}/items/${id}`));
  }


  // --- User Methods (Admin only) ---
  getUsers() { // Gets ACTIVE users
     console.log('ApiService: Fetching active users...');
     return firstValueFrom(this.http.get<LendifyUser[]>(`${this.apiBaseUrl}/users`));
  }

  getDeletedUsers() { // Gets DELETED users
     console.log('ApiService: Fetching deleted users...');
     return firstValueFrom(this.http.get<LendifyUser[]>(`${this.apiBaseUrl}/users/deleted`));
  }

  // Admin creates user (backend assigns default password)
  createUser(userData: Omit<LendifyUser, 'id' | 'createdAt' | 'deletedAt' | 'password'>) {
     console.log('ApiService: Creating user (admin)...', userData);
    return firstValueFrom(this.http.post<LendifyUser>(`${this.apiBaseUrl}/users`, userData));
  }

  // Admin updates user (cannot update password via this method)
  updateUser(userData: Omit<LendifyUser, 'createdAt' | 'deletedAt' | 'password'>) {
     console.log('ApiService: Updating user (admin)...', userData);
    return firstValueFrom(this.http.put<LendifyUser>(`${this.apiBaseUrl}/users/${userData.id}`, userData));
  }

  deleteUser(id: number) { // Performs SOFT delete
     console.log(`ApiService: Soft deleting user ID: ${id}`);
    return firstValueFrom(this.http.delete(`${this.apiBaseUrl}/users/${id}`));
  }

  recoverUser(id: number) { // Recovers a user
     console.log(`ApiService: Recovering user ID: ${id}`);
    return firstValueFrom(this.http.put<{ message: string }>(`${this.apiBaseUrl}/users/${id}/recover`, {}));
  }


  // --- Borrow/Return Methods ---
  getBorrowRecords() {
    // Fetches ALL records (active and returned), joined with user/item names
     console.log('ApiService: Fetching borrow records...');
    return firstValueFrom(this.http.get<BorrowRecord[]>(`${this.apiBaseUrl}/borrow_records`));
  }

  // Single item borrow (can be deprecated if only batch is used)
  borrowItem(userId: number, itemId: number) {
    console.warn('ApiService: Using single borrowItem - consider using borrowItemsBatch');
    return firstValueFrom(this.http.post<{ message: string }>(`${this.apiBaseUrl}/borrow`, { userId, itemId }));
  }

  // Batch item borrow (primary method for borrowing)
  borrowItemsBatch(payload: { userId: number; items: { [itemId: number]: number }; usageLocation: string; occasion: string }) {
     console.log('ApiService: Submitting batch borrow request...', payload);
    return firstValueFrom(this.http.post<{ message: string }>(`${this.apiBaseUrl}/borrow/batch`, payload));
  }

  // Return a specific borrowed item instance
  returnItem(recordId: number) {
     console.log(`ApiService: Returning item for record ID: ${recordId}`);
    return firstValueFrom(this.http.put<{ message: string }>(`${this.apiBaseUrl}/return/${recordId}`, {}));
  }

  // --- NEW: Batch item return ---
  returnItemsBatch(recordIds: number[]) {
    console.log(`ApiService: Submitting batch return request for record IDs: ${recordIds.join(', ')}`);
    return firstValueFrom(this.http.post<{ message: string }>(`${this.apiBaseUrl}/return/batch`, { recordIds }));
  }
  // --- END NEW ---
}

