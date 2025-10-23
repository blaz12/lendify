import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // Import DatePipe
import { ApiService } from '../services/api.service';
import { BorrowRecord } from '../models';

@Component({
  selector: 'app-borrow-log',
  standalone: true,
  imports: [CommonModule, DatePipe], // Include DatePipe
  templateUrl: './borrow-log.component.html',
  styleUrl: './borrow-log.component.scss'
})
export class BorrowLogComponent implements OnInit {
  private apiService = inject(ApiService);

  isLoading = signal<boolean>(true);
  private allBorrowRecords = signal<BorrowRecord[]>([]);

  // Computed signal to filter for active borrow records
  activeBorrowRecords = computed(() => {
    return this.allBorrowRecords().filter(record => record.status === 'Borrowed');
  });

  async ngOnInit() {
    await this.loadBorrowRecords();
  }

  async loadBorrowRecords() {
    this.isLoading.set(true);
    try {
      const recordsData = await this.apiService.getBorrowRecords();
      // Ensure data has expected fields (userName, itemName are added by backend JOIN)
      this.allBorrowRecords.set(recordsData);
    } catch (error) {
      console.error("Error loading borrow records:", error);
      alert("Failed to load borrow records."); // Replace alert later
    } finally {
      this.isLoading.set(false);
    }
  }
}
