import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../services/api.service';
import { EquipmentItem, BorrowRecord } from '../models';

// Interface for our calculated stats
interface DashboardStats {
  totalCategories: number;
  totalStock: number;
  totalBorrowed: number;
  totalItems: number;
  itemsPerCategory: { category: string, count: number }[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);

  // Signals to hold our raw data
  private items = signal<EquipmentItem[]>([]);
  private borrowRecords = signal<BorrowRecord[]>([]);

  // A signal to track the loading state
  isLoading = signal<boolean>(true);

  // A computed signal that automatically calculates stats whenever the data changes
  stats = computed<DashboardStats>(() => {
    const allItems = this.items();
    const categories = [...new Set(allItems.map(i => i.category))];
    const itemsPerCategory = categories.map(cat => ({
      category: cat,
      count: allItems.filter(i => i.category === cat).length
    })).sort((a, b) => b.count - a.count); // Sort by count descending

    return {
      totalCategories: categories.length,
      totalStock: allItems.reduce((sum, i) => sum + i.stock, 0),
      totalBorrowed: this.borrowRecords().filter(r => r.status === 'Borrowed').length,
      totalItems: allItems.length,
      itemsPerCategory
    };
  });

  ngOnInit() {
    this.loadDashboardData();
  }

  async loadDashboardData() {
    this.isLoading.set(true);
    try {
      // Fetch items and records in parallel for faster loading
      const [itemsData, recordsData] = await Promise.all([
        this.apiService.getItems(),
        this.apiService.getBorrowRecords()
      ]);
      
      this.items.set(itemsData);
      this.borrowRecords.set(recordsData);
      
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      // We'll add a proper notification for the user later
    } finally {
      this.isLoading.set(false);
    }
  }
}
