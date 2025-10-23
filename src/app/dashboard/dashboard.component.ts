import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // Import DatePipe
import { ApiService } from '../services/api.service';
import { EquipmentItem, BorrowRecord } from '../models';

// Interface for our calculated stats
interface DashboardStats {
  totalCategories: number;
  totalStock: number;
  totalBorrowed: number;
  totalItems: number; // For percentage calculation
  itemsPerCategory: { category: string; count: number }[];
}

// Type to track which detail section is expanded
type ExpandedSection = 'categories' | 'inventory' | 'borrowed' | null;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe], // Include DatePipe
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'] // Corrected from styleUrl
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);

  isLoading = signal<boolean>(true);
  // Signals to store the full data lists
  private allItems = signal<EquipmentItem[]>([]);
  private allBorrowRecords = signal<BorrowRecord[]>([]);

  // Signal to track the currently expanded section
  expandedSection = signal<ExpandedSection>(null);

  // --- Computed Signals ---

  // Basic stats calculation (remains mostly the same)
  stats = computed<DashboardStats>(() => {
    const items = this.allItems();
    const categories = [...new Set(items.map(i => i.category))];
    const itemsPerCategory = categories.map(cat => ({
      category: cat,
      count: items.filter(i => i.category === cat).length
    }));
    const currentlyBorrowed = this.allBorrowRecords().filter(r => r.status === 'Borrowed').length;

    return {
      totalCategories: categories.length,
      totalStock: items.reduce((sum, i) => sum + i.stock, 0),
      totalBorrowed: currentlyBorrowed,
      totalItems: items.length,
      itemsPerCategory
    };
  });

  // Filtered list for currently borrowed items (needed for the expanded view)
  activeBorrowRecords = computed(() => {
    return this.allBorrowRecords().filter(record => record.status === 'Borrowed');
  });

  // Get list of unique categories (needed for the expanded view)
  uniqueCategories = computed(() => {
    return [...new Set(this.allItems().map(item => item.category))].sort();
  });

  // Get list of all items currently in stock (needed for the expanded view)
  inventoryItems = computed(() => {
     return this.allItems().filter(item => item.stock > 0);
  });


  async ngOnInit() {
    await this.loadDashboardData();
  }

  async loadDashboardData() {
    this.isLoading.set(true);
    try {
      // Fetch all necessary data in parallel
      const [itemsData, recordsData] = await Promise.all([
        this.apiService.getItems(),
        this.apiService.getBorrowRecords() // Fetch all records
      ]);
      this.allItems.set(itemsData);
      this.allBorrowRecords.set(recordsData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      alert("Failed to load dashboard data."); // Replace alert later
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Methods to Toggle Expanded Sections ---
  toggleSection(section: ExpandedSection) {
    // If the clicked section is already open, close it. Otherwise, open it.
    this.expandedSection.update(current => current === section ? null : section);
  }
}

