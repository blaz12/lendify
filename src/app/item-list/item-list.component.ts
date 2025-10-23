import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel
import { ApiService } from '../services/api.service';
import { EquipmentItem } from '../models';

@Component({
  selector: 'app-item-list',
  standalone: true,
  imports: [CommonModule, FormsModule], // Add FormsModule here
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.scss'
})
export class ItemListComponent implements OnInit {
  private apiService = inject(ApiService);

  // Signal to hold our list of items
  items = signal<EquipmentItem[]>([]);
  isLoading = signal<boolean>(true);

  // State for the modal
  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  
  // A signal to hold the item currently being edited or created
  currentItem = signal<EquipmentItem>({
    id: 0,
    name: '',
    category: '',
    stock: 0,
    location: '',
    status: 'Available'
  });

  ngOnInit() {
    this.loadItems();
  }

  async loadItems() {
    this.isLoading.set(true);
    try {
      const itemsData = await this.apiService.getItems();
      this.items.set(itemsData);
    } catch (error) {
      console.error("Error loading items:", error);
      // We'll add a proper notification for the user later
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Modal and Form Handling ---

  openModal(itemToEdit?: EquipmentItem) {
    if (itemToEdit) {
      // We are editing an existing item
      this.isEditing.set(true);
      // Set currentItem to a *copy* of the item to edit
      this.currentItem.set({ ...itemToEdit });
    } else {
      // We are adding a new item
      this.isEditing.set(false);
      // Reset the form to its default state
      this.currentItem.set({
        id: 0,
        name: '',
        category: '',
        stock: 0,
        location: '',
        status: 'Available' // Default status when adding
      });
    }
    // Open the modal
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  /**
   * Safely updates a field in the currentItem signal.
   * This avoids complex arrow functions in the template.
   */
  updateCurrentItem(field: keyof EquipmentItem, value: any) {
    this.currentItem.update(current => {
      const updatedItem = { ...current };

      switch (field) {
        case 'name':
        case 'category':
        case 'location':
          updatedItem[field] = String(value);
          break;
        
        case 'status':
          // Ensure the value is one of the allowed statuses
          if (value === 'Available' || value === 'Out of Stock') {
            updatedItem[field] = value;
          } else {
            updatedItem[field] = 'Available'; // Defaulting to Available
            console.warn(`Invalid status value received: ${value}. Defaulting to Available.`);
          }
          break;
          
        case 'id':
        case 'stock':
          const numValue = Number(value);
          updatedItem[field] = isNaN(numValue) ? 0 : numValue;
          break;
      }
      return updatedItem;
    });
  }

  async saveItem() {
    if (!this.currentItem().name || !this.currentItem().category) {
      alert("Please fill in at least the name and category.");
      return;
    }

    try {
      if (this.isEditing()) {
        // --- FIX: Pass only the current item object ---
        const updatedItem = await this.apiService.updateItem(this.currentItem()); 
        this.items.update(items => 
          items.map(item => item.id === updatedItem.id ? updatedItem : item)
        );
      } else {
        const { id, ...newItemData } = this.currentItem(); 
        newItemData.status = newItemData.stock > 0 ? 'Available' : 'Out of Stock';
        const createdItem = await this.apiService.createItem(newItemData);
        this.items.update(items => [...items, createdItem]);
      }
      this.closeModal(); 
      
    } catch (error) {
      console.error("Error saving item:", error);
      alert("Failed to save item. Please try again.");
    }
  }

  async deleteItem(item: EquipmentItem) {
    if (!confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await this.apiService.deleteItem(item.id);
      this.items.update(items => items.filter(i => i.id !== item.id));
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item. It may be in use.");
    }
  }
}

