import { Routes } from '@angular/router';

// Correct imports based on standard Angular CLI structure
import { AuthComponent } from './auth/auth.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ItemListComponent } from './item-list/item-list.component';
import { UserListComponent } from './user-list/user-list.component';
import { BorrowReturnComponent } from './borrow-return/borrow-return.component';
import { BorrowLogComponent } from './borrow-log/borrow-log.component'; // <-- IMPORT NEW COMPONENT

// Import your AuthGuard if you create one later
// import { authGuard } from './guards/auth.guard';
// import { adminGuard } from './guards/admin.guard'; // Example guard for admin routes

export const routes: Routes = [
  // Authentication route (publicly accessible)
  { path: 'auth', component: AuthComponent },

  // Application routes (should be protected by guards in a real app)
  {
    path: 'dashboard',
    component: DashboardComponent,
    // canActivate: [authGuard] // Example: requires login
  },
  {
    path: 'items',
    component: ItemListComponent,
    // canActivate: [authGuard, adminGuard] // Example: requires login + admin role
  },
  {
    path: 'users',
    component: UserListComponent,
    // canActivate: [authGuard, adminGuard] // Example: requires login + admin role
  },
  {
    path: 'borrow-return',
    component: BorrowReturnComponent,
    // canActivate: [authGuard] // Example: requires login
  },
  // --- ADD NEW ROUTE FOR ADMIN LOG ---
  {
    path: 'borrow-log', // The URL path
    component: BorrowLogComponent,
    // canActivate: [authGuard, adminGuard] // Example: Protect this route for admins
  },
  // --- END ADD ---

  // Default route
  { path: '', redirectTo: '/auth', pathMatch: 'full' },

  // Wildcard route
  { path: '**', redirectTo: '/auth' }
];

