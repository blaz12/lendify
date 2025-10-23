import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // Import DatePipe
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { EquipmentItem, BorrowRecord } from '../models';

@Component({
  selector: 'app-borrow-return',
  standalone: true,
  imports: [CommonModule, DatePipe], // Add DatePipe to imports
  templateUrl: './borrow-return.component.html',
  styleUrl: './borrow-return.component.scss'
})
export class BorrowReturnComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService); // Inject AuthService

  isLoading = signal<boolean>(true);
  private allItems = signal<EquipmentItem[]>([]);
  private allBorrowRecords = signal<BorrowRecord[]>([]);

  // Computed signal for items available to borrow (stock > 0)
  availableItems = computed(() => this.allItems().filter(item => item.stock > 0));

  // Computed signal for items currently borrowed by the logged-in user
  userBorrowedItems = computed(() => {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return [];
    return this.allBorrowRecords().filter(record =>
      record.userId === currentUserId && record.status === 'Borrowed'
    );
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      // Fetch both items and records in parallel
      const [itemsData, recordsData] = await Promise.all([
        this.apiService.getItems(),
        this.apiService.getBorrowRecords()
      ]);
      this.allItems.set(itemsData);
      this.allBorrowRecords.set(recordsData);
    } catch (error) {
      console.error("Error loading borrow/return data:", error);
      // Add user notification later
    } finally {
      this.isLoading.set(false);
    }
  }

  async borrow(item: EquipmentItem) {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      alert("Please log in to borrow items."); // Replace with better notification
      return;
    }
    if (item.stock <= 0) {
       alert("Item is out of stock.");
       return;
    }

    try {
      await this.apiService.borrowItem(currentUser.id, item.id);
      alert(`Successfully borrowed ${item.name}.`); // Replace alert
      await this.loadData(); // Refresh data after borrowing
    } catch (error) {
      console.error("Error borrowing item:", error);
      alert("Failed to borrow item."); // Replace alert
    }
  }

  async return(recordId: number) {
     if (!confirm("Are you sure you want to return this item?")) { // Replace confirm
        return;
     }
    try {
      await this.apiService.returnItem(recordId);
      alert("Item returned successfully."); // Replace alert
      await this.loadData(); // Refresh data after returning
    } catch (error) {
      console.error("Error returning item:", error);
      alert("Failed to return item."); // Replace alert
    }
  }
}
