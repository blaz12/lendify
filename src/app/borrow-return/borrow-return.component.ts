import { Component, OnInit, inject, signal, computed, WritableSignal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { EquipmentItem, BorrowRecord } from '../models';

// Interface to hold item details along with quantity for the borrow request
interface BorrowRequestItem extends EquipmentItem {
  quantityToBorrow: number; // Not strictly needed anymore but good for modal display
}

@Component({
  selector: 'app-borrow-return',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './borrow-return.component.html',
  styleUrl: './borrow-return.component.scss'
})
export class BorrowReturnComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  isLoading = signal<boolean>(true); // Used for initial load and submissions
  private allItems = signal<EquipmentItem[]>([]);
  private allBorrowRecords = signal<BorrowRecord[]>([]);
  searchTerm = signal<string>('');

  // --- State for Borrow Request Modal ---
  isBorrowModalOpen = signal<boolean>(false);
  borrowRequestItems = signal<BorrowRequestItem[]>([]);
  borrowQuantities = signal<{[itemId: number]: number}>({});
  usageLocation = signal<string>('');
  occasion = signal<string>('');
  borrowError = signal<string | null>(null);

  // --- State for Bulk Return ---
  selectedRecordIds = signal<Set<number>>(new Set()); // Use a Set for efficient add/delete
  returnError = signal<string | null>(null); // Error message for return section


  // Computed signal for items available (unchanged)
  availableItems = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const items = this.allItems().filter(item => item.stock > 0);
    if (!term) return items;
    return items.filter(item =>
      item.name.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.location.toLowerCase().includes(term)
    );
  });

  // Computed signal for user's borrowed items (unchanged)
  userBorrowedItems = computed<BorrowRecord[]>(() => {
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
      const [itemsData, recordsData] = await Promise.all([
        this.apiService.getItems(),
        this.apiService.getBorrowRecords()
      ]);
      this.allItems.set(itemsData);
      this.allBorrowRecords.set(recordsData);
      this.selectedRecordIds.set(new Set()); // Reset selections on data load
      this.returnError.set(null); // Clear return errors
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Failed to load data."); // Replace alert
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Borrow Request Modal Logic ---
  openBorrowModal() {
     this.borrowError.set(null); // Clear previous errors
     const available = this.allItems()
       .filter(item => item.stock > 0)
       .map(item => ({ ...item, quantityToBorrow: 0 }));
     this.borrowRequestItems.set(available);
     this.borrowQuantities.set({});
     this.usageLocation.set('');
     this.occasion.set('');
     this.isBorrowModalOpen.set(true);
  }
  closeBorrowModal() {
     this.isBorrowModalOpen.set(false);
   }
  updateQuantity(itemId: number, event: Event) {
     const inputElement = event.target as HTMLInputElement;
     let quantity = parseInt(inputElement.value, 10) || 0;
     const item = this.borrowRequestItems().find(i => i.id === itemId);

     if (item && quantity > item.stock) {
       quantity = item.stock;
       inputElement.value = quantity.toString();
       this.borrowError.set(`Cannot borrow more than ${item.stock} of ${item.name}.`);
     } else {
        this.borrowError.set(null);
     }
      if (quantity < 0) {
         quantity = 0;
         inputElement.value = quantity.toString();
      }

     this.borrowQuantities.update(quantities => {
       const updatedQuantities = {...quantities};
       if (quantity > 0) {
         updatedQuantities[itemId] = quantity;
       } else {
         delete updatedQuantities[itemId];
       }
       return updatedQuantities;
     });
   }
  async submitBorrowRequest() {
     const currentUser = this.authService.currentUser();
     if (!currentUser) { /* ... error handling ... */ return; }
     if (!this.usageLocation() || !this.occasion()) { /* ... error handling ... */ return; }
     const itemsToBorrowMap = this.borrowQuantities();
     if (Object.keys(itemsToBorrowMap).length === 0) { /* ... error handling ... */ return; }

     this.borrowError.set(null);
     this.isLoading.set(true);
     const payload = { userId: currentUser.id, items: itemsToBorrowMap, usageLocation: this.usageLocation(), occasion: this.occasion() };
     console.log("Submitting BATCH borrow request:", payload);
     try {
         const response = await this.apiService.borrowItemsBatch(payload);
         console.log("Batch borrow successful:", response.message);
         alert(response.message || "Items borrowed successfully."); // Replace alert
         this.closeBorrowModal();
         await this.loadData();
     } catch (error: any) {
         console.error("Error submitting batch borrow request:", error);
         const errorMessage = error?.error?.error || "Borrow request failed.";
         this.borrowError.set(errorMessage);
         await this.loadData();
     } finally {
         this.isLoading.set(false);
     }
   }


  // --- UPDATED: Return Logic ---

  // Toggle selection for a single record ID
  toggleReturnSelection(recordId: number, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.selectedRecordIds.update(currentSet => {
      const newSet = new Set(currentSet); // Create a mutable copy
      if (checkbox.checked) {
        newSet.add(recordId);
      } else {
        newSet.delete(recordId);
      }
      return newSet; // Return the new set to update the signal
    });
     console.log('Selected IDs:', this.selectedRecordIds()); // For debugging
  }

  // Check if any items are selected for return
  hasSelectedItems(): boolean {
    return this.selectedRecordIds().size > 0;
  }

  // Handle bulk return
  async returnSelectedItems() {
    const idsToReturn = Array.from(this.selectedRecordIds());
    if (idsToReturn.length === 0) {
      this.returnError.set("Please select at least one item to return.");
      return;
    }
     if (!confirm(`Are you sure you want to return ${idsToReturn.length} item(s)?`)) { // Replace confirm
        return;
     }

    this.isLoading.set(true);
    this.returnError.set(null);

    try {
      const response = await this.apiService.returnItemsBatch(idsToReturn);
      alert(response.message || `Successfully returned ${idsToReturn.length} item(s).`); // Replace alert
      await this.loadData(); // Reload data, which also resets selections
    } catch (error: any) {
      console.error("Error submitting batch return:", error);
      const errorMessage = error?.error?.error || "Batch return failed.";
      this.returnError.set(errorMessage);
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- UNCOMMENTED: Single Return method ---
  async returnSingleItem(recordId: number) {
     if (!confirm("Are you sure you want to return this item?")) { // Replace confirm
        return;
     }
     this.isLoading.set(true); // Indicate loading
     this.returnError.set(null); // Clear errors
    try {
      // Use the specific single-item return endpoint
      await this.apiService.returnItem(recordId);
      alert("Item returned successfully."); // Replace alert
      await this.loadData(); // Refresh data after returning
    } catch (error: any) {
      console.error("Error returning single item:", error);
      const errorMessage = error?.error?.error || "Failed to return item.";
      this.returnError.set(errorMessage); // Show error specific to this action
    } finally {
       this.isLoading.set(false); // Stop loading indicator
    }
  }
  // --- END UNCOMMENTED ---

}

