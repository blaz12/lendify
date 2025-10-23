import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LendifyUser } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly apiBaseUrl = 'http://localhost:3000/api';

  // Signal to hold the currently logged-in user
  currentUser = signal<LendifyUser | null>(null);

  // --- ADD THIS SIGNAL ---
  // Signal to hold the last authentication error message
  authError = signal<string | null>(null);
  // --- END ADD ---

  constructor() {
    // Optional: Check local storage or session storage on startup
    // to see if a user was previously logged in.
  }

  async login(studentId: string, password: string): Promise<LendifyUser | null> {
    try {
      this.authError.set(null); // Clear previous errors
      const user = await firstValueFrom(
        this.http.post<LendifyUser>(`${this.apiBaseUrl}/login`, { studentId, password })
      );
      if (user) {
        this.currentUser.set(user);
        this.router.navigate(['/dashboard']); // Navigate on successful login
        return user;
      }
      return null; // Should not happen if backend returns user or error
    } catch (error) {
      // --- UPDATE CATCH BLOCK ---
      console.error("AuthService Login Error:", error);
      if (error instanceof HttpErrorResponse && error.error?.error) {
        this.authError.set(error.error.error); // Set error from backend
      } else {
        this.authError.set("Login failed. Could not connect to server."); // Generic error
      }
      this.currentUser.set(null); // Ensure user is null on error
      throw error; // Re-throw the error so the component knows it failed
      // --- END UPDATE ---
    }
  }

  async register(name: string, studentId: string, email: string, password: string): Promise<void> {
    try {
      this.authError.set(null); // Clear previous errors
      await firstValueFrom(
        this.http.post<LendifyUser>(`${this.apiBaseUrl}/register`, { name, studentId, email, password })
      );
      // No need to set currentUser here, user must log in after registering
    } catch (error) {
      // --- UPDATE CATCH BLOCK ---
      console.error("AuthService Register Error:", error);
      if (error instanceof HttpErrorResponse && error.error?.error) {
        this.authError.set(error.error.error); // Set error from backend
      } else {
        this.authError.set("Registration failed. Could not connect to server."); // Generic error
      }
       throw error; // Re-throw the error so the component knows it failed
      // --- END UPDATE ---
    }
  }

  logout() {
    this.currentUser.set(null);
    this.authError.set(null);
    // Optional: Clear any stored user data (e.g., in localStorage)
    this.router.navigate(['/auth']); // Navigate back to login page
  }
}

