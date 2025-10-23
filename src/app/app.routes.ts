import { Routes } from '@angular/router';

// Correct imports based on standard Angular CLI structure
import { AuthComponent } from './auth/auth.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ItemListComponent } from './item-list/item-list.component';
import { UserListComponent } from './user-list/user-list.component';
import { BorrowReturnComponent } from './borrow-return/borrow-return.component';

// Import your AuthGuard if you create one later
// import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Authentication route (publicly accessible)
  { path: 'auth', component: AuthComponent },

  // Application routes (should be protected by a guard in a real app)
  {
    path: 'dashboard',
    component: DashboardComponent,
    // canActivate: [authGuard] // Example of how to protect a route
  },
  {
    path: 'items',
    component: ItemListComponent,
    // canActivate: [authGuard]
  },
  {
    path: 'users',
    component: UserListComponent,
    // canActivate: [authGuard]
  },
  {
    path: 'borrow-return',
    component: BorrowReturnComponent,
    // canActivate: [authGuard]
  },

  // Default route: Redirect to auth page if not logged in, or dashboard if logged in.
  // The logic for this redirect is usually handled in app.component.ts or an auth guard.
  { path: '', redirectTo: '/auth', pathMatch: 'full' },

  // Wildcard route for any path that doesn't match the ones above
  { path: '**', redirectTo: '/auth' } // Redirect unknown paths to the auth page
];

