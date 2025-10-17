import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChangeDetectionStrategy, computed, WritableSignal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http'; // <-- IMPORTED HttpClientModule
import { firstValueFrom } from 'rxjs';

// --- TYPE DEFINITIONS (Updated for MySQL) ---
// Note: IDs are now numbers, and dates will be strings from the API.
interface LendifyUser {
    id: number;
    name: string;
    studentId: string;
    email: string;
}

interface EquipmentItem {
    id: number;
    name: string;
    category: string;
    stock: number;
    location: string;
    status: 'Available' | 'Out of Stock';
}

interface BorrowRecord {
    id: number;
    userId: number;
    userName: string; 
    itemId: number;
    itemName: string; 
    borrowedDate: string; // Comes as a string from MySQL
    returnedDate: string | null;
    status: 'Borrowed' | 'Returned';
}

type Page = 'dashboard' | 'items' | 'borrow' | 'return' | 'users';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule], // <-- ADDED HttpClientModule HERE
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [`
      /* Custom scrollbar for better aesthetics */
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
      ::-webkit-scrollbar-thumb { background: #888; border-radius: 10px; }
      ::-webkit-scrollbar-thumb:hover { background: #555; }
      .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
      .modal-content { max-height: 90vh; overflow-y: auto; }
      .notification { position: fixed; top: 20px; right: 20px; z-index: 2000; transition: opacity 0.3s ease-in-out; }
    `],
    template: `
    <!-- This template remains largely the same, but now its data is powered by your MySQL server -->
    <div class="antialiased text-slate-700 bg-slate-50 min-h-screen">
        <!-- Main Container -->
        <div class="flex min-h-screen">

            <!-- Sidebar Navigation -->
            @if (currentUser()) {
              <aside class="w-64 bg-white shadow-md flex-shrink-0 flex flex-col">
                  <div class="p-6 text-center border-b">
                      <h1 class="text-2xl font-bold text-indigo-600">Lendify</h1>
                      <p class="text-sm text-slate-500">Campus Equipment</p>
                  </div>
                  <nav class="p-4 flex-grow">
                      <ul>
                          @for (item of navigationItems; track item.id) {
                            <li>
                                <a (click)="currentPage.set(item.id)"
                                   [class.bg-indigo-100]="currentPage() === item.id"
                                   [class.text-indigo-600]="currentPage() === item.id"
                                   class="flex items-center p-3 my-1 rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors">
                                    <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="item.icon"></path></svg>
                                    <span>{{ item.label }}</span>
                                </a>
                            </li>
                          }
                      </ul>
                  </nav>
                   <div class="p-4 border-t">
                        <div class="flex items-center">
                            <div class="w-10 h-10 bg-indigo-200 rounded-full flex items-center justify-center font-bold text-indigo-600">
                                {{ currentUser()?.name?.charAt(0) }}
                            </div>
                            <div class="ml-3">
                                <p class="font-semibold text-sm">{{ currentUser()?.name }}</p>
                                <p class="text-xs text-slate-500">{{ currentUser()?.studentId }}</p>
                            </div>
                        </div>
                        <button (click)="logout()" class="w-full mt-4 text-sm text-center p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">Logout</button>
                    </div>
              </aside>
            }

            <!-- Main Content -->
            <main class="flex-1 p-8 overflow-y-auto">
                @if (!currentUser()) {
                    <!-- Login View -->
                    <div class="flex items-center justify-center h-full">
                        <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
                            <h2 class="text-3xl font-bold text-center text-gray-800">Welcome to Lendify</h2>
                            <p class="text-center text-gray-500">Please sign in with your Student ID</p>
                            <div>
                                <label for="studentId" class="text-sm font-medium text-gray-700">Student ID</label>
                                <input #loginId type="text" id="studentId" (keyup.enter)="login(loginId.value)"
                                       class="w-full px-4 py-2 mt-2 text-base text-gray-700 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                       placeholder="e.g., 12345678">
                            </div>
                            <button (click)="login(loginId.value)"
                                    class="w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                                Login
                            </button>
                             @if(loginError()) {
                                <p class="text-sm text-red-500 text-center">{{ loginError() }}</p>
                            }
                        </div>
                    </div>
                } @else {
                    <!-- Logged In Views -->
                    @switch (currentPage()) {
                        @case ('dashboard') { <ng-container *ngTemplateOutlet="dashboardView"></ng-container> }
                        @case ('items') { <ng-container *ngTemplateOutlet="itemsView"></ng-container> }
                        @case ('borrow') { <ng-container *ngTemplateOutlet="borrowView"></ng-container> }
                        @case ('return') { <ng-container *ngTemplateOutlet="returnView"></ng-container> }
                        @case ('users') { <ng-container *ngTemplateOutlet="usersView"></ng-container> }
                    }
                }
            </main>
        </div>

        <!-- Templates for different views -->

        <!-- Dashboard View -->
        <ng-template #dashboardView>
            <h2 class="text-3xl font-bold mb-6">Dashboard</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Stat Cards -->
                <div class="p-6 bg-white rounded-xl shadow-lg flex items-center">
                   <div class="p-3 bg-blue-100 rounded-full"><svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"></path></svg></div>
                   <div class="ml-4">
                       <p class="text-sm text-gray-500">Total Item Categories</p>
                       <p class="text-2xl font-bold">{{ stats().totalCategories }}</p>
                   </div>
                </div>
                <div class="p-6 bg-white rounded-xl shadow-lg flex items-center">
                    <div class="p-3 bg-green-100 rounded-full"><svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg></div>
                   <div class="ml-4">
                       <p class="text-sm text-gray-500">Items in Inventory</p>
                       <p class="text-2xl font-bold">{{ stats().totalStock }}</p>
                   </div>
                </div>
                <div class="p-6 bg-white rounded-xl shadow-lg flex items-center">
                    <div class="p-3 bg-yellow-100 rounded-full"><svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                   <div class="ml-4">
                       <p class="text-sm text-gray-500">Currently Borrowed</p>
                       <p class="text-2xl font-bold">{{ stats().totalBorrowed }}</p>
                   </div>
                </div>
            </div>

            <div class="mt-8 bg-white p-6 rounded-xl shadow-lg">
                <h3 class="text-xl font-bold mb-4">Items by Category</h3>
                 @if(stats().itemsPerCategory.length > 0) {
                     <div class="space-y-4">
                        @for(cat of stats().itemsPerCategory; track cat.category) {
                            <div>
                                <div class="flex justify-between items-center mb-1">
                                    <span class="text-sm font-medium">{{ cat.category }}</span>
                                    <span class="text-sm text-gray-500">{{ cat.count }} Items</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2.5">
                                    <div class="bg-indigo-600 h-2.5 rounded-full" [style.width.%]="(cat.count / stats().totalItems) * 100"></div>
                                </div>
                            </div>
                        }
                    </div>
                } @else {
                    <p class="text-center text-gray-500">No item data available.</p>
                }
            </div>
        </ng-template>

        <!-- Item Management View -->
        <ng-template #itemsView>
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-3xl font-bold">Equipment Management</h2>
                <button (click)="openItemModal()" class="px-4 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Add New Item</button>
            </div>
            <div class="bg-white rounded-xl shadow-lg overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-500">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3">Name</th>
                            <th scope="col" class="px-6 py-3">Category</th>
                            <th scope="col" class="px-6 py-3">Stock</th>
                            <th scope="col" class="px-6 py-3">Location</th>
                            <th scope="col" class="px-6 py-3">Status</th>
                            <th scope="col" class="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @for (item of items(); track item.id) {
                            <tr class="bg-white border-b hover:bg-gray-50">
                                <td class="px-6 py-4 font-medium text-gray-900">{{ item.name }}</td>
                                <td class="px-6 py-4">{{ item.category }}</td>
                                <td class="px-6 py-4">{{ item.stock }}</td>
                                <td class="px-6 py-4">{{ item.location }}</td>
                                <td class="px-6 py-4">
                                    <span [class.bg-green-100]="item.status === 'Available'"
                                          [class.text-green-800]="item.status === 'Available'"
                                          [class.bg-red-100]="item.status === 'Out of Stock'"
                                          [class.text-red-800]="item.status === 'Out of Stock'"
                                          class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                                        {{ item.status }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 flex space-x-2">
                                    <button (click)="openItemModal(item)" class="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    <button (click)="deleteItem(item.id)" class="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        }
                    </tbody>
                </table>
                 @if (items().length === 0) {
                    <p class="text-center py-8 text-gray-500">No equipment found. Add a new item to get started.</p>
                }
            </div>
        </ng-template>

        <!-- Borrow View -->
        <ng-template #borrowView>
            <h2 class="text-3xl font-bold mb-6">Borrow Equipment</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 @for (item of availableItems(); track item.id) {
                    <div class="bg-white rounded-xl shadow-lg p-6 flex flex-col">
                        <h3 class="font-bold text-lg">{{ item.name }}</h3>
                        <p class="text-sm text-gray-500">{{ item.category }}</p>
                        <div class="mt-4 flex-grow">
                            <p class="text-sm"><span class="font-semibold">Location:</span> {{ item.location }}</p>
                            <p class="text-sm"><span class="font-semibold">In Stock:</span> {{ item.stock }}</p>
                        </div>
                        <button (click)="borrowItem(item)" class="w-full mt-4 px-4 py-2 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">Borrow</button>
                    </div>
                }
                 @if (availableItems().length === 0) {
                    <p class="text-center text-gray-500 col-span-full">All items are currently out of stock or no items have been added.</p>
                }
            </div>
        </ng-template>

        <!-- Return View -->
        <ng-template #returnView>
            <h2 class="text-3xl font-bold mb-6">Return Equipment</h2>
            <p class="mb-6 text-gray-600">Here are the items you are currently borrowing. Click 'Return' to complete the process.</p>
             <div class="bg-white rounded-xl shadow-lg overflow-x-auto">
                 <table class="w-full text-sm text-left text-gray-500">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3">Item Name</th>
                            <th scope="col" class="px-6 py-3">Borrowed Date</th>
                            <th scope="col" class="px-6 py-3">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                         @for (record of userBorrowedItems(); track record.id) {
                            <tr class="bg-white border-b hover:bg-gray-50">
                                <td class="px-6 py-4 font-medium text-gray-900">{{ record.itemName }}</td>
                                <td class="px-6 py-4">{{ record.borrowedDate | date:'medium' }}</td>
                                <td class="px-6 py-4">
                                    <button (click)="returnItem(record)" class="px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Return</button>
                                </td>
                            </tr>
                        }
                    </tbody>
                </table>
                 @if (userBorrowedItems().length === 0) {
                    <p class="text-center py-8 text-gray-500">You are not currently borrowing any items.</p>
                }
            </div>
        </ng-template>

        <!-- User Management View -->
        <ng-template #usersView>
             <div class="flex justify-between items-center mb-6">
                <h2 class="text-3xl font-bold">User Management</h2>
                <button (click)="openUserModal()" class="px-4 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Add New User</button>
            </div>
             <div class="bg-white rounded-xl shadow-lg overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-500">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3">Name</th>
                            <th scope="col" class="px-6 py-3">Student ID</th>
                            <th scope="col" class="px-6 py-3">Email</th>
                            <th scope="col" class="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                         @for (user of users(); track user.id) {
                            <tr class="bg-white border-b hover:bg-gray-50">
                                <td class="px-6 py-4 font-medium text-gray-900">{{ user.name }}</td>
                                <td class="px-6 py-4">{{ user.studentId }}</td>
                                <td class="px-6 py-4">{{ user.email }}</td>
                                <td class="px-6 py-4 flex space-x-2">
                                    <button (click)="openUserModal(user)" class="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    <button (click)="deleteUser(user.id)" class="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        }
                    </tbody>
                </table>
                 @if (users().length === 0) {
                    <p class="text-center py-8 text-gray-500">No users found. Add a user to get started.</p>
                }
            </div>
        </ng-template>

        <!-- Modals -->
        @if(isItemModalOpen()) {
            <div class="modal-backdrop">
                <div class="modal-content w-full max-w-lg p-8 space-y-4 bg-white rounded-xl shadow-lg">
                    <h3 class="text-2xl font-bold">{{ editingItem() ? 'Edit' : 'Add' }} Item</h3>
                    <div>
                        <label class="text-sm font-medium">Name</label>
                        <input [(ngModel)]="itemForm.name" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="text" placeholder="e.g., MacBook Pro 14">
                    </div>
                     <div>
                        <label class="text-sm font-medium">Category</label>
                        <input [(ngModel)]="itemForm.category" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="text" placeholder="e.g., Electronics">
                    </div>
                     <div>
                        <label class="text-sm font-medium">Stock</label>
                        <input [(ngModel)]="itemForm.stock" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" min="0">
                    </div>
                     <div>
                        <label class="text-sm font-medium">Location</label>
                        <input [(ngModel)]="itemForm.location" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="text" placeholder="e.g., Library Room 201">
                    </div>
                    <div class="flex justify-end space-x-4 pt-4">
                        <button (click)="isItemModalOpen.set(false)" class="px-4 py-2 font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button (click)="saveItem()" class="px-4 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save Item</button>
                    </div>
                </div>
            </div>
        }

        @if(isUserModalOpen()) {
             <div class="modal-backdrop">
                <div class="modal-content w-full max-w-lg p-8 space-y-4 bg-white rounded-xl shadow-lg">
                    <h3 class="text-2xl font-bold">{{ editingUser() ? 'Edit' : 'Add' }} User</h3>
                    <div>
                        <label class="text-sm font-medium">Full Name</label>
                        <input [(ngModel)]="userForm.name" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="text" placeholder="e.g., John Doe">
                    </div>
                     <div>
                        <label class="text-sm font-medium">Student ID</label>
                        <input [(ngModel)]="userForm.studentId" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="text" placeholder="e.g., 12345678">
                    </div>
                     <div>
                        <label class="text-sm font-medium">Email</label>
                        <input [(ngModel)]="userForm.email" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="email" placeholder="e.g., john.doe@university.edu">
                    </div>
                    <div class="flex justify-end space-x-4 pt-4">
                        <button (click)="isUserModalOpen.set(false)" class="px-4 py-2 font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button (click)="saveUser()" class="px-4 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save User</button>
                    </div>
                </div>
            </div>
        }

        <!-- Notification -->
        @if(notification(); as notification) {
            <div class="notification p-4 rounded-lg shadow-xl text-white font-semibold"
                 [class.bg-green-500]="notification.type === 'success'"
                 [class.bg-red-500]="notification.type === 'error'">
              {{ notification.message }}
            </div>
        }
    </div>
    `
})
export class App implements OnInit {
    // --- STATE MANAGEMENT (Signals) ---
    currentPage = signal<Page>('dashboard');
    currentUser: WritableSignal<LendifyUser | null> = signal(null);
    loginError = signal<string | null>(null);

    // Data signals
    users = signal<LendifyUser[]>([]);
    items = signal<EquipmentItem[]>([]);
    borrowRecords = signal<BorrowRecord[]>([]);

    // Modal states
    isItemModalOpen = signal(false);
    editingItem: WritableSignal<EquipmentItem | null> = signal(null);
    itemForm!: EquipmentItem; // Initialized in openItemModal

    isUserModalOpen = signal(false);
    editingUser: WritableSignal<LendifyUser | null> = signal(null);
    userForm!: LendifyUser; // Initialized in openUserModal

    // Notification signal
    notification = signal<{ message: string; type: 'success' | 'error' } | null>(null);

    // --- DEPENDENCY INJECTION ---
    private http = inject(HttpClient);
    private readonly apiBaseUrl = 'http://localhost:3000/api'; // URL of your Node.js server

    // --- NAVIGATION ---
    navigationItems: { id: Page; label: string; icon: string }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
        { id: 'items', label: 'Manage Items', icon: 'M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z' },
        { id: 'borrow', label: 'Borrow Item', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
        { id: 'return', label: 'Return Item', icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' },
        { id: 'users', label: 'Manage Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 21a6 6 0 00-6-6h6m6 0a6 6 0 00-6-6m6 6a6 6 0 00-6 6' },
    ];

    ngOnInit(): void {
        this.fetchAllData();
    }

    async fetchAllData() {
        try {
            const users = await firstValueFrom(this.http.get<LendifyUser[]>(`${this.apiBaseUrl}/users`));
            this.users.set(users);
            const items = await firstValueFrom(this.http.get<EquipmentItem[]>(`${this.apiBaseUrl}/items`));
            this.items.set(items);
            const records = await firstValueFrom(this.http.get<BorrowRecord[]>(`${this.apiBaseUrl}/borrow_records`));
            this.borrowRecords.set(records);
        } catch (error) {
            console.error("Failed to fetch initial data", error);
            this.showNotification("Could not connect to the server.", "error");
        }
    }

    // --- COMPUTED SIGNALS ---
    availableItems = computed(() => this.items().filter(item => item.status === 'Available' && item.stock > 0));
    userBorrowedItems = computed(() => this.borrowRecords().filter(r => r.userId === this.currentUser()?.id && r.status === 'Borrowed'));
    stats = computed(() => {
        const allItems = this.items();
        const categories = [...new Set(allItems.map(i => i.category))];
        const itemsPerCategory = categories.map(cat => ({
            category: cat,
            count: allItems.filter(i => i.category === cat).length
        }));
        return {
            totalCategories: categories.length,
            totalStock: allItems.reduce((sum, i) => sum + i.stock, 0),
            totalBorrowed: this.borrowRecords().filter(r => r.status === 'Borrowed').length,
            totalItems: allItems.length,
            itemsPerCategory
        };
    });

    // --- AUTHENTICATION ---
    login(studentId: string) {
        if (!studentId?.trim()) {
            this.loginError.set("Student ID cannot be empty.");
            return;
        }
        const foundUser = this.users().find(u => u.studentId === studentId.trim());
        if (foundUser) {
            this.currentUser.set(foundUser);
            this.loginError.set(null);
        } else {
            this.loginError.set("No user found with this Student ID. Please contact an admin.");
            this.currentUser.set(null);
        }
    }

    logout() {
        this.currentUser.set(null);
        this.currentPage.set('dashboard');
    }

    // --- CRUD OPERATIONS ---
    private showNotification(message: string, type: 'success' | 'error') {
        this.notification.set({ message, type });
        setTimeout(() => this.notification.set(null), 3000);
    }
    
    // Item Modal
    openItemModal(item?: EquipmentItem) {
        if (item) {
            this.editingItem.set(item);
            this.itemForm = { ...item };
        } else {
            this.editingItem.set(null);
            this.itemForm = { id: 0, name: '', category: '', stock: 0, location: '', status: 'Available' };
        }
        this.isItemModalOpen.set(true);
    }

    async saveItem() {
        if (!this.itemForm.name || !this.itemForm.category) return;
        try {
            if (this.editingItem()) {
                const updatedItem = await firstValueFrom(this.http.put<EquipmentItem>(`${this.apiBaseUrl}/items/${this.editingItem()!.id}`, this.itemForm));
                this.items.update(items => items.map(i => i.id === updatedItem.id ? updatedItem : i));
                this.showNotification('Item updated successfully.', 'success');
            } else {
                const newItem = await firstValueFrom(this.http.post<EquipmentItem>(`${this.apiBaseUrl}/items`, this.itemForm));
                this.items.update(items => [...items, newItem]);
                this.showNotification('Item added successfully.', 'success');
            }
        } catch (e) {
            console.error("Error saving item: ", e);
            this.showNotification('Failed to save item.', 'error');
        } finally {
            this.isItemModalOpen.set(false);
        }
    }

    async deleteItem(id: number) {
        try {
            await firstValueFrom(this.http.delete(`${this.apiBaseUrl}/items/${id}`));
            this.items.update(items => items.filter(i => i.id !== id));
            this.showNotification('Item deleted successfully.', 'success');
        } catch (e) {
            console.error("Error deleting item:", e);
            this.showNotification('Failed to delete item.', 'error');
        }
    }

    // User Modal
    openUserModal(user?: LendifyUser) {
        if (user) {
            this.editingUser.set(user);
            this.userForm = { ...user };
        } else {
            this.editingUser.set(null);
            this.userForm = { id: 0, name: '', studentId: '', email: '' };
        }
        this.isUserModalOpen.set(true);
    }

    async saveUser() {
        if (!this.userForm.name || !this.userForm.studentId || !this.userForm.email) return;
        try {
            if (this.editingUser()) {
                const updatedUser = await firstValueFrom(this.http.put<LendifyUser>(`${this.apiBaseUrl}/users/${this.editingUser()!.id}`, this.userForm));
                this.users.update(users => users.map(u => u.id === updatedUser.id ? updatedUser : u));
                this.showNotification('User updated successfully.', 'success');
            } else {
                const newUser = await firstValueFrom(this.http.post<LendifyUser>(`${this.apiBaseUrl}/users`, this.userForm));
                this.users.update(users => [...users, newUser]);
                this.showNotification('User added successfully.', 'success');
            }
        } catch(e) {
            console.error("Error saving user:", e);
            this.showNotification('Failed to save user.', 'error');
        } finally {
            this.isUserModalOpen.set(false);
        }
    }

    async deleteUser(id: number) {
         try {
            await firstValueFrom(this.http.delete(`${this.apiBaseUrl}/users/${id}`));
            this.users.update(users => users.filter(u => u.id !== id));
            this.showNotification('User deleted successfully.', 'success');
         } catch(e) {
            console.error("Error deleting user:", e);
            this.showNotification('Failed to delete user.', 'error');
         }
    }

    // --- LENDING LOGIC ---
    async borrowItem(item: EquipmentItem) {
        if (!this.currentUser()) {
            this.showNotification("Error: No user is logged in.", 'error');
            return;
        }
        try {
            await firstValueFrom(this.http.post(`${this.apiBaseUrl}/borrow`, { userId: this.currentUser()!.id, itemId: item.id }));
            this.showNotification(`You have successfully borrowed: ${item.name}`, 'success');
            this.fetchAllData(); // Refresh all data to reflect changes
        } catch (e) {
            console.error("Error borrowing item:", e);
            this.showNotification("An error occurred. Could not borrow item.", 'error');
        }
    }

    async returnItem(record: BorrowRecord) {
        try {
            await firstValueFrom(this.http.put(`${this.apiBaseUrl}/return/${record.id}`, {}));
            this.showNotification(`${record.itemName} has been successfully returned.`, 'success');
            this.fetchAllData(); // Refresh all data to reflect changes
        } catch (e) {
            console.error("Error returning item:", e);
            this.showNotification("An error occurred. Could not return item.", 'error');
        }
    }
}

