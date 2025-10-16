import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChangeDetectionStrategy, computed, effect, inject, OnInit, WritableSignal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// --- FIREBASE IMPORTS ---
// NOTE: In a real app, you would install these via npm.
// For this environment, we assume they are globally available or will be linked.
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInAnonymously, onAuthStateChanged, User, signInWithCustomToken } from 'firebase/auth';
import {
    getFirestore, Firestore, collection, doc, onSnapshot,
    addDoc, updateDoc, deleteDoc, writeBatch, query, where, getDocs, Timestamp, Unsubscribe
} from 'firebase/firestore';

// --- TYPE DEFINITIONS ---
interface LendifyUser {
    id: string;
    name: string;
    studentId: string;
    email: string;
}

interface EquipmentItem {
    id: string;
    name: string;
    category: string;
    stock: number;
    location: string;
    status: 'Available' | 'Out of Stock';
}

interface BorrowRecord {
    id: string;
    userId: string;
    userName: string; // Denormalized for easier display
    studentId: string; // Denormalized
    itemId: string;
    itemName: string; // Denormalized
    borrowedDate: Timestamp;
    returnedDate: Timestamp | null;
    status: 'Borrowed' | 'Returned';
}

type Page = 'dashboard' | 'items' | 'borrow' | 'return' | 'users';

// --- MOCK FIREBASE CONFIG (REPLACE WITH YOURS) ---
// This configuration is provided by the environment.
declare const __firebase_config: any;
declare const __app_id: any;
declare const __initial_auth_token: any;

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'lendify-campus-app';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, FormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [`
      /* Custom scrollbar for better aesthetics */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 10px;
      }
      ::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 10px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .modal-content {
        max-height: 90vh;
        overflow-y: auto;
      }
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2000;
        transition: opacity 0.3s ease-in-out;
      }
    `],
    template: `
    @switch (authStatus()) {
        @case ('loading') {
            <div class="flex h-screen w-full items-center justify-center bg-slate-50">
                <p class="text-lg font-semibold text-slate-600">Initializing Lendify...</p>
            </div>
        }
        @case ('error') {
            <div class="flex h-screen w-full items-center justify-center bg-slate-50 flex-col p-4 text-center">
                <p class="text-lg font-semibold text-red-600">Authentication Failed</p>
                <p class="text-sm text-slate-600 mt-2">This is likely because Anonymous Sign-In is not enabled in your Firebase project. Please enable it in the Firebase Console under Authentication -> Sign-in method.</p>
            </div>
        }
        @case ('authenticated') {
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
                                        <td class="px-6 py-4">{{ record.borrowedDate.toDate() | date:'medium' }}</td>
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
                                <input #itemName [(ngModel)]="itemForm.name" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="text" placeholder="e.g., MacBook Pro 14">
                            </div>
                             <div>
                                <label class="text-sm font-medium">Category</label>
                                <input #itemCategory [(ngModel)]="itemForm.category" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="text" placeholder="e.g., Electronics">
                            </div>
                             <div>
                                <label class="text-sm font-medium">Stock</label>
                                <input #itemStock [(ngModel)]="itemForm.stock" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" min="0">
                            </div>
                             <div>
                                <label class="text-sm font-medium">Location</label>
                                <input #itemLocation [(ngModel)]="itemForm.location" class="w-full px-3 py-2 mt-1 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" type="text" placeholder="e.g., Library Room 201">
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
        }
    }
    `
})
export class App implements OnInit, OnDestroy {
    // --- STATE MANAGEMENT (Signals) ---
    authStatus = signal<'loading' | 'authenticated' | 'error'>('loading');
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
    itemForm: EquipmentItem = this.resetItemForm();

    isUserModalOpen = signal(false);
    editingUser: WritableSignal<LendifyUser | null> = signal(null);
    userForm: LendifyUser = this.resetUserForm();

    // Notification signal
    notification = signal<{ message: string; type: 'success' | 'error' } | null>(null);

    // --- FIREBASE SERVICES ---
    private firebaseApp: FirebaseApp;
    private auth: Auth;
    private db: Firestore;

    // --- REALTIME LISTENERS ---
    private userUnsubscribe?: Unsubscribe;
    private itemUnsubscribe?: Unsubscribe;
    private recordUnsubscribe?: Unsubscribe;
    private authUnsubscribe?: Unsubscribe;

    // --- NAVIGATION ---
    navigationItems: { id: Page; label: string; icon: string }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
        { id: 'items', label: 'Manage Items', icon: 'M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z' },
        { id: 'borrow', label: 'Borrow Item', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
        { id: 'return', label: 'Return Item', icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' },
        { id: 'users', label: 'Manage Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 21a6 6 0 00-6-6h6m6 0a6 6 0 00-6-6m6 6a6 6 0 00-6 6' },
    ];

    constructor() {
        this.firebaseApp = initializeApp(firebaseConfig);
        this.auth = getAuth(this.firebaseApp);
        this.db = getFirestore(this.firebaseApp);

        // Effect to update item status based on stock
        effect(() => {
            const itemsToUpdate = this.items().filter(item => (item.stock > 0 && item.status !== 'Available') || (item.stock === 0 && item.status !== 'Out of Stock'));
            if (itemsToUpdate.length > 0 && this.authStatus() === 'authenticated') {
                const batch = writeBatch(this.db);
                itemsToUpdate.forEach(item => {
                    const newStatus = item.stock > 0 ? 'Available' : 'Out of Stock';
                    const itemRef = doc(this.db, this.getCollectionPath('items'), item.id);
                    batch.update(itemRef, { status: newStatus });
                });
                batch.commit().catch(e => console.error("Error auto-updating item status:", e));
            }
        }, { allowSignalWrites: true });
    }

    ngOnInit(): void {
        // The listener is set up first to catch the result of our sign-in attempt.
        this.authUnsubscribe = onAuthStateChanged(this.auth, (user) => {
            if (user) {
                // A user is present, we are authenticated at the Firebase level.
                this.setupDataListeners();
                this.authStatus.set('authenticated');
            }
            // If user is null, we don't need to do anything here. The initial sign-in
            // logic below will handle the error state. A null user just means
            // "not signed in yet" or "signed out".
        });

        // Attempt the initial anonymous sign-in
        this.performInitialSignIn();
    }

    async performInitialSignIn() {
        try {
            if (this.auth.currentUser) {
                 // Already authenticated, maybe from a previous session.
                 // The onAuthStateChanged listener will have already fired.
                 return;
            }

            // ==============================================================================
            // IMPORTANT: If the next line fails, you MUST enable "Anonymous" sign-in
            // in your Firebase project: Authentication -> Sign-in method -> Add new provider.
            // ==============================================================================
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(this.auth, __initial_auth_token);
            } else {
                await signInAnonymously(this.auth);
            }
            // On success, the onAuthStateChanged listener above will take over.

        } catch (error) {
            console.error('Firebase initial authentication failed:', error);
            this.authStatus.set('error');
        }
    }

    ngOnDestroy(): void {
        this.authUnsubscribe?.();
        this.userUnsubscribe?.();
        this.itemUnsubscribe?.();
        this.recordUnsubscribe?.();
    }

    private getCollectionPath(collectionName: string): string {
        return `/artifacts/${appId}/public/data/${collectionName}`;
    }

    setupDataListeners() {
        // Detach previous listeners if they exist
        this.userUnsubscribe?.();
        this.itemUnsubscribe?.();
        this.recordUnsubscribe?.();
        
        // Listen to users collection
        const userQuery = collection(this.db, this.getCollectionPath('users'));
        this.userUnsubscribe = onSnapshot(userQuery, (snapshot) => {
            this.users.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LendifyUser)));
        }, (error) => console.error("User listener error:", error));

        // Listen to items collection
        const itemQuery = collection(this.db, this.getCollectionPath('items'));
        this.itemUnsubscribe = onSnapshot(itemQuery, (snapshot) => {
            this.items.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EquipmentItem)));
        }, (error) => console.error("Item listener error:", error));

        // Listen to borrowRecords collection
        const recordQuery = collection(this.db, this.getCollectionPath('borrow_records'));
        this.recordUnsubscribe = onSnapshot(recordQuery, (snapshot) => {
            this.borrowRecords.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BorrowRecord)));
        }, (error) => console.error("Record listener error:", error));
    }

    // --- COMPUTED SIGNALS ---
    availableItems = computed(() => this.items().filter(item => item.stock > 0));
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
    async login(studentId: string) {
        if (!studentId?.trim()) {
            this.loginError.set("Student ID cannot be empty.");
            return;
        }

        const q = query(collection(this.db, this.getCollectionPath('users')), where("studentId", "==", studentId.trim()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            this.loginError.set("No user found with this Student ID. Please contact an admin.");
            this.currentUser.set(null);
        } else {
            const userDoc = querySnapshot.docs[0];
            this.currentUser.set({ id: userDoc.id, ...userDoc.data() } as LendifyUser);
            this.loginError.set(null);
        }
    }

    logout() {
        this.currentUser.set(null);
        this.currentPage.set('dashboard'); // Reset to dashboard view
    }


    // --- CRUD OPERATIONS ---
    private showNotification(message: string, type: 'success' | 'error') {
        this.notification.set({ message, type });
        setTimeout(() => this.notification.set(null), 3000);
    }
    
    // Item Modal
    private resetItemForm(): EquipmentItem {
        return { id: '', name: '', category: '', stock: 0, location: '', status: 'Available' };
    }
    openItemModal(item?: EquipmentItem) {
        if (item) {
            this.editingItem.set(item);
            this.itemForm = { ...item };
        } else {
            this.editingItem.set(null);
            this.itemForm = this.resetItemForm();
        }
        this.isItemModalOpen.set(true);
    }
    async saveItem() {
        if (!this.itemForm.name || !this.itemForm.category) return;
        const itemData = {
            name: this.itemForm.name,
            category: this.itemForm.category,
            stock: Number(this.itemForm.stock),
            location: this.itemForm.location,
            status: Number(this.itemForm.stock) > 0 ? 'Available' : 'Out of Stock'
        };

        try {
            if (this.editingItem()) {
                const itemRef = doc(this.db, this.getCollectionPath('items'), this.editingItem()!.id);
                await updateDoc(itemRef, itemData);
                this.showNotification('Item updated successfully.', 'success');
            } else {
                await addDoc(collection(this.db, this.getCollectionPath('items')), itemData);
                this.showNotification('Item added successfully.', 'success');
            }
        } catch (e) {
            console.error("Error saving item: ", e);
            this.showNotification('Failed to save item.', 'error');
        } finally {
            this.isItemModalOpen.set(false);
        }
    }
    async deleteItem(id: string) {
        try {
            await deleteDoc(doc(this.db, this.getCollectionPath('items'), id));
            this.showNotification('Item deleted successfully.', 'success');
        } catch (e) {
            console.error("Error deleting item:", e);
            this.showNotification('Failed to delete item.', 'error');
        }
    }

    // User Modal
    private resetUserForm(): LendifyUser {
        return { id: '', name: '', studentId: '', email: '' };
    }
    openUserModal(user?: LendifyUser) {
        if (user) {
            this.editingUser.set(user);
            this.userForm = { ...user };
        } else {
            this.editingUser.set(null);
            this.userForm = this.resetUserForm();
        }
        this.isUserModalOpen.set(true);
    }
    async saveUser() {
        if (!this.userForm.name || !this.userForm.studentId || !this.userForm.email) return;
        const userData = {
            name: this.userForm.name,
            studentId: this.userForm.studentId,
            email: this.userForm.email,
        };

        try {
            if (this.editingUser()) {
                const userRef = doc(this.db, this.getCollectionPath('users'), this.editingUser()!.id);
                await updateDoc(userRef, userData);
                this.showNotification('User updated successfully.', 'success');
            } else {
                await addDoc(collection(this.db, this.getCollectionPath('users')), userData);
                this.showNotification('User added successfully.', 'success');
            }
        } catch(e) {
            console.error("Error saving user:", e);
            this.showNotification('Failed to save user.', 'error');
        } finally {
            this.isUserModalOpen.set(false);
        }
    }
    async deleteUser(id: string) {
         try {
            await deleteDoc(doc(this.db, this.getCollectionPath('users'), id));
            this.showNotification('User deleted successfully.', 'success');
            // In a real app, you might want to handle what happens to borrow records of a deleted user.
         } catch(e) {
            console.error("Error deleting user:", e);
            this.showNotification('Failed to delete user.', 'error');
         }
    }

    // --- LENDING LOGIC ---
    async borrowItem(item: EquipmentItem) {
        if (item.stock <= 0) {
            this.showNotification("This item is out of stock.", 'error');
            return;
        }
        if (!this.currentUser()) {
            this.showNotification("Error: No user is logged in.", 'error');
            return;
        }

        const batch = writeBatch(this.db);
        
        // 1. Decrement item stock
        const itemRef = doc(this.db, this.getCollectionPath('items'), item.id);
        batch.update(itemRef, { stock: item.stock - 1 });

        // 2. Create a new borrow record
        const recordRef = doc(collection(this.db, this.getCollectionPath('borrow_records')));
        const newRecord: Omit<BorrowRecord, 'id'> = {
            userId: this.currentUser()!.id,
            userName: this.currentUser()!.name,
            studentId: this.currentUser()!.studentId,
            itemId: item.id,
            itemName: item.name,
            borrowedDate: Timestamp.now(),
            returnedDate: null,
            status: 'Borrowed'
        };
        batch.set(recordRef, newRecord);

        try {
            await batch.commit();
            this.showNotification(`You have successfully borrowed: ${item.name}`, 'success');
        } catch (e) {
            console.error("Error borrowing item:", e);
            this.showNotification("An error occurred. Could not borrow item.", 'error');
        }
    }

    async returnItem(record: BorrowRecord) {
        const item = this.items().find(i => i.id === record.itemId);
        if (!item) {
            this.showNotification("Error: Cannot find the original item for this record.", 'error');
            return;
        }

        const batch = writeBatch(this.db);

        // 1. Increment item stock
        const itemRef = doc(this.db, this.getCollectionPath('items'), item.id);
        batch.update(itemRef, { stock: item.stock + 1 });
        
        // 2. Update the borrow record
        const recordRef = doc(this.db, this.getCollectionPath('borrow_records'), record.id);
        batch.update(recordRef, {
            status: 'Returned',
            returnedDate: Timestamp.now()
        });

        try {
            await batch.commit();
            this.showNotification(`${item.name} has been successfully returned.`, 'success');
        } catch (e) {
            console.error("Error returning item:", e);
            this.showNotification("An error occurred. Could not return item.", 'error');
        }
    }
}
