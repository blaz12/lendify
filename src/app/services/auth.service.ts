import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http'; // Import HttpClient
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LendifyUser } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // --- Inject HttpClient and Router ---
  private http = inject(HttpClient);
  private router = inject(Router);
  // --- Define API Base URL ---
  private readonly apiBaseUrl = 'http://localhost:3000/api';

  // Signal to hold the currently logged-in user
  currentUser = signal<LendifyUser | null>(null);
  // Signal to hold the last authentication error message
  authError = signal<string | null>(null);

  constructor() {
    // Optional: Check local storage or session storage on startup
    // to see if a user was previously logged in. Could add this later.
  }

  // --- LOGIN Method (Moved from ApiService) ---
  async login(studentId: string, password: string): Promise<LendifyUser | null> {
    try {
      this.authError.set(null); // Clear previous errors
      console.log(`AuthService: Attempting login for ${studentId}`); // Add specific log
      const user = await firstValueFrom(
        // Call the backend login endpoint
        this.http.post<LendifyUser>(`${this.apiBaseUrl}/login`, { studentId, password })
      );
      if (user) {
        console.log(`AuthService: Login successful for ${studentId}`);
        this.currentUser.set(user); // Set the current user signal
        this.router.navigate(['/dashboard']); // Navigate on successful login
        return user;
      }
      // This case likely won't happen if backend returns user or throws error
      console.warn(`AuthService: Login returned but no user data for ${studentId}`);
      return null;
    } catch (error) {
      console.error("AuthService Login Error:", error);
      if (error instanceof HttpErrorResponse && error.error?.error) {
        this.authError.set(error.error.error); // Set error message from backend response
      } else {
        this.authError.set("Login failed. Could not connect to server or unexpected error."); // Generic error
      }
      this.currentUser.set(null); // Ensure user is null on error
      throw error; // Re-throw the error so the component's catch block executes
    }
  }

  // --- REGISTER Method (Moved from ApiService) ---
  async register(name: string, studentId: string, email: string, password: string): Promise<void> {
    try {
      this.authError.set(null); // Clear previous errors
      console.log(`AuthService: Attempting registration for ${studentId}`); // Add specific log
      await firstValueFrom(
        // Call the backend register endpoint
        this.http.post<LendifyUser>(`${this.apiBaseUrl}/register`, { name, studentId, email, password })
      );
      console.log(`AuthService: Registration successful request sent for ${studentId}`);
      // No need to set currentUser here, user must log in after registering
    } catch (error) {
      console.error("AuthService Register Error:", error);
      if (error instanceof HttpErrorResponse && error.error?.error) {
        this.authError.set(error.error.error); // Set error message from backend response
      } else {
        this.authError.set("Registration failed. Could not connect to server or unexpected error."); // Generic error
      }
       throw error; // Re-throw the error so the component's catch block executes
    }
  }

  // --- LOGOUT Method (Unchanged) ---
  logout() {
    console.log('AuthService: Logging out');
    this.currentUser.set(null);
    this.authError.set(null);
    // Optional: Clear any stored user data (e.g., in localStorage)
    this.router.navigate(['/auth']); // Navigate back to login page
  }
}

